"use client";

import { useState, Fragment } from "react";
// IMPORTANTE: Certifica-te que tens este ficheiro criado em lib/excelParser.js
import { parseExcelFile } from "@/lib/excelParser"; 
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Eye,
  Save,
  Trash
} from "lucide-react";

// Interface para os dados extraídos
interface ExtractedData {
  sheetName: string;
  patient: string;
  procedure: string;
  date: string;
  total: string;
  confidence: number;
  rawData?: any[][];
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExtractedData[]>([]);
  const [error, setError] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Manipula a seleção do arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Expande/Colapsa linhas da tabela
  const toggleExpand = (idx: number) => {
    if (expandedRow === idx) {
      setExpandedRow(null);
    } else {
      setExpandedRow(idx);
    }
  };

  // Processa o Excel (Client-Side para evitar erro 413)
  const handleProcess = async () => {
    if (!file) return;

    setLoading(true);
    setError("");
    setData([]);
    setExpandedRow(null);

    try {
      // Chama a função local (sem enviar para o servidor)
      const result: any = await parseExcelFile(file);
      
      if (result.success) {
        setData(result.data);
      } else {
        setError("Não foi possível ler os dados do arquivo.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Falha ao processar arquivo Excel.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
          <FileSpreadsheet className="w-8 h-8 text-green-600" />
          Importar Faturas Antigas (Excel)
        </h1>
        <p className="text-gray-600">
          Carregue o arquivo Excel com as múltiplas abas. O processamento é feito no seu navegador (sem limites de tamanho).
        </p>
      </div>

      {/* ÁREA DE UPLOAD */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Selecione o arquivo Excel (.xlsx)
            </label>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer border border-gray-300 rounded-lg p-2"
            />
          </div>
          <button
            onClick={handleProcess}
            disabled={!file || loading}
            className={`px-6 py-2.5 rounded-lg font-medium text-white shadow-sm transition-colors flex items-center gap-2
              ${
                !file || loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
          >
            {loading ? (
               <>Processando...</>
            ) : (
               <><Upload size={18} /> Processar Arquivo</>
            )}
          </button>
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200 flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}
      </div>

      {/* RESULTADOS */}
      {data.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Resultados Extraídos{" "}
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({data.length} encontrados)
              </span>
            </h2>

            <div className="flex items-center gap-2">
              <SaveButtons data={data} />
            </div>
          </div>
          
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 max-w-xs truncate">
                    Aba (Excel)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paciente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Procedimento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confiança
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((row, idx) => {
                  const isExpanded = expandedRow === idx;
                  return (
                    <Fragment key={idx}>
                      <tr
                        className={`cursor-pointer transition-colors ${row.confidence < 3 ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"}`}
                        onClick={() => toggleExpand(idx)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {isExpanded ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-100 max-w-xs truncate">
                          {row.sheetName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {row.patient || (
                            <span className="text-red-400 italic">
                              Não encontrado
                            </span>
                          )}
                        </td>
                        <td
                          className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate"
                          title={row.procedure}
                        >
                          {row.procedure || (
                            <span className="text-gray-400 italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {row.date || (
                            <span className="text-gray-400 italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {row.total || (
                            <span className="text-gray-400 italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div
                                key={i}
                                className={`h-2 w-2 rounded-full ${
                                  i < row.confidence
                                    ? "bg-green-500"
                                    : "bg-gray-200"
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && row.rawData && (
                        <tr key={`exp-${idx}`}>
                          <td
                            colSpan={7}
                            className="px-6 py-4 bg-gray-50 border-b border-gray-200"
                          >
                            <div className="mb-2 font-semibold text-gray-700 flex items-center gap-2">
                              <Eye size={16} />
                              Visualização dos Dados Brutos
                            </div>
                            <div className="overflow-x-auto border border-gray-300 rounded shadow-sm max-h-96">
                              <table className="min-w-full text-xs divide-y divide-gray-300">
                                <tbody className="divide-y divide-gray-200 bg-white">
                                  {row.rawData.map((rData, rIdx) => (
                                    <tr key={rIdx}>
                                      <td className="w-8 p-1 bg-gray-100 text-gray-500 font-mono text-center border-r select-none">
                                        {rIdx + 1}
                                      </td>
                                      {rData.map((cell: any, cIdx: number) => (
                                        <td
                                          key={cIdx}
                                          className="p-2 border-r border-gray-100 min-w-[100px] whitespace-nowrap overflow-hidden text-ellipsis max-w-xs"
                                        >
                                          {String(cell)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-2 text-xs text-gray-500 italic">
                               * Estes são os dados exatamente como lidos pelo sistema.
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// SUB-COMPONENTE: Botões de Ação (Salvar / Apagar)
function SaveButtons({ data }: { data: ExtractedData[] }) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async () => {
    if (!confirm(`Deseja salvar ${data.length} faturas no banco de dados?`))
      return;
    setSaving(true);
    setMsg("");
    try {
      // POST para API de salvar (o JSON é leve, não dá erro 413)
      const res = await fetch("/api/save-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoices: data }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg(`✅ Sucesso! ${json.count} faturas salvas.`);
      } else {
        alert("Erro ao salvar: " + json.error);
      }
    } catch (e) {
      alert("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    // Prompt simples para senha (podes usar o modal bonito se preferires)
    const passkey = prompt("Digite a senha de admin para apagar o histórico:");
    if (!passkey) return;

    setDeleting(true);
    setMsg("");
    try {
      const res = await fetch("/api/delete-imported-invoices", {
        method: "POST", // POST para enviar a senha no body
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg(`🗑️ Sucesso! ${json.count} faturas apagadas.`);
      } else {
        alert("Erro: " + (json.error || "Senha ou erro desconhecido"));
      }
    } catch (e) {
      alert("Erro ao apagar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm font-medium text-blue-600 animate-pulse">{msg}</span>}
      
      <button
        onClick={handleDelete}
        disabled={deleting || saving}
        className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50 flex items-center gap-1"
      >
        <Trash size={16} />
        {deleting ? "Apagando..." : "Apagar Importados"}
      </button>
      
      <button
        onClick={handleSave}
        disabled={saving || deleting}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm disabled:opacity-50 flex items-center gap-1"
      >
        <Save size={16} />
        {saving ? "Salvando..." : "Salvar no Sistema"}
      </button>
    </div>
  );
}
