import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase"; 
import { ref, get, update } from "firebase/database";

export const dynamic = 'force-dynamic';

// Helper to chunk array
const chunkArray = (array: any[], size: number) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

// MUDANÇA: Agora é POST porque recebemos um corpo JSON com a passkey
export async function POST(req: NextRequest) {
  try {
    // 1. Ler e Validar a Senha
    const { passkey } = await req.json();

    if (!passkey) {
        return NextResponse.json({ error: "Senha necessária" }, { status: 401 });
    }

    // Verificar senha no Firebase
    const passkeyRef = ref(db, 'settings/adminPasskey');
    const passkeySnap = await get(passkeyRef);
    // Senha padrão '091093' se não houver configuração
    const validPasskey = passkeySnap.exists() ? passkeySnap.val() : "091093"; 

    if (passkey !== validPasskey) {
        return NextResponse.json({ error: "Senha incorreta!" }, { status: 403 });
    }

    // 2. Lógica de Eliminação (Mantida do teu código original)
    const invoicesRef = ref(db, 'invoices');
    const snapshot = await get(invoicesRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ success: true, count: 0, message: "No data found." });
    }

    const data = snapshot.val();
    const invoicesToDelete: string[] = [];

    // Filtrar em memória (source === 'excel_import')
    Object.entries(data).forEach(([key, value]: [string, any]) => {
        if (value.source === 'excel_import') {
            invoicesToDelete.push(key);
        }
    });

    if (invoicesToDelete.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: "Nenhuma fatura importada encontrada." });
    }

    // Batch delete in chunks
    const chunks = chunkArray(invoicesToDelete, 500);
    let totalDeleted = 0;

    for (const chunk of chunks) {
        const updates: Record<string, any> = {};
        chunk.forEach(key => {
            updates[`invoices/${key}`] = null;
        });
        
        await update(ref(db), updates);
        totalDeleted += chunk.length;
    }

    return NextResponse.json({ success: true, count: totalDeleted });

  } catch (error: any) {
    console.error("Error deleting imported invoices:", error);
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}
