"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRecentInvoices, deleteInvoice } from "@/lib/invoiceService";
import {
  Search,
  MoreHorizontal,
  Copy,
  Trash,
  FileText,
  ChevronLeft,
  ChevronRight,
  Archive,
  Eye,
  Shield,
} from "lucide-react";

export default function HistoricoPage() {
  const router = useRouter();
  // Using any[] to bypass strict linting
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [openMenuId, setOpenMenuId] = useState(null);

  // Preview State
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);

  // STATE FOR PASSKEY
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [passkeyError, setPasskeyError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handlePasskeySubmit = async () => {
    setIsDeleting(true);
    setPasskeyError("");

    try {
      const res = await fetch("/api/delete-imported-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey: passkeyInput }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Histórico importado apagado com sucesso!");
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
    const data = await getRecentInvoices(); // Fetches all, we filter client-side for now
    setInvoices(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDelete = async (id: any) => {
    if (confirm("Tem certeza que deseja remover este item do histórico?")) {
      await deleteInvoice(id);
      setOpenMenuId(null);
      loadData();
    }
  };

  const handleDeleteAll = async () => {
    if (
      confirm(
        "ATENÇÃO: Você tem certeza que deseja APAGAR TODO O HISTÓRICO IMPORTADO? Essa ação não pode ser desfeita.",
      )
    ) {
      setDeletingAll(true);
      try {
        const res = await fetch("/api/delete-imported-invoices", {
          method: "DELETE",
        });
        if (res.ok) {
          alert("Histórico limpo com sucesso!");
          loadData();
        } else {
          alert("Erro ao limpar histórico.");
        }
      } catch (e) {
        alert("Erro de conexão.");
      } finally {
        setDeletingAll(false);
      }
    }
  };

  // Clone logic: Redirect to new invoice page with 'clone' mode
  const handleReuse = (id: any) =>
    router.push(`/faturas/nova?id=${id}&mode=clone`);

  const filteredInvoices = invoices.filter((invoice) => {
    // SHOW ONLY IMPORTED
    if (invoice.source !== "excel_import") return false;

    const term = searchTerm.toLowerCase();
    const matchesName = invoice.patientName?.toLowerCase().includes(term);
    const matchesProcedure = invoice.procedureTitle
      ?.toLowerCase()
      .includes(term);
    const matchesSheet = invoice.originalSheet?.toLowerCase().includes(term);

    return matchesName || matchesProcedure || matchesSheet;
  });

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
    <div className="font-sans relative">
      {/* GLOBAL OVERLAY FOR MENUS */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setOpenMenuId(null)}
        ></div>
      )}

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
                Esta ação apagará <b>todo o histórico importado</b>. <br />
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

      {/* PREVIEW MODAL */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" /> Prévia da
                Fatura
              </h3>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Paciente
                  </p>
                  <p className="text-lg font-medium text-gray-900">
                    {previewInvoice.patientName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Valor Total
                  </p>
                  <p className="text-lg font-medium text-green-600">
                    {Number(previewInvoice.grandTotal).toLocaleString("pt-PT", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    MT
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Procedimento
                  </p>
                  <p className="text-gray-800">
                    {previewInvoice.procedureTitle || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Data / Aba
                  </p>
                  <p className="text-gray-800">
                    {previewInvoice.date}{" "}
                    <span className="text-gray-400">
                      ({previewInvoice.originalSheet})
                    </span>
                  </p>
                </div>
              </div>

              {previewInvoice.items && previewInvoice.items.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">
                    Itens Detectados
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    {previewInvoice.items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between border-b border-gray-200 last:border-0 py-1"
                      >
                        <span>{item.description}</span>
                        <span className="font-mono">
                          {Number(item.total).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Excel Raw Data Preview */}
              {previewInvoice.rawData && previewInvoice.rawData.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 font-semibold text-gray-700 flex items-center gap-2 text-sm">
                    <Eye size={16} />
                    Visualização do Excel Original
                  </div>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-inner max-h-64">
                    <table className="min-w-full text-xs divide-y divide-gray-100 table-auto">
                      <tbody className="divide-y divide-gray-100">
                        {previewInvoice.rawData.map(
                          (rData: any[], rIdx: number) => (
                            <tr key={rIdx} className="hover:bg-gray-50">
                              <td className="w-8 p-1.5 bg-gray-50 text-gray-400 font-mono text-center border-r border-gray-100 select-none">
                                {rIdx + 1}
                              </td>
                              {rData.map((cell: any, cIdx: number) => (
                                <td
                                  key={cIdx}
                                  className="p-1.5 border-r border-gray-100 whitespace-pre-wrap text-xs max-w-[200px] text-gray-600 align-top"
                                  title={
                                    typeof cell === "object" ? "" : String(cell)
                                  }
                                >
                                  {String(cell)}
                                </td>
                              ))}
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setPreviewInvoice(null);
                  handleReuse(previewInvoice.invoiceNumber);
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-2"
              >
                <Copy size={16} /> Usar Modelo
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Archive className="text-gray-500" /> Histórico Importado
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Consulte faturas antigas (Excel) e use como base para novas.
            </p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-grow md:w-80">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm transition-all"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {filteredInvoices.length > 0 && (
              <button
                onClick={() => setShowPasskeyModal(true)}
                className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 border border-red-200 transition-colors"
              >
                <Trash size={18} /> Limpar Tudo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible flex flex-col min-h-[500px]">
        {/* Helper Banner */}
        <div className="bg-yellow-50 px-6 py-3 border-b border-yellow-100 flex items-start gap-3">
          <div className="mt-0.5 text-yellow-600">
            <Copy size={16} />
          </div>
          <div className="text-xs text-yellow-800">
            <span className="font-bold">Dica:</span> Para emitir uma nova fatura
            com os dados antigos, clique nos 3 pontinhos e escolha{" "}
            <b>Duplicar / Usar Modelo</b>.
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="col-span-3">Data / Aba Original</div>
          <div className="col-span-4">Paciente / Procedimento</div>
          <div className="col-span-4 text-right">Valor Total</div>
          <div className="col-span-1 text-center">Ações</div>
        </div>

        <div className="flex-grow">
          {loading ? (
            <div className="p-12 text-center h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center text-gray-400 h-full">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <Archive size={32} className="text-gray-300" />
              </div>
              <p className="font-medium text-gray-600">
                Nenhum registro no histórico
              </p>
              <p className="text-sm mt-1">
                Importe arquivos Excel para vê-los aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {paginatedInvoices.map((invoice) => (
                <div
                  key={invoice.id || invoice.invoiceNumber}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors text-sm group relative"
                >
                  <div className="col-span-3 text-gray-600">
                    <div className="font-medium text-gray-900">
                      {invoice.date}
                    </div>
                    <div
                      className="text-xs text-gray-400 font-mono mt-0.5 truncate"
                      title={invoice.originalSheet}
                    >
                      {invoice.originalSheet}
                    </div>
                  </div>

                  <div className="col-span-4">
                    <div
                      className="font-medium text-gray-900 truncate pr-4"
                      title={invoice.patientName}
                    >
                      {invoice.patientName}
                    </div>
                    {invoice.procedureTitle && (
                      <div
                        className="text-xs text-gray-500 truncate mt-0.5"
                        title={invoice.procedureTitle}
                      >
                        {invoice.procedureTitle}
                      </div>
                    )}
                  </div>

                  <div className="col-span-4 text-right font-medium text-gray-900">
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

                    {openMenuId === invoice.invoiceNumber && (
                      <div className="absolute right-0 top-10 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-40 py-1 animation-scale-in origin-top-right">
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            setPreviewInvoice(invoice);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                        >
                          <FileText size={16} className="text-blue-500" />{" "}
                          Prévia
                        </button>
                        <button
                          onClick={() => handleReuse(invoice.invoiceNumber)}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
                        >
                          <Copy size={16} className="text-green-500" /> Duplicar
                          / Usar
                        </button>
                        <div className="my-1 border-t border-gray-100"></div>
                        <button
                          onClick={() => handleDelete(invoice.invoiceNumber)}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash size={16} /> Remover
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && filteredInvoices.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50 rounded-b-xl">
            <span className="text-xs text-gray-500">
              Mostrando {startIndex + 1} -{" "}
              {Math.min(startIndex + itemsPerPage, filteredInvoices.length)} de{" "}
              {filteredInvoices.length}
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
                {currentPage} / {totalPages || 1}
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
