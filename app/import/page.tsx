"use client";

import { useState, Fragment } from "react";
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react";

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const toggleExpand = (idx: number) => {
    if (expandedRow === idx) {
      setExpandedRow(null);
    } else {
      setExpandedRow(idx);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setLoading(true);
    setError("");
    setData([]);
    setExpandedRow(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-excel", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to process file");
      }

      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "Unknown error occurred");
      }
    } catch (err: any) {
      setError(err.message);
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
          Carregue o arquivo Excel com as múltiplas abas. O sistema tentará
          extrair automaticamente os dados usando heurísticas avançadas.
        </p>
      </div>

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
            className={`px-6 py-2.5 rounded-lg font-medium text-white shadow-sm transition-colors
              ${
                !file || loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
          >
            {loading ? "Processando..." : "Processar Arquivo"}
          </button>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200 flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}
      </div>

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
                              Visualização dos Dados Brutos (Primeiras 20
                              linhas)
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
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-2 text-xs text-gray-500 italic">
                              * Estes são os dados exatamente como lidos pelo
                              sistema. Se os campos estiverem em branco ou
                              estranhos, pode ser formatação do Excel.
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
    if (
      !confirm(
        "⚠️ PERIGO: Isso vai apagar TODAS as faturas que foram importadas via Excel anteriormente. Tem certeza?",
      )
    )
      return;
    setDeleting(true);
    setMsg("");
    try {
      const res = await fetch("/api/delete-imported-invoices", {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setMsg(`🗑️ Sucesso! ${json.count} faturas apagadas.`);
      } else {
        alert("Erro ao apagar: " + json.error);
      }
    } catch (e) {
      alert("Erro ao apagar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm font-medium text-blue-600">{msg}</span>}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
      >
        {deleting ? "Apagando..." : "Apagar Importados"}
      </button>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar no Sistema"}
      </button>
    </div>
  );
}
