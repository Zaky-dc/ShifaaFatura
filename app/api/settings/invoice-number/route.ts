import { NextRequest, NextResponse } from "next/server";
import { ref, get, set } from "firebase/database";
import { db } from "@/lib/firebase"; 

// Force dynamic
export const dynamic = 'force-dynamic';

// GET: Fetch current invoice counter
export async function GET(req: NextRequest) {
  try {
    const counterRef = ref(db, "settings/invoiceCounter");
    const snapshot = await get(counterRef);

    let current = 1;
    if (snapshot.exists()) {
      current = snapshot.val();
      // Handle object structure if accidentally created
      if (typeof current === 'object' && current !== null && 'value' in current) {
         current = (current as any).value; 
      }
    }

    return NextResponse.json({ success: true, counter: current });
  } catch (error) {
    console.error("Error fetching invoice settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// POST: Update invoice counter
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { newCounter } = body;

    const parsed = parseInt(newCounter, 10);
    if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: "Invalid counter value" }, { status: 400 });
    }

    // Directly set the new value. 
    await set(ref(db, "settings/invoiceCounter"), parsed);

    return NextResponse.json({ success: true, counter: parsed });
  } catch (error) {
    console.error("Error updating invoice settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
