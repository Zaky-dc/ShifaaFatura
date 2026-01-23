// lib/excelParser.js
import * as XLSX from "xlsx";

// Funções auxiliares (iguais às que tinhas na API)
const cleanText = (text) => {
  if (!text) return "";
  return String(text).trim();
};

const parseDate = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
      if (isNaN(value.getTime())) return "";
      return value.toISOString().split("T")[0];
  }
  // Verifica datas numéricas do Excel
  if (typeof value === "number" && value > 20000 && value < 200000) {
     const date = new Date((value - (25567 + 2)) * 86400 * 1000); 
     if (isNaN(date.getTime())) return ""; 
     try {
        return date.toISOString().split("T")[0];
     } catch (e) { return "" }
  }
  return String(value);
};

// Esta é a função principal que a página vai chamar
export const parseExcelFile = async (file) => {
    return new Promise(async (resolve, reject) => {
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const results = [];
        
            for (const sheetName of workbook.SheetNames) {
              try {
                  const sheet = workbook.Sheets[sheetName];
                  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: "" });
                  
                  let patient = "";
                  let procedure = "";
                  let date = "";
                  let total = "";
                  let confidence = 0; 
                  let largestNumber = 0;
                  let possibleDate = "";
        
                  const maxRows = Math.min(json.length, 200);
        
                  for (let r = 0; r < maxRows; r++) {
                    const row = json[r];
                    if (!row) continue;
                    
                    for (let c = 0; c < row.length; c++) {
                      const val = row[c];
                      const cell = cleanText(val).toLowerCase();
        
                      if (typeof val === 'number') {
                        if (val > largestNumber && val < 10000000) { 
                            largestNumber = val;
                        }
                      }
                      
                      if (!possibleDate) {
                         const d = parseDate(val);
                         if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
                             possibleDate = d;
                         }
                      }
        
                      // Lógica de Paciente
                      if (!patient && (cell.includes("nome") || cell.includes("paciente") || cell.includes("cliente"))) {
                         if (cell.includes(":")) {
                             const parts = cell.split(":");
                             if (parts.length > 1 && parts[1].trim().length > 1) {
                                 patient = cleanText(parts[1]);
                             }
                         }
                         if (!patient) {
                            for (let i = 1; i < 4; i++) {
                                if (row[c + i]) {
                                    const candidate = cleanText(row[c + i]);
                                    if (candidate.toLowerCase().includes("nid")) continue;
                                    if (candidate.match(/^\d+$/)) continue; 
                                    if (candidate.length < 3) continue; 
                                    patient = candidate;
                                    break;
                                }
                            }
                         }
                         if (!patient && json[r+1] && json[r+1][c]) {
                             const candidate = cleanText(json[r+1][c]);
                             if (!candidate.toLowerCase().includes("nid") && !candidate.match(/^\d+$/) && candidate.length > 2) {
                                patient = candidate;
                             }
                         }
                      }
        
                      // Lógica de Procedimento
                      if (!procedure && (cell.includes("descrição") || (cell.includes("descricao") && !cell.includes("cliente")))) {
                         for (let k = 1; k <= 4; k++) {
                             if (r - k >= 0) {
                                 const offsets = [0, -1, 1, -2, 2]; 
                                 for (const off of offsets) {
                                     if (json[r - k] && json[r - k][c + off]) {
                                         const candidate = cleanText(json[r - k][c + off]);
                                         const lower = candidate.toLowerCase();
                                         if (lower.includes("fatura") || lower.includes("proforma") || lower.includes("data") || lower.includes("venc") || lower.includes("moeda") || lower.includes("cambio") || lower === "") continue;
                                         if (candidate.length > 3) {
                                             procedure = candidate;
                                             break; 
                                         }
                                     }
                                 }
                                 if (procedure) break;
                             }
                         }
                      }
                      
                      // Fallback Procedimento
                      if (!procedure && (cell.includes("procedimento") || cell.includes("servico"))) {
                         if (row[c+1]) procedure = cleanText(row[c+1]);
                         if (json[r+1] && json[r+1][c]) {
                            const below = cleanText(json[r+1][c]);
                            if (!below.toLowerCase().includes("total")) {
                                 procedure = below;
                            }
                         }
                      }
        
                      // Lógica Data
                      if (!date && (cell.includes("data") || cell.includes("emissão"))) {
                          if (row[c+1]) {
                              const d = parseDate(row[c+1]);
                              if (d) date = d;
                          }
                      }
        
                      // Lógica Total
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
        
                  const rawData = json.slice(0, 150); // Pegar 150 linhas para preview
        
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
                  // Continua para a próxima aba
              }
            }
        
            resolve({ success: true, count: results.length, data: results });

        } catch (error) {
            reject(error);
        }
    });
};
