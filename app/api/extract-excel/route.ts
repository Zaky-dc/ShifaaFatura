import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// Helper to clean strings
const cleanText = (text: any) => {
  if (!text) return "";
  return String(text).trim();
};

// Helper to parse date
const parseDate = (value: any) => {
  if (!value) return "";
  if (value instanceof Date) {
      if (isNaN(value.getTime())) return "";
      return value.toISOString().split("T")[0];
  }
  // Basic check for Excel serial date
  // Added upper bound to avoid treating high totals (e.g. 300,000) as dates
  if (typeof value === "number" && value > 20000 && value < 200000) {
     const date = new Date((value - (25567 + 2)) * 86400 * 1000); 
     if (isNaN(date.getTime())) return ""; // Check validity
     try {
        return date.toISOString().split("T")[0];
     } catch (e) { return "" }
  }
  return String(value);
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const results = [];
    const TIMEOUT_LIMIT = 50000; // Safety break
    let processedCount = 0;

    for (const sheetName of workbook.SheetNames) {
      try {
          const sheet = workbook.Sheets[sheetName];
          // Limit the range to avoid reading 1 million empty rows if someone scrolled down too far
          const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: "" }); // defval to avoid holes
          
          // Safety: Skip processed sheets if too many (pagination would be better)
          // if (results.length > 500) break; 

          let patient = "";
          let procedure = "";
          let date = "";
          let total = "";
          let confidence = 0; 
          let largestNumber = 0;
          let possibleDate = "";

          // Usually info is at top, but user requested safer margin
          // Scanning up to 200 rows to cover the 150-line requirement comfortably
          const maxRows = Math.min(json.length, 200);

          for (let r = 0; r < maxRows; r++) {
            const row = json[r];
            if (!row) continue;
            
            for (let c = 0; c < row.length; c++) {
              const val = row[c];
              const cell = cleanText(val).toLowerCase();

              // Collect stats for fallbacks
              if (typeof val === 'number') {
                if (val > largestNumber && val < 10000000) { 
                    largestNumber = val;
                }
              }
              
              if (!possibleDate) {
                 const d = parseDate(val);
                 // Simple YYYY-MM-DD check
                 if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
                     possibleDate = d;
                 }
              }

              // Find Patient
              if (!patient && (cell.includes("nome") || cell.includes("paciente") || cell.includes("cliente"))) {
                 // CASE 1: Value is in the same cell? (e.g. "Nome: João")
                 if (cell.includes(":")) {
                     const parts = cell.split(":");
                     if (parts.length > 1 && parts[1].trim().length > 1) {
                         patient = cleanText(parts[1]);
                     }
                 }

                 // CASE 2: Value is in next columns
                 if (!patient) {
                    for (let i = 1; i < 4; i++) {
                        if (row[c + i]) {
                            const candidate = cleanText(row[c + i]);
                            // IGNORE if it's NID or just numbers
                            if (candidate.toLowerCase().includes("nid")) continue;
                            if (candidate.match(/^\d+$/)) continue; // Ignore pure numbers (likely phone or NID)
                            if (candidate.length < 3) continue; // Too short

                            patient = candidate;
                            break;
                        }
                    }
                 }

                 // CASE 3: Value is in next row (same column)
                 if (!patient && json[r+1] && json[r+1][c]) {
                     const candidate = cleanText(json[r+1][c]);
                     if (!candidate.toLowerCase().includes("nid") && !candidate.match(/^\d+$/) && candidate.length > 2) {
                        patient = candidate;
                     }
                 }
              }

              // Find Procedure
              // New Logic: Look for "Descricao" and check rows ABOVE it for the Title
              if (!procedure && (cell.includes("descrição") || (cell.includes("descricao") && !cell.includes("cliente")))) {
                 // The "Descricao" is usually a table header. The Procedure Title is often 1-3 rows ABOVE this header.
                 // Let's scan upwards from current row 'r' in the current column 'c' (or nearby columns)
                 for (let k = 1; k <= 4; k++) {
                     if (r - k >= 0) {
                         // Check 3 columns: current, left, right (centered titles might be offset)
                         const offsets = [0, -1, 1, -2, 2]; 
                         for (const off of offsets) {
                             if (json[r - k] && json[r - k][c + off]) {
                                 const candidate = cleanText(json[r - k][c + off]);
                                 // Ignore common header noise
                                 const lower = candidate.toLowerCase();
                                 if (
                                     lower.includes("fatura") || 
                                     lower.includes("proforma") || 
                                     lower.includes("data") || 
                                     lower.includes("venc") || 
                                     lower.includes("moeda") || 
                                     lower.includes("cambio") ||
                                     lower === ""
                                 ) continue;
                                 
                                 if (candidate.length > 3) {
                                     procedure = candidate;
                                     break; // Found a likely title
                                 }
                             }
                         }
                         if (procedure) break;
                     }
                 }
              }
              
              // Fallback: Old "Procedimento" label logic (but lower priority or only if not found)
              if (!procedure && (cell.includes("procedimento") || cell.includes("servico"))) {
                 if (row[c+1]) procedure = cleanText(row[c+1]);
                 if (json[r+1] && json[r+1][c]) {
                    const below = cleanText(json[r+1][c]);
                    if (!below.toLowerCase().includes("total")) {
                         procedure = below;
                    }
                 }
              }

              // Find Date (Explicit label)
              if (!date && (cell.includes("data") || cell.includes("emissão"))) {
                  if (row[c+1]) {
                      const d = parseDate(row[c+1]);
                      if (d) date = d;
                  }
              }

              // Find Total (Explicit label)
              if (!total && (cell === "total" || cell.includes("valor total") || cell.includes("total a pagar"))) {
                 for (let i = 1; i < 5; i++) {
                     const v = row[c+i];
                     if (v && (typeof v === 'number' || (typeof v === 'string' && v.match(/\d/)))) {
                         total = String(v);
                         break;
                     }
                 }
              }
            }
          }

          if (!date && possibleDate) date = possibleDate;
          if (!total && largestNumber > 0) total = String(largestNumber);

          if (patient) confidence++;
          if (procedure) confidence++;
          if (date) confidence++;
          if (total) confidence++;

          // Reduce raw data to 150 rows as requested
          const rawData = json.slice(0, 150);

          if (confidence > 0 || (json.length > 0 && sheetName)) {
            results.push({
                sheetName,
                patient,
                procedure,
                date,
                total,
                confidence,
                rawData
            });
          }
      } catch (sheetErr) {
          console.error(`Error processing sheet ${sheetName}:`, sheetErr);
          // Continue to next sheet
          results.push({
            sheetName,
            patient: "ERRO",
            procedure: "Erro ao ler aba",
            date: "",
            total: "",
            confidence: 0,
            rawData: []
          });
      }
    }

    return NextResponse.json({ success: true, count: results.length, data: results });

  } catch (error) {
    console.error("Error processing Excel:", error);
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}
