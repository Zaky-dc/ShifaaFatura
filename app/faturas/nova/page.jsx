"use client";
import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import { InvoiceTemplate } from '@/components/InvoiceTemplate';
import { createInvoice, updateInvoice, getInvoiceById } from '@/lib/invoiceService';
import { Plus, Trash2, Save, ArrowLeft, Calendar, Phone, CreditCard } from 'lucide-react';

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
  
  const invoiceId = searchParams.get('id');
  const mode = searchParams.get('mode'); // 'edit' | 'clone'

  const componentRef = useRef();
  const [loading, setLoading] = useState(false);
  
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '', 
    clientName: '', 
    patientName: '',
    patientNid: '',
    patientContact: '', // Já tínhamos no estado, faltava o input
    date: new Date().toISOString().split('T')[0],
    dueDate: '', // Data de expiração
    procedureTitle: '',
    grandTotal: 0,
    items: [{ qty: 1, description: 'Consulta', price: 0, total: 0 }]
  });

  // --- CARREGAR DADOS ---
  useEffect(() => {
    async function loadInvoice() {
        if (!invoiceId) return;

        setLoading(true);
        const data = await getInvoiceById(invoiceId);
        
        if (data) {
            if (mode === 'clone') {
                setInvoiceData({
                    ...data,
                    invoiceNumber: '',
                    date: new Date().toISOString().split('T')[0],
                    dueDate: '' // Limpa a validade ao clonar
                });
            } else if (mode === 'edit') {
                setInvoiceData(data);
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

    if (field === 'qty' || field === 'price') {
        const q = parseFloat(item.qty) || 0;
        const p = parseFloat(item.price) || 0;
        item.total = q * p;
    }
    const newGrandTotal = newItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
    setInvoiceData({ ...invoiceData, items: newItems, grandTotal: newGrandTotal });
  };

  const addItem = () => {
    setInvoiceData({
        ...invoiceData,
        items: [...invoiceData.items, { qty: 1, description: '', price: 0, total: 0 }]
    });
  };

  const removeItem = (index) => {
    const newItems = invoiceData.items.filter((_, i) => i !== index);
    const newGrandTotal = newItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
    setInvoiceData({ ...invoiceData, items: newItems, grandTotal: newGrandTotal });
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Proforma_${invoiceData.clientName || invoiceData.patientName || 'Documento'}`,
  });

  const handleSave = async () => {
    if(!invoiceData.patientName) return alert("Preencha o nome do paciente");
    
    setLoading(true);
    try {
        if (mode === 'edit' && invoiceData.invoiceNumber) {
            await updateInvoice(invoiceData.invoiceNumber, invoiceData);
            alert("Fatura atualizada com sucesso!");
        } else {
            const num = await createInvoice(invoiceData);
            setInvoiceData(prev => ({ ...prev, invoiceNumber: num }));
            alert(`Fatura ${num} gerada com sucesso!`);
            if (mode === 'clone') router.push(`/faturas/nova?id=${num}&mode=edit`);
        }
    } catch(e) { 
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
             <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm font-medium">
                <ArrowLeft size={16}/> Voltar
             </button>
             <h1 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                {mode === 'edit' ? `Editando #${invoiceData.invoiceNumber}` : mode === 'clone' ? 'Nova Cópia' : 'Nova Fatura'}
             </h1>
        </div>
        
        {/* Formulário com Scroll */}
        <div className="flex-grow overflow-y-auto p-6 space-y-4">
            
            {/* SEGURADORA & PACIENTE */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Seguradora / Cliente</label>
                    <input type="text" className="w-full border border-gray-300 p-2 rounded text-sm bg-blue-50 focus:bg-white transition-colors"
                        value={invoiceData.clientName}
                        onChange={e => setInvoiceData({...invoiceData, clientName: e.target.value})}
                        placeholder="Ex: Mediplus"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Nome Paciente *</label>
                    <input type="text" className="w-full border border-gray-300 p-2 rounded text-sm font-semibold"
                        value={invoiceData.patientName}
                        onChange={e => setInvoiceData({...invoiceData, patientName: e.target.value})}
                        placeholder="Nome completo"
                    />
                </div>
            </div>

            {/* NID & CONTACTO (Novo campo aqui) */}
            <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">NID / Identificação</label>
                    <div className="relative">
                        <CreditCard size={14} className="absolute left-2 top-2.5 text-gray-400"/>
                        <input type="text" className="w-full border border-gray-300 p-2 pl-8 rounded text-sm"
                            value={invoiceData.patientNid}
                            onChange={e => setInvoiceData({...invoiceData, patientNid: e.target.value})}
                            placeholder="Número BI/Passaporte"
                        />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Contacto Telefónico</label>
                    <div className="relative">
                        <Phone size={14} className="absolute left-2 top-2.5 text-gray-400"/>
                        <input type="text" className="w-full border border-gray-300 p-2 pl-8 rounded text-sm"
                            value={invoiceData.patientContact}
                            onChange={e => setInvoiceData({...invoiceData, patientContact: e.target.value})}
                            placeholder="84/82..."
                        />
                    </div>
                 </div>
            </div>

            {/* DATAS (Emissão & Validade) */}
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Data Emissão</label>
                    <input type="date" className="w-full border border-gray-300 p-1.5 rounded text-sm"
                        value={invoiceData.date}
                        onChange={e => setInvoiceData({...invoiceData, date: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Válido Até (Expira)</label>
                    <input type="date" className="w-full border border-gray-300 p-1.5 rounded text-sm text-red-600 font-medium"
                        value={invoiceData.dueDate}
                        onChange={e => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                    />
                 </div>
            </div>

            {/* Título do Procedimento */}
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Título do Procedimento</label>
                <input type="text" className="w-full border border-gray-300 p-2 rounded text-sm"
                    value={invoiceData.procedureTitle}
                    onChange={e => setInvoiceData({...invoiceData, procedureTitle: e.target.value})}
                    placeholder="Ex: Pequena Cirurgia..."
                />
            </div>

            <hr className="border-gray-200"/>

            {/* Lista de Itens */}
            <div>
                <h3 className="text-xs font-bold text-gray-700 uppercase mb-2">Itens da Fatura</h3>
                <div className="space-y-2">
                    {invoiceData.items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-start bg-gray-50 p-2 rounded border border-gray-200 hover:border-blue-300 transition-colors">
                            <div className='w-14'>
                                <input type="number" className="w-full border p-1 rounded text-center text-xs" placeholder="Qtd"
                                    value={item.qty} onChange={e => handleItemChange(index, 'qty', e.target.value)} />
                            </div>
                            <div className='flex-grow'>
                                <input type="text" className="w-full border p-1 rounded text-xs" placeholder="Descrição"
                                    value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} />
                            </div>
                            <div className='w-24'>
                                <input type="number" className="w-full border p-1 rounded text-right text-xs" placeholder="Preço"
                                    value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value)} />
                            </div>
                            <button onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-500 p-1">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
                <button onClick={addItem} className="text-blue-600 text-xs font-bold mt-3 flex items-center gap-1 hover:underline">
                    <Plus size={14}/> Adicionar Linha
                </button>
            </div>
        </div>

        {/* Rodapé Fixo (Ações) */}
        <div className="border-t p-4 bg-white z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
             <div className="flex justify-between items-center mb-3 bg-gray-800 text-white p-3 rounded-lg">
                <span className="text-xs font-medium uppercase text-gray-300">Total Estimado</span>
                <span className="text-xl font-bold tracking-tight">{invoiceData.grandTotal.toLocaleString('pt-PT')} MT</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={handleSave} 
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg font-bold flex justify-center gap-2 items-center transition-all disabled:opacity-50 text-sm"
                >
                    <Save size={18}/> {loading ? 'Aguarde...' : (mode === 'edit' ? 'Salvar Alterações' : 'Salvar Fatura')}
                </button>
                <button 
                    onClick={() => handlePrint()} 
                    className="bg-blue-800 hover:bg-blue-900 text-white p-3 rounded-lg font-bold flex justify-center gap-2 items-center transition-all text-sm"
                >
                    <span className="hidden sm:inline">Imprimir / PDF</span> <span className="sm:hidden">PDF</span>
                </button>
            </div>
        </div>
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