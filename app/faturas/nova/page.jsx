"use client";
import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { db } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { createInvoice, updateInvoice, getInvoiceById } from "@/lib/invoiceService";
import { Plus, Trash2, Save, ArrowLeft, Phone, CreditCard, Loader2, GripVertical, FileSpreadsheet } from "lucide-react";

export default function NovaFaturaPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
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
  
  // --- STATES ---
  const [loading, setLoading] = useState(false);
  const [nextNumberPreview, setNextNumberPreview] = useState(null);
  
  // Layout States
  const [sidebarWidth, setSidebarWidth] = useState(45);
  const [excelHeight, setExcelHeight] = useState(350);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const sidebarRef = useRef(null);

  // Excel Selection States
  const [selection, setSelection] = useState({ start: null, end: null, isSelecting: false });
  const tableRef = useRef(null);

  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: "", clientName: "", patientName: "", patientNid: "", patientContact: "",
    date: new Date().toISOString().split("T")[0], dueDate: "", procedureTitle: "", grandTotal: 0,
    items: [{ qty: 1, description: "", price: 0, total: 0 }],
    displayMode: "standard", rawData: [],
  });

  // --- SMART PASTE LOGIC ---
  const handleSmartPaste = (e, fieldType, index = null) => {
    const clipboardText = e.clipboardData.getData('text');
    // Divide linhas por \n e colunas por \t
    const rows = clipboardText.trim().split(/\r\n|\n|\r/);
    
    // Se for apenas uma célula simples, deixa o comportamento normal
    const firstRowCols = rows[0].split('\t');
    if (rows.length === 1 && firstRowCols.length < 2) return;

    e.preventDefault();

    if (fieldType === 'patient') {
        const values = firstRowCols;
        setInvoiceData(prev => ({
            ...prev,
            patientName: values[0] || prev.patientName,
            patientNid: values[1] || prev.patientNid,
            patientContact: values[2] || prev.patientContact
        }));
    }

    if (fieldType === 'item' && index !== null) {
        // Se copiar múltiplas linhas do Excel, adiciona múltiplos itens
        const newItems = [...invoiceData.items];
        
        // Remove o item vazio atual se estivermos colando por cima
        if (newItems[index].description === "" && newItems[index].price === 0) {
            newItems.splice(index, 1);
        }

        rows.forEach(rowStr => {
            const cols = rowStr.split('\t');
            const isFirstNumber = !isNaN(parseFloat(cols[0]));
            
            let qty = 1; 
            let desc = ""; 
            let price = 0;

            if (isFirstNumber && cols.length > 1) {
                qty = parseFloat(cols[0]) || 1;
                desc = cols[1] || "";
                price = cols[2] ? parseFloat(cols[2].replace(/[^0-9,.]/g, '').replace(',', '.')) : 0;
            } else {
                desc = cols[0];
                price = cols[1] ? parseFloat(cols[1].replace(/[^0-9,.]/g, '').replace(',', '.')) : 0;
            }

            newItems.push({ qty, description: desc, price, total: qty * price });
        });

        const newGrandTotal = newItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
        setInvoiceData(prev => ({ ...prev, items: newItems, grandTotal: newGrandTotal }));
    }
  };

  // --- EXCEL SELECTION LOGIC ---
  const handleMouseDown = (r, c) => {
    setSelection({ start: { r, c }, end: { r, c }, isSelecting: true });
  };

  const handleMouseEnter = (r, c) => {
    if (selection.isSelecting) {
        setSelection(prev => ({ ...prev, end: { r, c } }));
    }
  };

  const handleMouseUp = () => {
    setSelection(prev => ({ ...prev, isSelecting: false }));
  };

  // Copy Selection (Ctrl+C)
  useEffect(() => {
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            if (selection.start && selection.end && invoiceData.rawData.length > 0) {
                // Determine range
                const startR = Math.min(selection.start.r, selection.end.r);
                const endR = Math.max(selection.start.r, selection.end.r);
                const startC = Math.min(selection.start.c, selection.end.c);
                const endC = Math.max(selection.start.c, selection.end.c);

                // Build TSV string
                let textToCopy = "";
                for (let r = startR; r <= endR; r++) {
                    const rowData = [];
                    for (let c = startC; c <= endC; c++) {
                        const cellData = invoiceData.rawData[r] ? invoiceData.rawData[r][c] : "";
                        rowData.push(cellData || "");
                    }
                    textToCopy += rowData.join("\t") + "\n";
                }

                navigator.clipboard.writeText(textToCopy);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, invoiceData.rawData]);

  const isCellSelected = (r, c) => {
      if (!selection.start || !selection.end) return false;
      const minR = Math.min(selection.start.r, selection.end.r);
      const maxR = Math.max(selection.start.r, selection.end.r);
      const minC = Math.min(selection.start.c, selection.end.c);
      const maxC = Math.max(selection.start.c, selection.end.c);
      return r >= minR && r <= maxR && c >= minC && c <= maxC;
  };

  // --- RESIZING & DATA LOADING (Mantidos do anterior) ---
  const handleResizeMove = useCallback((e) => {
    if (isResizingWidth) {
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 25 && newWidth < 75) setSidebarWidth(newWidth);
    }
    if (isResizingHeight) {
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight > 100 && newHeight < window.innerHeight - 100) setExcelHeight(newHeight);
    }
  }, [isResizingWidth, isResizingHeight]);

  const handleResizeUp = useCallback(() => {
    setIsResizingWidth(false);
    setIsResizingHeight(false);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, []);

  useEffect(() => {
    if (isResizingWidth || isResizingHeight) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeUp);
      document.body.style.userSelect = "none"; 
    }
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeUp);
    };
  }, [isResizingWidth, isResizingHeight, handleResizeMove, handleResizeUp]);

  useEffect(() => {
    if (!invoiceId || mode === 'clone') {
        get(ref(db, 'settings/invoiceCounter')).then(s => setNextNumberPreview((s.val() || 3977) + 1));
    }
    if (invoiceId) {
        setLoading(true);
        getInvoiceById(invoiceId).then(data => {
            if (data) {
                const safeData = { invoiceNumber: "", clientName: "", patientName: "", patientNid: "", patientContact: "", date: new Date().toISOString().split("T")[0], dueDate: "", procedureTitle: "", grandTotal: 0, items: [{ qty: 1, description: "", price: 0, total: 0 }], displayMode: "standard", rawData: [], ...data };
                if (mode === "clone") setInvoiceData({ ...safeData, invoiceNumber: "", date: new Date().toISOString().split("T")[0], dueDate: "" });
                else if (mode === "edit") setInvoiceData(safeData);
            }
            setLoading(false);
        });
    }
  }, [invoiceId, mode]);

  // --- HANDLERS (Save, Print, Changes) ---
  const handleItemChange = (index, field, value) => {
    const newItems = [...invoiceData.items];
    const item = newItems[index];
    item[field] = value;
    if (invoiceData.displayMode === "standard" && (field === "qty" || field === "price")) {
        item.total = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
    }
    const total = newItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
    setInvoiceData({ ...invoiceData, items: newItems, grandTotal: total });
  };
  const addItem = () => setInvoiceData({ ...invoiceData, items: [...invoiceData.items, { qty: 1, description: "", price: 0, total: 0 }] });
  const removeItem = (i) => {
      const items = invoiceData.items.filter((_, idx) => idx !== i);
      const total = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
      setInvoiceData({ ...invoiceData, items, grandTotal: total });
  };
  const handleSave = async () => {
      if (!invoiceData.patientName) return alert("Preencha o nome");
      setLoading(true);
      try {
          const payload = { ...invoiceData };
          delete payload.source; delete payload.id;
          if (mode === "edit" && invoiceData.invoiceNumber) await updateInvoice(invoiceData.invoiceNumber, invoiceData);
          else await createInvoice(payload);
          alert("Sucesso!"); window.location.href = "/";
      } catch (e) { alert(e.message); }
      setLoading(false);
  };

  const getColLetter = (i) => String.fromCharCode(65 + i);
  const hasExcel = invoiceData.rawData && invoiceData.rawData.length > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans select-none md:select-auto" onMouseUp={handleMouseUp}>
      
      {/* SIDEBAR */}
      <div className="flex flex-col h-full bg-white shadow-2xl z-20 relative" style={{ width: `${sidebarWidth}%`, minWidth: '350px' }}>
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
          <button onClick={() => window.location.href = "/"} className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-xs font-medium"><ArrowLeft size={16}/> Voltar</button>
          <div className="text-right">
             <h1 className="text-sm font-bold text-gray-700 uppercase">{mode === "edit" ? "Editar" : "Nova Fatura"}</h1>
             {mode !== "edit" && <span className="text-xs text-blue-600 font-mono">Próximo: #{nextNumberPreview || '...'}</span>}
          </div>
        </div>

        {/* Form Scrollable */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Cliente / Seguro</label>
              <input type="text" className="w-full border p-2 rounded text-xs bg-blue-50" value={invoiceData.clientName} onChange={e => setInvoiceData({...invoiceData, clientName: e.target.value})} placeholder="Ex: Mediplus"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Paciente *</label>
              <input type="text" className="w-full border p-2 rounded text-xs font-bold" value={invoiceData.patientName} onChange={e => setInvoiceData({...invoiceData, patientName: e.target.value})} onPaste={(e) => handleSmartPaste(e, 'patient')} placeholder="Cole (Nome+NID+Tel)" title="Cole 3 células aqui"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
             <input type="text" className="border p-2 rounded text-xs" placeholder="NID" value={invoiceData.patientNid} onChange={e => setInvoiceData({...invoiceData, patientNid: e.target.value})}/>
             <input type="text" className="border p-2 rounded text-xs" placeholder="Contacto" value={invoiceData.patientContact} onChange={e => setInvoiceData({...invoiceData, patientContact: e.target.value})}/>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded border">
             <div><label className="text-[10px] font-bold">Data Emissão</label><input type="date" className="w-full border p-1 rounded text-xs" value={invoiceData.date} onChange={e => setInvoiceData({...invoiceData, date: e.target.value})}/></div>
             <div><label className="text-[10px] font-bold">Validade</label><input type="date" className="w-full border p-1 rounded text-xs text-red-600" value={invoiceData.dueDate} onChange={e => setInvoiceData({...invoiceData, dueDate: e.target.value})}/></div>
          </div>
          <div><label className="text-[10px] font-bold uppercase">Procedimento</label><input type="text" className="w-full border p-2 rounded text-xs" value={invoiceData.procedureTitle} onChange={e => setInvoiceData({...invoiceData, procedureTitle: e.target.value})}/></div>
          
          <hr/>
          <div className="space-y-1">
             <div className="flex justify-between items-center"><span className="text-xs font-bold">ITENS</span> <button onClick={() => setInvoiceData(prev => ({...prev, displayMode: prev.displayMode === 'standard' ? 'descriptive' : 'standard'}))} className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded">Modo: {invoiceData.displayMode}</button></div>
             {invoiceData.items.map((item, i) => (
               <div key={i} className="flex gap-1 items-start bg-gray-50 p-1 rounded border hover:border-blue-300">
                  <div className="w-12"><input type="number" className="w-full border p-1 text-center text-xs" placeholder="Qtd" value={item.qty} onChange={e => handleItemChange(i, 'qty', e.target.value)} onPaste={(e) => handleSmartPaste(e, 'item', i)} title="Cole linha do Excel aqui"/></div>
                  <div className="flex-grow"><textarea rows={1} className="w-full border p-1 text-xs resize-y" placeholder="Descrição" value={item.description} onChange={e => handleItemChange(i, 'description', e.target.value)}/></div>
                  {invoiceData.displayMode === 'standard' && <div className="w-20"><input type="number" className="w-full border p-1 text-right text-xs" placeholder="Preço" value={item.price} onChange={e => handleItemChange(i, 'price', e.target.value)}/></div>}
                  <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
               </div>
             ))}
             <button onClick={addItem} className="text-blue-600 text-xs font-bold flex items-center gap-1 mt-2"><Plus size={12}/> Adicionar Linha</button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t p-3 bg-white shadow-lg z-20 flex-shrink-0">
           <div className="flex justify-between items-center mb-2 bg-gray-800 text-white p-2 rounded">
              <span className="text-xs uppercase text-gray-300">Total</span>
              {invoiceData.displayMode === 'standard' 
                ? <span className="font-bold text-lg">{invoiceData.grandTotal.toLocaleString("pt-PT")} MT</span> 
                : <input type="number" value={invoiceData.grandTotal} onChange={e => setInvoiceData({...invoiceData, grandTotal: parseFloat(e.target.value) || 0})} className="bg-gray-700 text-white text-right w-24 border-none outline-none font-bold"/>
              }
           </div>
           <div className="grid grid-cols-2 gap-2">
              <button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white p-2 rounded text-xs font-bold flex justify-center items-center gap-1">{loading ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} Salvar</button>
              <button onClick={() => useReactToPrint({ contentRef: componentRef, documentTitle: "Fatura" })()} className="bg-blue-800 hover:bg-blue-900 text-white p-2 rounded text-xs font-bold">Imprimir</button>
           </div>
        </div>

        {/* === EXCEL PANEL (Bottom Docked) === */}
        {hasExcel && (
          <div className="flex-shrink-0 border-t-4 border-green-600 bg-white relative flex flex-col shadow-[0_-10px_25px_rgba(0,0,0,0.15)]" style={{ height: `${excelHeight}px` }}>
            {/* Drag Handle */}
            <div onMouseDown={() => { setIsResizingHeight(true); document.body.style.cursor = "row-resize"; }} className="absolute -top-3 left-0 w-full h-6 cursor-row-resize flex justify-center items-center group z-30"><div className="w-16 h-1.5 bg-gray-300 group-hover:bg-green-600 rounded-full border border-white shadow-sm"></div></div>
            
            {/* Excel Header */}
            <div className="bg-[#107c41] text-white px-2 py-1 flex justify-between items-center select-none text-[10px]">
                <div className="flex items-center gap-1 font-bold"><FileSpreadsheet size={12}/> EXCEL DATA</div>
                <span className="opacity-80">Selecione e copie (Ctrl+C)</span>
            </div>

            {/* Excel Table */}
            <div className="overflow-auto flex-grow bg-gray-100 custom-scrollbar relative" onMouseLeave={handleMouseUp}>
                <table className="border-collapse w-full text-[11px] font-sans bg-white cursor-cell table-fixed">
                    <thead className="sticky top-0 z-10">
                        <tr>
                            <th className="w-8 bg-gray-100 border-r border-b border-gray-300"></th>
                            {invoiceData.rawData[0].map((_, i) => (
                                <th key={i} className="bg-gray-100 border-r border-b border-gray-300 px-2 py-0.5 font-normal text-gray-600 min-w-[80px]">{getColLetter(i)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody ref={tableRef}>
                        {invoiceData.rawData.map((row, rIdx) => (
                            <tr key={rIdx} className="h-5">
                                <td className="bg-gray-100 border-r border-b border-gray-300 text-center text-gray-500 select-none">{rIdx + 1}</td>
                                {row.map((cell, cIdx) => {
                                    const selected = isCellSelected(rIdx, cIdx);
                                    return (
                                        <td key={cIdx} 
                                            onMouseDown={() => handleMouseDown(rIdx, cIdx)}
                                            onMouseEnter={() => handleMouseEnter(rIdx, cIdx)}
                                            className={`border-r border-b border-gray-300 px-2 py-0.5 whitespace-nowrap overflow-hidden text-ellipsis relative
                                                ${selected ? 'bg-green-100 border-green-500 border-double' : ''}`}
                                            style={{ 
                                                cursor: "url('data:image/svg+xml;utf8,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2V22M2 12H22\" stroke=\"white\" stroke-width=\"3\" filter=\"drop-shadow(0px 0px 1px black)\"/></svg>') 12 12, cell" 
                                            }}
                                        >
                                            {String(cell)}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        )}
      </div>

      {/* Resize Handle Width */}
      <div onMouseDown={() => { setIsResizingWidth(true); document.body.style.cursor = "col-resize"; }} className="w-4 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex items-center justify-center shadow-lg border-x border-gray-300 z-30 group"><GripVertical size={16} className="text-gray-400 group-hover:text-white"/></div>

      {/* Preview */}
      <div className="flex-1 bg-gray-600 overflow-y-auto flex justify-center p-8 custom-scrollbar">
        <div className="scale-[0.8] origin-top shadow-2xl hover:scale-[0.85] transition-transform">
           <InvoiceTemplate ref={componentRef} data={invoiceData}/>
        </div>
      </div>
    </div>
  );
}
