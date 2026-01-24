"use client";
import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { db } from "@/lib/firebase";
import { ref, get } from "firebase/database";
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
  Phone,
  CreditCard,
  Loader2,
  GripVertical,
  Maximize2
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
  const mode = searchParams.get("mode");

  const componentRef = useRef();
  const [loading, setLoading] = useState(false);
  const [nextNumberPreview, setNextNumberPreview] = useState(null);

  // --- LAYOUT STATES ---
  const [sidebarWidth, setSidebarWidth] = useState(45);
  const [excelHeight, setExcelHeight] = useState(300);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const sidebarRef = useRef(null);

  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: "",
    clientName: "",
    patientName: "",
    patientNid: "",
    patientContact: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: "",
    procedureTitle: "",
    grandTotal: 0,
    items: [{ qty: 1, description: "Consulta", price: 0, total: 0 }],
    displayMode: "standard",
    rawData: [],
  });

  // --- SMART PASTE LOGIC (A MÁGICA) ---
  const handleSmartPaste = (e, fieldType, index = null) => {
    // Pega o texto da área de transferência
    const clipboardText = e.clipboardData.getData('text');
    
    // O Excel separa células com TAB (\t)
    const values = clipboardText.split('\t').map(v => v.trim());

    // Se só tiver 1 valor, deixa o comportamento normal do navegador
    if (values.length < 2) return;

    e.preventDefault(); // Impede a colagem normal para fazermos a nossa

    // CASO 1: Colar Dados do Paciente (Nome -> NID -> Contacto)
    if (fieldType === 'patient') {
        setInvoiceData(prev => ({
            ...prev,
            patientName: values[0] || prev.patientName,
            patientNid: values[1] || prev.patientNid, // Assume que a 2ª célula é NID
            patientContact: values[2] || prev.patientContact // Assume que a 3ª é Contacto
        }));
    }

    // CASO 2: Colar na Linha de Itens (Qtd -> Descrição -> Preço)
    if (fieldType === 'item' && index !== null) {
        const newItems = [...invoiceData.items];
        const item = newItems[index];

        // Tenta adivinhar a ordem baseado no Excel: Qtd | Descricao | Preço
        // Se o primeiro valor for número, assume Qtd. Se não, assume Descrição.
        const isFirstNumber = !isNaN(parseFloat(values[0]));

        if (isFirstNumber) {
            item.qty = parseFloat(values[0]) || 1;
            item.description = values[1] || "";
            // Limpa formatação de moeda "2.000,00 MT" -> 2000.00
            const cleanPrice = values[2] ? parseFloat(values[2].replace(/[^0-9,.]/g, '').replace(',', '.')) : 0;
            item.price = cleanPrice;
        } else {
            // Se copiou só Descrição e Preço
            item.description = values[0];
            const cleanPrice = values[1] ? parseFloat(values[1].replace(/[^0-9,.]/g, '').replace(',', '.')) : 0;
            item.price = cleanPrice;
        }

        // Recalcula total da linha
        item.total = (item.qty || 0) * (item.price || 0);
        
        // Atualiza estado e total global
        const newGrandTotal = newItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
        setInvoiceData(prev => ({ ...prev, items: newItems, grandTotal: newGrandTotal }));
    }
  };

  // --- RESIZING LOGIC ---
  const handleMouseMove = useCallback((e) => {
    if (isResizingWidth) {
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 25 && newWidth < 75) setSidebarWidth(newWidth);
    }
    if (isResizingHeight) {
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight > 100 && newHeight < window.innerHeight - 200) setExcelHeight(newHeight);
    }
  }, [isResizingWidth, isResizingHeight]);

  const handleMouseUp = useCallback(() => {
    setIsResizingWidth(false);
    setIsResizingHeight(false);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, []);

  useEffect(() => {
    if (isResizingWidth || isResizingHeight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none"; 
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingWidth, isResizingHeight, handleMouseMove, handleMouseUp]);

  // --- DATA LOADING ---
  useEffect(() => {
    if (!invoiceId || mode === 'clone') {
        const fetchNextNumber = async () => {
            try {
                const snapshot = await get(ref(db, 'settings/invoiceCounter'));
                const current = snapshot.exists() ? snapshot.val() : 3977;
                setNextNumberPreview(current + 1);
            } catch (e) { console.error(e); }
        };
        fetchNextNumber();
    }
  }, [invoiceId, mode]);

  useEffect(() => {
    async function loadInvoice() {
      if (!invoiceId) return;
      setLoading(true);
      const data = await getInvoiceById(invoiceId);
      if (data) {
        const safeData = {
          invoiceNumber: "", clientName: "", patientName: "", patientNid: "", patientContact: "",
          date: new Date().toISOString().split("T")[0], dueDate: "", procedureTitle: "", grandTotal: 0,
          items: [{ qty: 1, description: "Consulta", price: 0, total: 0 }],
          displayMode: "standard", rawData: [], ...data,
        };
        if (mode === "clone") {
          setInvoiceData({ ...safeData, invoiceNumber: "", date: new Date().toISOString().split("T")[0], dueDate: "" });
        } else if (mode === "edit") {
          setInvoiceData(safeData);
        }
      }
      setLoading(false);
    }
    loadInvoice();
  }, [invoiceId, mode]);

  // --- FORM HANDLERS ---
  const handleItemChange = (index, field, value) => {
    const newItems = [...invoiceData.items];
    const item = newItems[index];
    item[field] = value;
    if (invoiceData.displayMode === "standard") {
      if (field === "qty" || field === "price") {
        const q = parseFloat(item.qty) || 0;
        const p = parseFloat(item.price) || 0;
        item.total = q * p;
      }
      const newGrandTotal = newItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
      setInvoiceData((prev) => ({ ...prev, items: newItems, grandTotal: newGrandTotal }));
    } else {
      setInvoiceData((prev) => ({ ...prev, items: newItems }));
    }
  };

  const toggleDisplayMode = () => {
    const newMode = invoiceData.displayMode === "standard" ? "descriptive" : "standard";
    setInvoiceData((prev) => ({ ...prev, displayMode: newMode }));
  };

  const addItem = () => {
    setInvoiceData({ ...invoiceData, items: [...invoiceData.items, { qty: 1, description: "", price: 0, total: 0 }] });
  };

  const removeItem = (index) => {
    const newItems = invoiceData.items.filter((_, i) => i !== index);
    const newGrandTotal = newItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
    setInvoiceData({ ...invoiceData, items: newItems, grandTotal: newGrandTotal });
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
        alert("Atualizado com sucesso!");
        window.location.href = "/";
      } else {
        const newInvoiceData = { ...invoiceData };
        delete newInvoiceData.source; delete newInvoiceData.id;
        await createInvoice(newInvoiceData);
        alert(`Gerado com sucesso!`);
        window.location.href = "/";
      }
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setLoading(false);
  };

  const hasExcelData = invoiceData.rawData && invoiceData.rawData.length > 0;

  // Helper para gerar letras de colunas (0 -> A, 1 -> B)
  const getColumnLetter = (idx) => String.fromCharCode(65 + idx);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans select-none md:select-auto">
      
      {/* === SIDEBAR === */}
      <div 
        ref={sidebarRef}
        className="flex flex-col h-full bg-white shadow-2xl z-20 relative"
        style={{ width: `${sidebarWidth}%`, minWidth: '350px' }}
      >
        {/* HEADER */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
          <button onClick={() => (window.location.href = "/")} className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm font-medium">
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="text-right">
             <h1 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                {mode === "edit" ? `Editando #${invoiceData.invoiceNumber}` : "Nova Fatura"}
             </h1>
             {mode !== "edit" && (
                 <span className="text-xs text-blue-600 font-mono block">
                    {nextNumberPreview ? `Próximo ID: #${nextNumberPreview}` : '...'}
                 </span>
             )}
          </div>
        </div>

        {/* FORMULÁRIO */}
        <div className="flex-grow overflow-y-auto p-6 space-y-4 pb-10"> 
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Cliente / Seguro</label>
              <input type="text" className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={invoiceData.clientName}
                onChange={(e) => setInvoiceData({ ...invoiceData, clientName: e.target.value })}
                placeholder="Ex: Mediplus"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Nome Paciente *</label>
              <input type="text" className="w-full border border-gray-300 p-2 rounded text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                value={invoiceData.patientName}
                onChange={(e) => setInvoiceData({ ...invoiceData, patientName: e.target.value })}
                onPaste={(e) => handleSmartPaste(e, 'patient')} // <--- SMART PASTE AQUI
                placeholder="Cole aqui (Nome + NID + Contacto)"
                title="Dica: Copie 3 células do Excel (Nome, NID, Contacto) e cole aqui!"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">NID</label>
              <div className="relative">
                <CreditCard size={14} className="absolute left-2 top-2.5 text-gray-400" />
                <input type="text" className="w-full border border-gray-300 p-2 pl-8 rounded text-sm"
                  value={invoiceData.patientNid} onChange={(e) => setInvoiceData({ ...invoiceData, patientNid: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Contacto</label>
              <div className="relative">
                <Phone size={14} className="absolute left-2 top-2.5 text-gray-400" />
                <input type="text" className="w-full border border-gray-300 p-2 pl-8 rounded text-sm"
                  value={invoiceData.patientContact} onChange={(e) => setInvoiceData({ ...invoiceData, patientContact: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded border border-gray-200">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Emissão</label>
              <input type="date" className="w-full border border-gray-300 p-1.5 rounded text-sm"
                value={invoiceData.date} onChange={(e) => setInvoiceData({ ...invoiceData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Validade</label>
              <input type="date" className="w-full border border-gray-300 p-1.5 rounded text-sm text-red-600 font-medium"
                value={invoiceData.dueDate} onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-blue-50 p-2 rounded flex justify-between items-center">
             <span className="text-xs text-blue-800 font-bold ml-2">Modo: {invoiceData.displayMode === "standard" ? "Detalhado" : "Descritivo"}</span>
             <button onClick={toggleDisplayMode} className="text-xs bg-white border border-blue-200 px-3 py-1 rounded text-blue-600 font-bold hover:bg-blue-100">Alternar</button>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Título do Procedimento</label>
            <input type="text" className="w-full border border-gray-300 p-2 rounded text-sm"
              value={invoiceData.procedureTitle} onChange={(e) => setInvoiceData({ ...invoiceData, procedureTitle: e.target.value })}
            />
          </div>

          <hr className="border-gray-200" />

          <div>
            <h3 className="text-xs font-bold text-gray-700 uppercase mb-2">Itens</h3>
            <div className="space-y-2">
              {invoiceData.items.map((item, index) => (
                <div key={index} className="flex gap-2 items-start bg-gray-50 p-2 rounded border border-gray-200 hover:border-blue-300 transition-colors">
                  <div className="w-14">
                    <input 
                      type={invoiceData.displayMode === "standard" ? "number" : "text"} 
                      className="w-full border p-1 rounded text-center text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Qtd" value={item.qty || ""} 
                      onChange={(e) => handleItemChange(index, "qty", e.target.value)}
                      onPaste={(e) => handleSmartPaste(e, 'item', index)} // <--- SMART PASTE AQUI
                      title="Copie (Qtd + Descrição + Preço) do Excel e cole aqui"
                    />
                  </div>
                  <div className="flex-grow">
                    <textarea rows={1} className="w-full border p-1 rounded text-xs resize-y focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Descrição"
                      value={item.description || ""} onChange={(e) => handleItemChange(index, "description", e.target.value)}
                    />
                  </div>
                  {invoiceData.displayMode === "standard" && (
                    <div className="w-24">
                      <input type="number" className="w-full border p-1 rounded text-right text-xs" placeholder="Preço"
                        value={item.price || ""} onChange={(e) => handleItemChange(index, "price", e.target.value)}
                      />
                    </div>
                  )}
                  <button onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="text-blue-600 text-xs font-bold mt-3 flex items-center gap-1 hover:underline"><Plus size={14} /> Adicionar Linha</button>
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t p-4 bg-white shadow-lg z-20 flex-shrink-0">
          <div className="flex justify-between items-center mb-3 bg-gray-800 text-white p-3 rounded-lg">
            <span className="text-xs font-medium uppercase text-gray-300">Total</span>
            {invoiceData.displayMode === "standard" ? (
              <span className="text-xl font-bold tracking-tight">{invoiceData.grandTotal.toLocaleString("pt-PT")} MT</span>
            ) : (
              <input type="number" value={invoiceData.grandTotal} onChange={(e) => setInvoiceData({ ...invoiceData, grandTotal: parseFloat(e.target.value) || 0 })}
                className="bg-gray-700 text-white font-bold text-xl w-32 p-1 rounded text-right border-none outline-none"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white p-2 rounded font-bold text-sm flex justify-center items-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar
            </button>
            <button onClick={() => handlePrint()} className="bg-blue-800 hover:bg-blue-900 text-white p-2 rounded font-bold text-sm">
              Imprimir
            </button>
          </div>
        </div>

        {/* --- EXCEL PANEL (ESTILO EXCEL REAL) --- */}
        {hasExcelData && (
          <div 
            className="flex-shrink-0 border-t-4 border-green-600 bg-white relative flex flex-col shadow-[0_-10px_25px_rgba(0,0,0,0.15)] transition-height duration-100 ease-out"
            style={{ height: `${excelHeight}px` }}
          >
            {/* DRAG HANDLE */}
            <div 
              onMouseDown={(e) => { e.preventDefault(); setIsResizingHeight(true); document.body.style.cursor = "row-resize"; }}
              className="absolute -top-3 left-0 w-full h-6 cursor-row-resize flex justify-center items-center group z-30 hover:scale-105 transition-transform"
            >
               <div className="w-16 h-1.5 bg-gray-300 group-hover:bg-green-600 rounded-full shadow-sm border border-white"></div>
            </div>

            {/* BARRA DE TÍTULO EXCEL */}
            <div className="bg-[#107c41] text-white flex justify-between items-center px-3 py-1 select-none">
                <div className="flex items-center gap-2 text-xs font-semibold">
                    <FileSpreadsheet size={14} className="text-white"/> Visualização Excel
                </div>
                <span className="text-[10px] opacity-80">Segure Shift para selecionar múltiplas células</span>
            </div>

            {/* TABELA ESTILO EXCEL */}
            <div className="overflow-auto flex-grow custom-scrollbar bg-gray-100">
              <table className="border-collapse w-full text-xs font-sans bg-white">
                <thead className="sticky top-0 z-10">
                    <tr>
                        {/* Canto superior esquerdo */}
                        <th className="bg-gray-100 border-r border-b border-gray-300 w-10 min-w-[40px]"></th>
                        {/* Gera colunas A, B, C, D dinamicamente baseado na maior linha */}
                        {invoiceData.rawData[0] && invoiceData.rawData[0].map((_, i) => (
                            <th key={i} className="bg-gray-100 border-r border-b border-gray-300 px-2 py-1 font-normal text-gray-600 min-w-[80px]">
                                {getColumnLetter(i)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                  {invoiceData.rawData.map((rData, rIdx) => (
                    <tr key={rIdx} className="h-6">
                      {/* Número da Linha (1, 2, 3...) */}
                      <td className="bg-gray-100 border-r border-b border-gray-300 text-center text-gray-600 font-normal select-none w-10">
                          {rIdx + 1}
                      </td>
                      {/* Células de Dados */}
                      {rData.map((cell, cIdx) => (
                        <td key={cIdx} 
                            className="border-r border-b border-gray-300 px-2 py-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] cursor-cell hover:border-2 hover:border-green-500 hover:z-10 relative selection:bg-green-100 selection:text-green-900"
                            title={String(cell)}
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
        )}

      </div>

      {/* --- DRAG HANDLE VERTICAL --- */}
      <div
        className="w-4 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex items-center justify-center transition-all z-30 shadow-lg border-l border-r border-gray-300 relative group"
        onMouseDown={(e) => { e.preventDefault(); setIsResizingWidth(true); document.body.style.cursor = "col-resize"; }}
      >
         <GripVertical size={16} className="text-gray-400 group-hover:text-white" />
      </div>

      {/* --- PREVIEW --- */}
      <div className="flex-1 bg-gray-600 overflow-y-auto flex justify-center p-8 custom-scrollbar">
        <div className="scale-[0.8] origin-top shadow-2xl transition-transform duration-300 ease-in-out hover:scale-[0.85]">
          <InvoiceTemplate ref={componentRef} data={invoiceData} />
        </div>
      </div>

    </div>
  );
}

// Ícone Auxiliar que faltava no import
function FileSpreadsheet({size, className}) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
            <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
            <path d="M8 13h2"/>
            <path d="M8 17h2"/>
            <path d="M14 13h2"/>
            <path d="M14 17h2"/>
        </svg>
    )
}
