import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase"; 
import { ref, get, update } from "firebase/database";

// Force dynamic
export const dynamic = 'force-dynamic';

// Helper to chunk array
const chunkArray = (array: any[], size: number) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

export async function DELETE(req: NextRequest) {
  try {
    const invoicesRef = ref(db, 'invoices');
    
    // 1. Fetch ALL invoices (keys and minimal data preferably, but RTDB fetches all)
    // We cannot use orderByChild('source') because it requires an index in Rules which we can't set.
    // So we fetch global list and filter in memory. This is heavy but safe from "Index fail".
    const snapshot = await get(invoicesRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ success: true, count: 0, message: "No data found." });
    }

    const data = snapshot.val();
    const invoicesToDelete: string[] = [];

    // 2. Filter in memory
    Object.entries(data).forEach(([key, value]: [string, any]) => {
        if (value.source === 'excel_import') {
            invoicesToDelete.push(key);
        }
    });

    if (invoicesToDelete.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: "No imported invoices found to delete." });
    }

    // 3. Batch delete in chunks
    const chunks = chunkArray(invoicesToDelete, 500);
    let totalDeleted = 0;

    for (const chunk of chunks) {
        const updates: Record<string, any> = {};
        chunk.forEach(key => {
            updates[`invoices/${key}`] = null;
        });
        
        // Execute batch update
        await update(ref(db), updates);
        totalDeleted += chunk.length;
    }

    return NextResponse.json({ success: true, count: totalDeleted });

  } catch (error: any) {
    console.error("Error deleting imported invoices:", error);
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}
