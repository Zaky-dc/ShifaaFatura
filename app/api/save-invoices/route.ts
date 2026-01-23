import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase"; 
import { ref, runTransaction, update } from "firebase/database";

// Force dynamic to avoid static caching issues
export const dynamic = 'force-dynamic';

interface ImportedInvoice {
  patient: string;
  procedure: string;
  date: string;
  total: string;
  sheetName: string;
  rawData?: any[]; // Allow rawData
}

export async function POST(req: NextRequest) {
  try {
    const { invoices } = await req.json();

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json({ error: "No invoices provided" }, { status: 400 });
    }

    // Filter valid invoices
    const validInvoices = invoices.filter((inv: ImportedInvoice) => 
        inv.patient && inv.total && inv.patient !== "ERRO"
    );

    if (validInvoices.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: "No valid invoices to save." });
    }

    const count = validInvoices.length;
    const counterRef = ref(db, 'settings/invoiceCounter');

    // 1. Reserve a block of IDs atomically
    let startId = 0;
    await runTransaction(counterRef, (currentValue) => {
      // If null, assume 3977 as base
      const current = currentValue || 3977;
      startId = current + 1;
      return current + count;
    });

    // 2. Prepare atomic update object
    const updates: Record<string, any> = {};

    validInvoices.forEach((inv, index) => {
        const id = startId + index;
        const cleanTotal = parseFloat(inv.total.toString().replace(/[^0-9.]/g, ''));
        const finalTotal = isNaN(cleanTotal) ? 0 : cleanTotal;

        const newInvoice = {
            id: id,
            invoiceNumber: id,
            patientName: inv.patient,
            procedureTitle: inv.procedure || "Procedimento Importado",
            date: inv.date || new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            // Financials
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
            // Metadata
            source: 'excel_import',
            originalSheet: inv.sheetName,
            // Save raw entries for previewing later
            rawData: inv.rawData || []
        };

        updates[`invoices/${id}`] = newInvoice;
    });

    // 3. Commit all writes at once
    await update(ref(db), updates);

    return NextResponse.json({ success: true, count: count });

  } catch (error: any) {
    console.error("Error saving invoices:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
