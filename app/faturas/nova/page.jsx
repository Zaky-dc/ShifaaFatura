"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import {
  createInvoice,
  updateInvoice,
  getInvoiceById,
} from "@/lib/invoiceService";
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Calendar,
  Phone,
  CreditCard,
} from "lucide-react";

export default function NovaFaturaPage() {
  return (
    <Suspense fallback={<div>Carregando editor...</div>}>
      <NovaFaturaContent />
    </Suspense>
  );
}

function NovaFaturaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const invoiceId = searchParams.get("id");
  const mode = searchParams.get("mode"); // 'edit' | 'clone'

  const componentRef = useRef();
  const [loading, setLoading] = useState(false);

  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: "",
    clientName: "",
    patientName: "",
    patientNid: "",
    patientContact: "", // Já tínhamos no estado, faltava o input
    date: new Date().toISOString().split("T")[0],
    dueDate: "", // Data de expiração
    procedureTitle: "",
    grandTotal: 0,
    items: [{ qty: 1, description: "Consulta", price: 0, total: 0 }],
    displayMode: "standard", // 'standard' | 'descriptive'
  });

  // Layout State
  const [refHeight, setRefHeight] = useState(250); // Altura inicial da área de referência
  const isDragging = useRef(false);

  // Resize Handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      // Calcula a nova altura baseada na posição do mouse (de baixo para cima)
      const newHeight = window.innerHeight - e.clientY;
      // Limites: min 100px, max 80% da tela
      if (newHeight > 100 && newHeight < window.innerHeight * 0.8) {
        setRefHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "default";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const startResize = (e) => {
    isDragging.current = true;
    document.body.style.cursor = "row-resize";
    e.preventDefault(); // Evita seleção de texto
  };

  // --- CARREGAR DADOS ---
  useEffect(() => {
    async function loadInvoice() {
      if (!invoiceId) return;

      setLoading(true);
      const data = await getInvoiceById(invoiceId);

      if (data) {
        // Merge com defaults para evitar undefined (Inputs controlados)
        const safeData = {
          invoiceNumber: "",
          clientName: "",
          patientName: "",
          patientNid: "",
          patientContact: "",
          date: new Date().toISOString().split("T")[0],
          dueDate: "",
          procedureTitle: "",
          grandTotal: 0,
          grandTotal: 0,
          items: [{ qty: 1, description: "Consulta", price: 0, total: 0 }],
          displayMode: "standard",
          ...data,
        };

        if (mode === "clone") {
          setInvoiceData({
            ...safeData,
            invoiceNumber: "",
            date: new Date().toISOString().split("T")[0],
            dueDate: "",
          });
        } else if (mode === "edit") {
          setInvoiceData(safeData);
        }
      }
      setLoading(false);
    }
    loadInvoice();
  }, [invoiceId, mode]);

  // --- CÁLCULOS ---
  const handleItemChange = (index, field, value) => {
    const newItems = [...invoiceData.items];
    const item = newItems[index];
    item[field] = value;

    // Apenas recalcula o total se estiver no modo Standard ou forçado
    if (invoiceData.displayMode === "standard") {
      if (field === "qty" || field === "price") {
        const q = parseFloat(item.qty) || 0;
        const p = parseFloat(item.price) || 0;
        item.total = q * p;
      }
      const newGrandTotal = newItems.reduce(
        (acc, curr) => acc + (curr.total || 0),
        0,
      );
      setInvoiceData((prev) => ({
        ...prev,
        items: newItems,
        grandTotal: newGrandTotal,
      }));
    } else {
      // Modo descritivo: apenas atualiza o item
      setInvoiceData((prev) => ({ ...prev, items: newItems }));
    }
  };

  // Toggle Mode
  const toggleDisplayMode = () => {
    const newMode =
      invoiceData.displayMode === "standard" ? "descriptive" : "standard";
    setInvoiceData((prev) => ({ ...prev, displayMode: newMode }));
  };

  const addItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [
        ...invoiceData.items,
        { qty: 1, description: "", price: 0, total: 0 },
      ],
    });
  };

  const removeItem = (index) => {
    const newItems = invoiceData.items.filter((_, i) => i !== index);
    const newGrandTotal = newItems.reduce(
      (acc, curr) => acc + (curr.total || 0),
      0,
    );
    setInvoiceData({
      ...invoiceData,
      items: newItems,
      grandTotal: newGrandTotal,
    });
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Proforma_${invoiceData.clientName || invoiceData.patientName || "Documento"}`,
  });

  const handleSave = async () => {
    if (!invoiceData.patientName) return alert("Preencha o nome do paciente");

    setLoading(true);
    try {
      if (mode === "edit" && invoiceData.invoiceNumber) {
        await updateInvoice(invoiceData.invoiceNumber, invoiceData);
        alert("Fatura atualizada com sucesso!");
        window.location.href = "/"; // Sair da tela
      } else {
        // Garantir que é uma nova fatura do sistema, sem vinculo de importação
        const newInvoiceData = { ...invoiceData };
        delete newInvoiceData.source; // Remove 'excel_import' se existir
        delete newInvoiceData.id; // Garante que cria novo ID

        const num = await createInvoice(newInvoiceData);
        // setInvoiceData((prev) => ({ ...prev, invoiceNumber: num })); // Não precisa mais atualizar state se vai sair
        alert(`Fatura ${num} gerada com sucesso!`);
        // if (mode === "clone") router.push(`/faturas/nova?id=${num}&mode=edit`); // Removido comportamento de continuar
        window.location.href = "/"; // Sair da tela
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex bg-gray-100 min-h-screen font-sans">
      {/* --- EDITOR (Barra Lateral Esquerda) --- */}
      <div className="w-5/12 flex flex-col h-screen bg-white shadow-xl z-10 border-r">
        {/* Cabeçalho do Editor */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <button
            onClick={() => (window.location.href = "/")}
            className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm font-medium"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
          <h1 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
            {mode === "edit"
              ? `Editando #${invoiceData.invoiceNumber}`
              : mode === "clone"
                ? "Nova Cópia"
                : "Nova Fatura"}
          </h1>
        </div>

        {/* Formulário com Scroll */}
        <div className="flex-grow overflow-y-auto p-6 space-y-4">
          {/* SEGURADORA & PACIENTE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Seguradora / Cliente
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2 rounded text-sm bg-blue-50 focus:bg-white transition-colors"
                value={invoiceData.clientName}
                onChange={(e) =>
                  setInvoiceData({ ...invoiceData, clientName: e.target.value })
                }
                placeholder="Ex: Mediplus"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Nome Paciente *
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2 rounded text-sm font-semibold"
                value={invoiceData.patientName}
                onChange={(e) =>
                  setInvoiceData({
                    ...invoiceData,
                    patientName: e.target.value,
                  })
                }
                placeholder="Nome completo"
              />
            </div>
          </div>

          {/* NID & CONTACTO (Novo campo aqui) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                NID / Identificação
              </label>
              <div className="relative">
                <CreditCard
                  size={14}
                  className="absolute left-2 top-2.5 text-gray-400"
                />
                <input
                  type="text"
                  className="w-full border border-gray-300 p-2 pl-8 rounded text-sm"
                  value={invoiceData.patientNid}
                  onChange={(e) =>
                    setInvoiceData({
                      ...invoiceData,
                      patientNid: e.target.value,
                    })
                  }
                  placeholder="Número BI/Passaporte"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Contacto Telefónico
              </label>
              <div className="relative">
                <Phone
                  size={14}
                  className="absolute left-2 top-2.5 text-gray-400"
                />
                <input
                  type="text"
                  className="w-full border border-gray-300 p-2 pl-8 rounded text-sm"
                  value={invoiceData.patientContact}
                  onChange={(e) =>
                    setInvoiceData({
                      ...invoiceData,
                      patientContact: e.target.value,
                    })
                  }
                  placeholder="84/82..."
                />
              </div>
            </div>
          </div>

          {/* DATAS (Emissão & Validade) */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded border border-gray-200">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Data Emissão
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 p-1.5 rounded text-sm"
                value={invoiceData.date}
                onChange={(e) =>
                  setInvoiceData({ ...invoiceData, date: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Válido Até (Expira)
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 p-1.5 rounded text-sm text-red-600 font-medium"
                value={invoiceData.dueDate}
                onChange={(e) =>
                  setInvoiceData({ ...invoiceData, dueDate: e.target.value })
                }
              />
            </div>
          </div>

          {/* TOGGLE MODO DE EXIBIÇÃO */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-blue-800">
                Modo de Exibição
              </span>
              <span className="text-xs text-blue-600">
                {invoiceData.displayMode === "standard"
                  ? "Detalhado (Qtd, Preço Unitário, Total)"
                  : "Descritivo (Apenas Texto e Total Global)"}
              </span>
            </div>
            <button
              onClick={toggleDisplayMode}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                invoiceData.displayMode === "standard"
                  ? "bg-blue-600 text-white"
                  : "bg-indigo-600 text-white"
              }`}
            >
              Alternar para{" "}
              {invoiceData.displayMode === "standard"
                ? "Descritivo"
                : "Detalhado"}
            </button>
          </div>

          {/* Título do Procedimento */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              Título do Procedimento
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 p-2 rounded text-sm"
              value={invoiceData.procedureTitle}
              onChange={(e) =>
                setInvoiceData({
                  ...invoiceData,
                  procedureTitle: e.target.value,
                })
              }
              placeholder="Ex: Pequena Cirurgia..."
            />
          </div>

          <hr className="border-gray-200" />

          {/* Lista de Itens */}
          <div>
            <h3 className="text-xs font-bold text-gray-700 uppercase mb-2">
              Itens da Fatura
            </h3>
            <div className="space-y-2">
              {invoiceData.items.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-2 items-start bg-gray-50 p-2 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  {/* QTY - Visible in BOTH modes */}
                  <div className="w-14">
                    <input
                      type={
                        invoiceData.displayMode === "standard"
                          ? "number"
                          : "text"
                      }
                      className="w-full border p-1 rounded text-center text-xs"
                      placeholder="Qtd"
                      value={item.qty || ""}
                      onChange={(e) =>
                        handleItemChange(index, "qty", e.target.value)
                      }
                    />
                  </div>

                  {/* DESCRIPTION - Always visible */}
                  <div className="flex-grow">
                    <textarea
                      rows={invoiceData.displayMode === "descriptive" ? 2 : 1}
                      className="w-full border p-1 rounded text-xs resize-y"
                      placeholder="Descrição do serviço"
                      value={item.description || ""}
                      onChange={(e) =>
                        handleItemChange(index, "description", e.target.value)
                      }
                    />
                  </div>

                  {/* PRICE - Only in Standard */}
                  {invoiceData.displayMode === "standard" && (
                    <div className="w-24">
                      <input
                        type="number"
                        className="w-full border p-1 rounded text-right text-xs"
                        placeholder="Preço"
                        value={item.price || ""}
                        onChange={(e) =>
                          handleItemChange(index, "price", e.target.value)
                        }
                      />
                    </div>
                  )}

                  {/* TOTAL LINE - Only in Standard (Read-only) */}
                  {invoiceData.displayMode === "standard" && (
                    <div className="w-24 flex items-center justify-end text-xs font-bold text-gray-700 bg-gray-200 rounded px-2">
                      {(item.total || 0).toLocaleString("pt-PT")}
                    </div>
                  )}
                  <button
                    onClick={() => removeItem(index)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="text-blue-600 text-xs font-bold mt-3 flex items-center gap-1 hover:underline"
            >
              <Plus size={14} /> Adicionar Linha
            </button>
          </div>
        </div>

        {/* Rodapé Fixo (Ações) */}
        <div className="border-t p-4 bg-white z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="flex justify-between items-center mb-3 bg-gray-800 text-white p-3 rounded-lg">
            <span className="text-xs font-medium uppercase text-gray-300">
              Total Global (
              {invoiceData.displayMode === "descriptive"
                ? "Manual"
                : "Calculado"}
              )
            </span>

            {invoiceData.displayMode === "standard" ? (
              <span className="text-xl font-bold tracking-tight">
                {invoiceData.grandTotal.toLocaleString("pt-PT")} MT
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">MT</span>
                <input
                  type="number"
                  value={invoiceData.grandTotal}
                  onChange={(e) =>
                    setInvoiceData({
                      ...invoiceData,
                      grandTotal: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="bg-gray-700 text-white font-bold text-xl w-40 p-1 rounded text-right border border-gray-600 focus:border-white outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg font-bold flex justify-center gap-2 items-center transition-all disabled:opacity-50 text-sm"
            >
              <Save size={18} />{" "}
              {loading
                ? "Aguarde..."
                : mode === "edit"
                  ? "Salvar Alterações"
                  : "Salvar Fatura"}
            </button>
            <button
              onClick={() => handlePrint()}
              className="bg-blue-800 hover:bg-blue-900 text-white p-3 rounded-lg font-bold flex justify-center gap-2 items-center transition-all text-sm"
            >
              <span className="hidden sm:inline">Imprimir / PDF</span>{" "}
              <span className="sm:hidden">PDF</span>
            </button>
          </div>
        </div>

        {/* --- DADOS DE REFERÊNCIA (Para cópia manual) --- */}
        {invoiceData.rawData && invoiceData.rawData.length > 0 && (
          <>
            {/* DRAG HANDLE */}
            <div
              onMouseDown={startResize}
              className="h-2 bg-gray-200 hover:bg-blue-400 cursor-row-resize flex justify-center items-center border-t border-b border-gray-300 transition-colors"
              title="Arraste para ajustar o tamanho"
            >
              <div className="w-10 h-1 bg-gray-400 rounded-full"></div>
            </div>

            <div
              className="bg-yellow-50 flex flex-col"
              style={{ height: `${refHeight}px` }}
            >
              <div className="p-3 bg-yellow-100 border-b border-yellow-200 flex justify-between items-center text-xs font-bold text-gray-700 uppercase tracking-wider shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  Dados Originais (Referência)
                </div>
                <span className="text-gray-500 font-normal normal-case">
                  Arraste a barra cinza acima para expandir/reduzir
                </span>
              </div>

              <div className="overflow-auto p-4 flex-grow custom-scrollbar">
                <p className="text-xs text-gray-500 mb-2">
                  Estes são os dados exatos do Excel importado. Copie daqui e
                  cole nos campos acima.
                </p>
                <div className="border border-yellow-200 rounded-lg bg-white shadow-inner">
                  <table className="min-w-full text-xs divide-y divide-gray-100 table-auto">
                    <tbody className="divide-y divide-gray-100">
                      {invoiceData.rawData.map((rData, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-yellow-50 transition-colors"
                        >
                          <td className="w-8 p-1.5 bg-gray-50 text-gray-400 font-mono text-center border-r border-gray-100 select-none">
                            {rIdx + 1}
                          </td>
                          {rData.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="p-1.5 border-r border-gray-100 whitespace-pre-wrap align-top text-gray-700 select-all hover:bg-white"
                              title="Clique para selecionar e copiar"
                            >
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- VISUALIZADOR (Lado Direito) --- */}
      <div className="w-7/12 bg-gray-600 overflow-y-auto flex justify-center p-8 custom-scrollbar">
        <div className="scale-[0.8] origin-top shadow-2xl transition-transform duration-300 ease-in-out hover:scale-[0.81]">
          <InvoiceTemplate ref={componentRef} data={invoiceData} />
        </div>
      </div>
    </div>
  );
}
