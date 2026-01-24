"use client";
import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { db } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { createInvoice, updateInvoice, getInvoiceById } from "@/lib/invoiceService";
import { 
  Plus, Trash2, Save, ArrowLeft, Phone, CreditCard, Loader2, 
  GripVertical, FileSpreadsheet, WrapText, Pin, PinOff, 
  User, Calendar, Briefcase, Hash, Printer, LayoutTemplate
} from "lucide-react";

export default function NovaFaturaPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-blue-600 font-bold"><Loader2 className="animate-spin mr-2"/> Carregando editor...</div>}>
      <NovaFaturaContent />
    </Suspense>
  );
}

function NovaFaturaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("id");
  const mode = searchParams.get("mode");
  
  // REF PARA IMPRESSÃO
  const componentRef = useRef();
  
  // REFS GERAIS
  const sidebarRef = useRef(null);
  const tableRef = useRef(null); 

  // STATES
  const [loading, setLoading] = useState(false);
  const [nextNumberPreview, setNextNumberPreview] = useState(null);
  
  // Layout States
  const [sidebarWidth, setSidebarWidth] = useState(45);
  const [excelHeight, setExcelHeight] = useState(350);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  
  // Excel View States
  const [isExcelDocked, setIsExcelDocked] = useState(true);
  const [isTextWrapped, setIsTextWrapped] = useState(true); 
  const [selection, setSelection] = useState({ start: null, end: null, isSelecting: false });
  const [colWidths, setColWidths] = useState({});
  const [resizingCol, setResizingCol] = useState(null);

  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: "", clientName: "", patientName: "", patientNid: "", patientContact: "",
    date: new Date().toISOString().split("T")[0], dueDate: "", procedureTitle: "", grandTotal: 0,
    items: [{ qty: 1, description: "", price: 0, total: 0 }],
    displayMode: "standard", rawData: [],
  });

  // --- CONFIGURAÇÃO DE IMPRESSÃO ---
  const handlePrint = useReactToPrint({
    contentRef: componentRef, // Nova sintaxe para react-to-print mais recente
    documentTitle: `Proforma_${invoiceData.clientName || "Documento"}`,
    // Força A4 e remove margens padrão do browser
    pageStyle: `
      @page { size: A4; margin: 0mm; } 
      @media print { 
        body { -webkit-print-color-adjust: exact; } 
        html, body { height: 100vh; margin: 0 !important; padding: 0 !important; overflow: visible; }
      }
    `,
  });

  // --- LOGICA DE DADOS, EXCEL, PASTE E RESIZE (MANTIDA IGUAL) ---
  // (Esta lógica é a mesma que já aprovaste, mantive para garantir que o backend funciona)
  
  const handleSmartPaste = (e, fieldType, index = null) => {
    const clipboardText = e.clipboardData.getData('text');
    const rows = clipboardText.trim().split(/\r\n|\n|\r/);
    const firstRowCols = rows[0].split('\t');
    if (rows.length === 1 && firstRowCols.length < 2) return;
    e.preventDefault();
    if (fieldType === 'patient') {
        setInvoiceData(prev => ({...prev, patientName: firstRowCols[0] || prev.patientName, patientNid: firstRowCols[1] || prev.patientNid, patientContact: firstRowCols[2] || prev.patientContact}));
    }
    if (fieldType === 'item' && index !== null) {
        const newItems = [...invoiceData.items];
        if (newItems[index].description === "" && newItems[index].price === 0) newItems.splice(index, 1);
        rows.forEach(rowStr => {
            const cols = rowStr.split('\t');
            const isFirstNumber = !isNaN(parseFloat(cols[0]));
            let qty = 1, desc = "", price = 0;
            if (isFirstNumber && cols.length > 1) { qty = parseFloat(cols[0]) || 1; desc = cols[1] || ""; price = cols[2] ? parseFloat(cols[2].replace(/[^0-9,.]/g, '').replace(',', '.')) : 0; } 
            else { desc = cols[0]; price = cols[1] ? parseFloat(cols[1].replace(/[^0-9,.]/g, '').replace(',', '.')) : 0; }
            newItems.push({ qty, description: desc, price, total: qty * price });
        });
        const total = newItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
        setInvoiceData(prev => ({ ...prev, items: newItems, grandTotal: total }));
    }
  };

  const handleMouseDown = (r, c) => setSelection({ start: { r, c }, end: { r, c }, isSelecting: true });
  const handleMouseEnter = (r, c) => { if (selection.isSelecting) setSelection(prev => ({ ...prev, end: { r, c } })); };
  const handleMouseUp = () => { setSelection(prev => ({ ...prev, isSelecting: false })); setResizingCol(null); setIsResizingWidth(false); setIsResizingHeight(false); document.body.style.cursor = "default"; document.body.style.userSelect = "auto"; };

  useEffect(() => {
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selection.start) {
            // Lógica de cópia (simplificada para brevidade, igual à anterior)
            const startR = Math.min(selection.start.r, selection.end.r), endR = Math.max(selection.start.r, selection.end.r);
            const startC = Math.min(selection.start.c, selection.end.c), endC = Math.max(selection.start.c, selection.end.c);
            let text = ""; for (let r = startR; r <= endR; r++) { const row = []; for (let c = startC; c <= endC; c++) row.push(invoiceData.rawData[r]?.[c] || ""); text += row.join("\t") + "\n"; }
            navigator.clipboard.writeText(text);
        }
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, invoiceData.rawData]);

  const handleResizeMove = useCallback((e) => {
    if (isResizingWidth) { const w = (e.clientX / window.innerWidth) * 100; if (w > 25 && w < 75) setSidebarWidth(w); }
    if (isResizingHeight) { const h = window.innerHeight - e.clientY; if (h > 100 && h < window.innerHeight - 100) setExcelHeight(h); }
    if (resizingCol) { const diff = e.clientX - resizingCol.startX; setColWidths(prev => ({...prev, [resizingCol.index]: Math.max(40, resizingCol.startWidth + diff)})); }
  }, [isResizingWidth, isResizingHeight, resizingCol]);

  useEffect(() => { if (isResizingWidth || isResizingHeight || resizingCol) { window.addEventListener("mousemove", handleResizeMove); window.addEventListener("mouseup", handleMouseUp); document.body.style.userSelect = "none"; } return () => { window.removeEventListener("mousemove", handleResizeMove); window.removeEventListener("mouseup", handleMouseUp); }; }, [isResizingWidth, isResizingHeight, resizingCol, handleResizeMove]);

  useEffect(() => {
    if (!invoiceId || mode === 'clone') get(ref(db, 'settings/invoiceCounter')).then(s => setNextNumberPreview((s.val() || 3977) + 1));
    if (invoiceId) { setLoading(true); getInvoiceById(invoiceId).then(data => { if (data) { 
        const safeData = { invoiceNumber: "", clientName: "", patientName: "", patientNid: "", patientContact: "", date: new Date().toISOString().split("T")[0], dueDate: "", procedureTitle: "", grandTotal: 0, items: [{ qty: 1, description: "", price: 0, total: 0 }], displayMode: "standard", rawData: [], ...data };
        if (mode === "clone") setInvoiceData({ ...safeData, invoiceNumber: "", date: new Date().toISOString().split("T")[0], dueDate: "" }); else if (mode === "edit") setInvoiceData(safeData);
    } setLoading(false); }); }
  }, [invoiceId, mode]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...invoiceData.items]; const item = newItems[index]; item[field] = value;
    if (invoiceData.displayMode === "standard" && (field === "qty" || field === "price")) item.total = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
    const total = newItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
    setInvoiceData({ ...invoiceData, items: newItems, grandTotal: total });
  };
  const addItem = () => setInvoiceData({ ...invoiceData, items: [...invoiceData.items, { qty: 1, description: "", price: 0, total: 0 }] });
  const removeItem = (i) => { const items = invoiceData.items.filter((_, idx) => idx !== i); const total = items.reduce((acc, curr) => acc + (curr.total || 0), 0); setInvoiceData({ ...invoiceData, items, grandTotal: total }); };
  
  const handleSave = async () => {
      if (!invoiceData.patientName) return alert("Preencha o nome do paciente");
      setLoading(true);
      try {
          const payload = { ...invoiceData }; delete payload.source; delete payload.id;
          if (mode === "edit" && invoiceData.invoiceNumber) await updateInvoice(invoiceData.invoiceNumber, invoiceData);
          else await createInvoice(payload);
          alert("Sucesso!"); window.location.href = "/";
      } catch (e) { alert(e.message); }
      setLoading(false);
  };

  const getColLetter = (i) => String.fromCharCode(65 + i);
  const hasExcel = invoiceData.rawData && invoiceData.rawData.length > 0;
  const isCellSelected = (r, c) => selection.start && r >= Math.min(selection.start.r, selection.end.r) && r <= Math.max(selection.start.r, selection.end.r) && c >= Math.min(selection.start.c, selection.end.c) && c <= Math.max(selection.start.c, selection.end.c);

  // --- RENDER TABLE HELPER ---
  const renderExcelTableContent = () => (
    <table className="border-collapse text-[12px] font-sans bg-white cursor-cell w-max min-w-full">
        <thead className="sticky top-0 z-10 shadow-sm">
            <tr>
                <th className="w-10 bg-gray-100 border-r border-b border-gray-300 font-bold text-gray-500 select-none">#</th>
                {invoiceData.rawData[0].map((_, i) => {
                    const width = colWidths[i] || 120;
                    return (
                        <th key={i} className="bg-gray-100 border-r border-b border-gray-300 px-2 py-1 font-bold text-gray-700 text-center relative select-none" style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}>
                            {getColLetter(i)}
                            <div className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-green-400 opacity-0 hover:opacity-100 transition-opacity z-20" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setResizingCol({ index: i, startX: e.clientX, startWidth: width }); }} />
                        </th>
                    );
                })}
            </tr>
        </thead>
        <tbody ref={tableRef}>
            {invoiceData.rawData.map((row, rIdx) => (
                <tr key={rIdx} className={isTextWrapped ? "" : "h-6"}>
                    <td className="bg-gray-100 border-r border-b border-gray-300 text-center text-gray-500 font-semibold select-none sticky left-0">{rIdx + 1}</td>
                    {row.map((cell, cIdx) => {
                        const width = colWidths[cIdx] || 120; const selected = isCellSelected(rIdx, cIdx);
                        return (
                            <td key={cIdx} onMouseDown={() => handleMouseDown(rIdx, cIdx)} onMouseEnter={() => handleMouseEnter(rIdx, cIdx)}
                                className={`border-r border-b border-gray-300 px-2 py-1 relative ${isTextWrapped ? 'whitespace-pre-wrap break-words align-top h-auto' : 'whitespace-nowrap overflow-hidden text-ellipsis h-6'} ${selected ? 'bg-green-100 border-green-500 border-double z-10' : 'hover:bg-blue-50'}`}
                                style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, cursor: "url('data:image/svg+xml;utf8,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2V22M2 12H22\" stroke=\"white\" stroke-width=\"3\" filter=\"drop-shadow(0px 0px 1px black)\"/></svg>') 12 12, cell" }}
                                title={String(cell)}
                            >{String(cell)}</td>
                        )
                    })}
                </tr>
            ))}
            <tr className="h-24 bg-transparent border-none"><td colSpan={100} className="border-none"></td></tr>
        </tbody>
    </table>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans select-none md:select-auto" onMouseUp={handleMouseUp}>
      
      {/* SIDEBAR */}
      <div ref={sidebarRef} className="flex flex-col h-full bg-white shadow-2xl z-20 relative border-r border-gray-200" style={{ width: `${sidebarWidth}%`, minWidth: '380px' }}>
        
        {/* Header Fixo */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white flex-shrink-0">
          <button onClick={() => window.location.href = "/"} className="text-gray-500 hover:text-gray-800 flex items-center gap-2 text-sm font-semibold transition-colors">
            <div className="p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft size={18}/></div> Voltar
          </button>
          <div className="text-right">
             <h1 className="text-lg font-bold text-gray-800 tracking-tight">{mode === "edit" ? `Editando #${invoiceData.invoiceNumber}` : "Nova Fatura"}</h1>
             {mode !== "edit" && <span className="text-xs text-blue-600 font-mono font-medium bg-blue-50 px-2 py-0.5 rounded-full">ID Futuro: #{nextNumberPreview || '...'}</span>}
          </div>
        </div>

        {/* --- FORMULÁRIO MODERNO (SCROLLÁVEL) --- */}
        <div className="flex-grow overflow-y-auto bg-gray-50/50 p-6 space-y-6 pb-20 custom-scrollbar"> 
          
          {/* Section: Cliente & Paciente */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600"><User size={16}/></div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Dados do Paciente</h3>
             </div>

             <div className="space-y-4">
                {/* Cliente / Seguro */}
                <div className="group">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Cliente / Seguradora</label>
                    <div className="relative flex items-center">
                        <Briefcase size={16} className="absolute left-3 text-gray-400 group-focus-within:text-blue-500 transition-colors"/>
                        <input type="text" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all" 
                            value={invoiceData.clientName} onChange={e => setInvoiceData({...invoiceData, clientName: e.target.value})} placeholder="Ex: Mediplus, Particular..."/>
                    </div>
                </div>

                {/* Nome Paciente (Smart Paste) */}
                <div className="group">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1 flex justify-between">
                        <span>Nome Completo *</span>
                        <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded cursor-help" title="Copie 3 células do Excel (Nome, NID, Tel) e cole aqui">Smart Paste Ativo ✨</span>
                    </label>
                    <div className="relative flex items-center">
                        <User size={16} className="absolute left-3 text-gray-400 group-focus-within:text-blue-500 transition-colors"/>
                        <input type="text" className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-semibold text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                            value={invoiceData.patientName} onChange={e => setInvoiceData({...invoiceData, patientName: e.target.value})} onPaste={(e) => handleSmartPaste(e, 'patient')} placeholder="Cole aqui os dados do Excel..."/>
                    </div>
                </div>

                {/* Grid NID + Contacto */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="group">
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">NID / BI</label>
                        <div className="relative flex items-center">
                            <CreditCard size={16} className="absolute left-3 text-gray-400 group-focus-within:text-blue-500 transition-colors"/>
                            <input type="text" className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all" 
                                value={invoiceData.patientNid} onChange={e => setInvoiceData({...invoiceData, patientNid: e.target.value})}/>
                        </div>
                    </div>
                    <div className="group">
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Telefone</label>
                        <div className="relative flex items-center">
                            <Phone size={16} className="absolute left-3 text-gray-400 group-focus-within:text-blue-500 transition-colors"/>
                            <input type="text" className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all" 
                                value={invoiceData.patientContact} onChange={e => setInvoiceData({...invoiceData, patientContact: e.target.value})}/>
                        </div>
                    </div>
                </div>
             </div>
          </div>

          {/* Section: Detalhes da Fatura */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <div className="bg-purple-100 p-1.5 rounded-lg text-purple-600"><Calendar size={16}/></div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Detalhes</h3>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="group">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Data Emissão</label>
                    <input type="date" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-100 focus:border-purple-500 outline-none transition-all" 
                        value={invoiceData.date} onChange={e => setInvoiceData({...invoiceData, date: e.target.value})}/>
                </div>
                <div className="group">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Válido Até</label>
                    <input type="date" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-red-600 font-medium focus:bg-white focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none transition-all" 
                        value={invoiceData.dueDate} onChange={e => setInvoiceData({...invoiceData, dueDate: e.target.value})}/>
                </div>
             </div>

             <div className="group">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Título do Procedimento</label>
                <div className="relative flex items-center">
                    <LayoutTemplate size={16} className="absolute left-3 text-gray-400 group-focus-within:text-purple-500 transition-colors"/>
                    <input type="text" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-100 focus:border-purple-500 outline-none transition-all" 
                        value={invoiceData.procedureTitle} onChange={e => setInvoiceData({...invoiceData, procedureTitle: e.target.value})} placeholder="Ex: Pequena Cirurgia (Excerto)"/>
                </div>
             </div>
          </div>
          
          {/* Section: Itens */}
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex justify-between items-center p-3 border-b border-gray-50 mb-2">
                <div className="flex items-center gap-2">
                    <div className="bg-green-100 p-1.5 rounded-lg text-green-600"><Hash size={16}/></div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Itens</h3>
                </div>
                <button onClick={toggleDisplayMode} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors">
                    {invoiceData.displayMode === 'standard' ? 'Modo Detalhado' : 'Modo Descritivo'}
                </button>
             </div>

             <div className="space-y-2 p-2">
                {invoiceData.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start group">
                    <div className="w-16">
                        <input type="number" className="w-full p-2 text-center text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none" 
                            placeholder="Qtd" value={item.qty} onChange={e => handleItemChange(i, 'qty', e.target.value)} onPaste={(e) => handleSmartPaste(e, 'item', i)} title="Cole linha do Excel aqui"/>
                    </div>
                    <div className="flex-grow">
                        <textarea rows={1} className="w-full p-2 text-sm bg-gray-50 border border-gray-200 rounded-lg resize-y focus:bg-white focus:ring-2 focus:ring-green-500 outline-none min-h-[38px]" 
                            placeholder="Descrição do item" value={item.description} onChange={e => handleItemChange(i, 'description', e.target.value)}/>
                    </div>
                    {invoiceData.displayMode === 'standard' && (
                        <div className="w-24">
                            <input type="number" className="w-full p-2 text-right text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none" 
                                placeholder="Preço" value={item.price} onChange={e => handleItemChange(i, 'price', e.target.value)}/>
                        </div>
                    )}
                    <button onClick={() => removeItem(i)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors self-start mt-0.5"><Trash2 size={16}/></button>
                </div>
                ))}
                
                <button onClick={addItem} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all text-xs font-bold flex justify-center items-center gap-2 mt-2">
                    <Plus size={14}/> Adicionar Linha
                </button>
             </div>
          </div>

          {/* EXCEL INLINE (Se não estiver fixo) */}
          {hasExcel && !isExcelDocked && (
             <div className="mt-8 border-t-4 border-green-600 rounded-t-lg overflow-hidden">
                 <div className="flex flex-col bg-white shadow-inner min-h-[400px]">
                    <div className="bg-[#107c41] text-white px-3 py-2 flex justify-between items-center select-none text-xs font-medium">
                        <div className="flex items-center gap-2"><FileSpreadsheet size={16}/> DADOS DO EXCEL</div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsTextWrapped(!isTextWrapped)} className="flex items-center gap-1 px-2 py-1 rounded border border-green-500 hover:bg-green-700 bg-green-800"><WrapText size={14}/> {isTextWrapped ? "Expandido" : "Cortar"}</button>
                            <button onClick={() => setIsExcelDocked(true)} className="flex items-center gap-1 px-2 py-1 rounded border bg-green-800 border-green-600 hover:bg-green-700"><Pin size={14}/> Fixar</button>
                        </div>
                    </div>
                    <div className="overflow-auto bg-gray-100 custom-scrollbar relative" onMouseLeave={handleMouseUp}>
                        {renderExcelTableContent()}
                    </div>
                 </div>
             </div>
          )}
        </div>

        {/* Footer Actions (Sempre Fixo) */}
        <div className="border-t p-4 bg-white shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20 flex-shrink-0">
           <div className="flex justify-between items-center mb-4 bg-gray-900 text-white p-3 rounded-xl shadow-lg">
              <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">Total Global</span>
              {invoiceData.displayMode === 'standard' 
                ? <span className="font-bold text-xl tracking-tight">{invoiceData.grandTotal.toLocaleString("pt-PT")} <span className="text-sm font-normal text-gray-400">MT</span></span> 
                : <div className="flex items-center gap-2"><input type="number" value={invoiceData.grandTotal} onChange={e => setInvoiceData({...invoiceData, grandTotal: parseFloat(e.target.value) || 0})} className="bg-gray-800 text-white text-right w-32 border-b border-gray-600 focus:border-white outline-none font-bold text-lg"/><span className="text-sm">MT</span></div>
              }
           </div>
           <div className="grid grid-cols-2 gap-3">
              <button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl text-sm font-bold flex justify-center items-center gap-2 shadow-green-200 shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0">
                  {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 
                  {loading ? "Salvando..." : mode === 'edit' ? "Atualizar Fatura" : "Salvar Fatura"}
              </button>
              <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl text-sm font-bold flex justify-center items-center gap-2 shadow-blue-200 shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0">
                  <Printer size={18}/> Imprimir
              </button>
           </div>
        </div>

        {/* EXCEL DOCKED (Fixo no fundo) */}
        {hasExcel && isExcelDocked && (
          <div className="flex-shrink-0 border-t-4 border-green-600 bg-white relative flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.2)] z-30 transition-height duration-100 ease-out" style={{ height: `${excelHeight}px` }}>
            <div onMouseDown={(e) => { e.preventDefault(); setIsResizingHeight(true); document.body.style.cursor = "row-resize"; }} className="absolute -top-3 left-0 w-full h-6 cursor-row-resize flex justify-center items-center group z-40 hover:scale-105"><div className="w-16 h-1.5 bg-gray-300 group-hover:bg-green-600 rounded-full border border-white shadow-sm"></div></div>
            
            <div className="bg-[#107c41] text-white px-3 py-2 flex justify-between items-center select-none text-xs font-medium flex-shrink-0">
                <div className="flex items-center gap-2"><FileSpreadsheet size={16}/> DADOS DO EXCEL</div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsTextWrapped(!isTextWrapped)} className="flex items-center gap-1 px-2 py-1 rounded border border-green-500 hover:bg-green-700 bg-green-800"><WrapText size={14}/> {isTextWrapped ? "Expandido" : "Cortar"}</button>
                    <button onClick={() => setIsExcelDocked(false)} className="flex items-center gap-1 px-2 py-1 rounded border bg-green-800 border-green-600 hover:bg-green-700"><PinOff size={14}/> Soltar</button>
                </div>
            </div>

            <div className="overflow-auto flex-grow bg-gray-100 custom-scrollbar relative" onMouseLeave={handleMouseUp}>
                {renderExcelTableContent()}
            </div>
          </div>
        )}
      </div>

      {/* Resize Handle Width */}
      <div onMouseDown={() => { setIsResizingWidth(true); document.body.style.cursor = "col-resize"; }} className="w-4 bg-gray-100 hover:bg-blue-500 cursor-col-resize flex items-center justify-center shadow-lg border-x border-gray-300 z-30 group transition-colors"><GripVertical size={16} className="text-gray-400 group-hover:text-white"/></div>

      {/* Preview */}
      <div className="flex-1 bg-gray-600 overflow-y-auto flex justify-center p-8 custom-scrollbar">
        <div className="scale-[0.8] origin-top shadow-2xl hover:scale-[0.85] transition-transform">
           <InvoiceTemplate ref={componentRef} data={invoiceData}/>
        </div>
      </div>
    </div>
  );
}
