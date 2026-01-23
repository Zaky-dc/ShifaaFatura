import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { ref, get, update } from "firebase/database";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { passkey } = await req.json();

    if (!passkey) {
        return NextResponse.json({ error: "Passkey required" }, { status: 401 });
    }

    // Verify passkey from DB
    const passkeyRef = ref(db, 'settings/adminPasskey');
    const passkeySnap = await get(passkeyRef);
    const validPasskey = passkeySnap.exists() ? passkeySnap.val() : "091093"; // Fallback if missing

    if (passkey !== validPasskey) {
        return NextResponse.json({ error: "Senha incorreta!" }, { status: 403 });
    }

    const invoicesRef = ref(db, 'invoices');
    const snapshot = await get(invoicesRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ message: "No invoices found to delete." });
    }

    const updates: Record<string, any> = {};
    let count = 0;

    snapshot.forEach((child) => {
      const val = child.val();
      // Delete if source IS NOT 'excel_import'
      if (val.source !== 'excel_import') {
        updates[child.key!] = null;
        count++;
      }
    });

    if (count > 0) {
        await update(invoicesRef, updates);
    }

    return NextResponse.json({ success: true, count, message: `Deleted ${count} active invoices.` });
  } catch (error: any) {
    console.error("Error deleting active invoices:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
