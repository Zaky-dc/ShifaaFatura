import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase"; 
import { ref, update } from "firebase/database";

export const dynamic = 'force-dynamic';

interface ImportedInvoice {
  patient: string;
  procedure: string;
  date: string;
  total: string;
  sheetName: string;
  rawData?: any[];
}

export async function POST(req: NextRequest) {
  try {
    const { invoices } = await req.json();

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json({ error: "No invoices provided" }, { status: 400 });
    }

    // Filtrar faturas inválidas
    const validInvoices = invoices.filter((inv: ImportedInvoice) => 
        inv.patient && inv.total && inv.patient !== "ERRO"
    );

    if (validInvoices.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: "No valid invoices to save." });
    }

    const count = validInvoices.length;
    
    // --- MUDANÇA PRINCIPAL AQUI ---
    // Removemos a leitura e atualização do 'settings/invoiceCounter'.
    // Agora geramos IDs únicos baseados no Timestamp (Data/Hora atual).
    
    const updates: Record<string, any> = {};
    const timestamp = Date.now();

    validInvoices.forEach((inv, index) => {
        // Geramos um ID único: Timestamp + Index (para garantir que não repetem no mesmo milissegundo)
        // Ex: 1706258000000, 1706258000001, etc.
        const id = timestamp + index; 
        
        // Limpar o valor total (remover "MT", vírgulas, etc)
        const cleanTotal = parseFloat(inv.total.toString().replace(/[^0-9.]/g, ''));
        const finalTotal = isNaN(cleanTotal) ? 0 : cleanTotal;

        const newInvoice = {
            id: id,
            invoiceNumber: id, // O número da fatura será este código longo
            patientName: inv.patient,
            procedureTitle: inv.procedure || "Procedimento Importado",
            date: inv.date || new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            
            // Dados financeiros
            grandTotal: finalTotal,
            subTotal: finalTotal,
            discount: 0,
            tax: 0,
            status: "paid", 
            clientName: "Particular", 
            items: [{ 
                description: inv.procedure || "Procedimento Geral",
                quantity: 1,
                unitPrice: finalTotal,
                total: finalTotal
            }],
            
            // Metadados importantes
            source: 'excel_import', // Marca como importado
            originalSheet: inv.sheetName,
            rawData: inv.rawData || []
        };

        // Salva no caminho 'invoices/ID'
        updates[`invoices/${id}`] = newInvoice;
    });

    // Salvar tudo de uma vez (Batch Update)
    await update(ref(db), updates);

    return NextResponse.json({ success: true, count: count });

  } catch (error: any) {
    console.error("Error saving invoices:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
