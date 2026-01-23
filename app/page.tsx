"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRecentInvoices, deleteInvoice } from "@/lib/invoiceService";
import {
  Plus,
  Search,
  Shield,
  MoreHorizontal,
  Edit,
  Copy,
  Trash,
  FileText,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  // Using any[] to bypass strict linting for now as existing project seems loose with types
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // PAGINAÇÃO
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Número de faturas por página

  const [openMenuId, setOpenMenuId] = useState(null);

  // STATE FOR PASSKEY MODAL
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [passkeyError, setPasskeyError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handlePasskeySubmit = async () => {
    setIsDeleting(true);
    setPasskeyError("");

    try {
      const res = await fetch("/api/delete-active-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey: passkeyInput }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Faturas ativas apagadas com sucesso!");
        window.location.reload();
      } else {
        setPasskeyError(data.error || "Senha incorreta.");
        setIsDeleting(false);
      }
    } catch (e) {
      setPasskeyError("Erro de conexão.");
      setIsDeleting(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    const data = await getRecentInvoices();
    setInvoices(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Resetar para a página 1 sempre que pesquisar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDelete = async (id: any) => {
    if (confirm("Tem certeza que deseja apagar esta fatura permanentemente?")) {
      await deleteInvoice(id);
      setOpenMenuId(null);
      loadData();
    }
  };

  const handleEdit = (id: any) =>
    router.push(`/faturas/nova?id=${id}&mode=edit`);
  const handleReuse = (id: any) =>
    router.push(`/faturas/nova?id=${id}&mode=clone`);

  // --- LÓGICA DE FILTRO (AGORA COM PROCEDIMENTO E EXCLUSÃO DE IMPORTADOS) ---
  const filteredInvoices = invoices.filter((invoice) => {
    // Esconder importados nesta tela
    if (invoice.source === "excel_import") return false;

    const term = searchTerm.toLowerCase();

    const matchesName = invoice.patientName?.toLowerCase().includes(term);
    const matchesNumber = invoice.invoiceNumber?.toString().includes(term);
    const matchesClient = invoice.clientName?.toLowerCase().includes(term);
    // ADICIONADO: Busca pelo nome do procedimento
    const matchesProcedure = invoice.procedureTitle
      ?.toLowerCase()
      .includes(term);

    return matchesName || matchesNumber || matchesClient || matchesProcedure;
  });

  // --- LÓGICA DE PAGINAÇÃO ---
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      {/* PASSKEY MODAL */}
      {showPasskeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 border border-gray-100">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <Shield size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Área Restrita
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Esta ação apagará <b>todas as faturas ativas</b>. <br />
                Para continuar, digite a senha de administrador (6 dígitos).
              </p>

              <input
                type="password"
                maxLength={6}
                className="w-full text-center text-2xl tracking-[0.5em] font-bold border-2 border-gray-200 rounded-xl p-3 mb-2 focus:border-red-500 focus:ring-4 focus:ring-red-50 outline-none transition-all placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
                placeholder="------"
                value={passkeyInput}
                onChange={(e) => {
                  setPasskeyInput(
                    e.target.value.replace(/[^0-9]/g, "").slice(0, 6),
                  );
                  setPasskeyError("");
                }}
              />

              {passkeyError && (
                <p className="text-red-600 text-sm font-medium animate-pulse mb-2">
                  {passkeyError}
                </p>
              )}

              <p className="text-xs text-gray-400 mb-6">
                Caso não saiba a senha, contacte <b>Zakir</b>.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowPasskeyModal(false);
                    setPasskeyInput("");
                    setPasskeyError("");
                  }}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePasskeySubmit}
                  disabled={passkeyInput.length < 6 || isDeleting}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white shadow-lg transition-all ${
                    passkeyInput.length < 6 || isDeleting
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700 hover:shadow-red-200"
                  }`}
                >
                  {isDeleting ? "Verificando..." : "Confirmar Exclusão"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {openMenuId && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setOpenMenuId(null)}
        ></div>
      )}

      {/* CABEÇALHO */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Faturas Proforma
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Gerencie, edite e imprima seus documentos.
            </p>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-grow md:w-72">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm transition-all"
                placeholder="Nome, procedimento, seguro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPasskeyModal(true)}
                className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 border border-red-200 transition-colors"
              >
                <Trash size={18} /> Limpar
              </button>

              <Link href="/faturas/nova">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all">
                  <Plus size={18} /> Nova Fatura
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* TABELA */}
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible flex flex-col min-h-[500px]">
        {/* Cabeçalho das Colunas */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="col-span-1">Nº</div>
          <div className="col-span-2">Data</div>
          <div className="col-span-3">Paciente / Procedimento</div>
          <div className="col-span-2">Pagamento</div>
          <div className="col-span-3 text-right">Valor Total</div>
          <div className="col-span-1 text-center">Ações</div>
        </div>

        {/* Conteúdo da Tabela */}
        <div className="flex-grow">
          {loading ? (
            <div className="p-12 text-center h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center text-gray-400 h-full">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <FileText size={32} className="text-gray-300" />
              </div>
              <p className="font-medium text-gray-600">
                Nenhum documento encontrado
              </p>
              <p className="text-sm mt-1">Tente buscar por outro termo.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {paginatedInvoices.map((invoice) => {
                const insuranceName = invoice.clientName || "Particular";
                const isInsurance =
                  insuranceName.toLowerCase().trim() !== "particular" &&
                  insuranceName.trim() !== "";

                return (
                  <div
                    key={invoice.invoiceNumber}
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors text-sm group relative"
                  >
                    <div className="col-span-1 font-mono font-medium text-gray-500">
                      #{invoice.invoiceNumber}
                    </div>

                    <div className="col-span-2 text-gray-600">
                      {new Date(invoice.date).toLocaleDateString("pt-PT")}
                    </div>

                    {/* Paciente e Procedimento Juntos */}
                    <div className="col-span-3">
                      <div
                        className="font-medium text-gray-900 truncate pr-4"
                        title={invoice.patientName}
                      >
                        {invoice.patientName}
                      </div>
                      {invoice.procedureTitle && (
                        <div
                          className="text-xs text-gray-400 truncate mt-0.5 font-normal"
                          title={invoice.procedureTitle}
                        >
                          {invoice.procedureTitle}
                        </div>
                      )}
                    </div>

                    <div className="col-span-2">
                      {isInsurance ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 max-w-full truncate">
                          <Shield size={12} className="flex-shrink-0" />{" "}
                          <span className="truncate">{insuranceName}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          Particular
                        </span>
                      )}
                    </div>

                    <div className="col-span-3 text-right font-medium text-gray-900">
                      {Number(invoice.grandTotal).toLocaleString("pt-PT", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      <span className="text-gray-400 text-xs">MT</span>
                    </div>

                    <div className="col-span-1 flex justify-center relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(
                            openMenuId === invoice.invoiceNumber
                              ? null
                              : invoice.invoiceNumber,
                          );
                        }}
                        className={`p-2 rounded-md transition-colors ${openMenuId === invoice.invoiceNumber ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {/* Menu Dropdown */}
                      {openMenuId === invoice.invoiceNumber && (
                        <div className="absolute right-0 top-10 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-40 py-1 animation-scale-in origin-top-right">
                          <div className="px-3 py-2 border-b border-gray-100 text-xs text-gray-400 font-semibold uppercase tracking-wider">
                            Fatura #{invoice.invoiceNumber}
                          </div>
                          <button
                            onClick={() => handleEdit(invoice.invoiceNumber)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                          >
                            <Edit size={16} className="text-blue-500" /> Editar
                          </button>
                          <button
                            onClick={() => handleReuse(invoice.invoiceNumber)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
                          >
                            <Copy size={16} className="text-green-500" />{" "}
                            Duplicar
                          </button>
                          <div className="my-1 border-t border-gray-100"></div>
                          <button
                            onClick={() => handleDelete(invoice.invoiceNumber)}
                            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash size={16} /> Apagar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RODAPÉ COM PAGINAÇÃO */}
        {!loading && filteredInvoices.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50 rounded-b-xl">
            <span className="text-xs text-gray-500">
              Mostrando {startIndex + 1} a{" "}
              {Math.min(startIndex + itemsPerPage, filteredInvoices.length)} de{" "}
              {filteredInvoices.length} resultados
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-gray-700 px-2">
                Página {currentPage} de {totalPages || 1}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
