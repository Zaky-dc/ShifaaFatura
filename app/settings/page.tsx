"use client";

import { useEffect, useState } from "react";
import { Settings, Save, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const [currentCounter, setCurrentCounter] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings/invoice-number")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCurrentCounter(data.counter);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!currentCounter) return;

    // Safety prompt
    if (
      !confirm(
        `ATENÇÃO: Isso mudará a numeração de TODAS as próximas faturas para iniciar em ${currentCounter}. Tem certeza?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/invoice-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newCounter: currentCounter }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: "Numeração atualizada com sucesso!",
        });
      } else {
        setMessage({ type: "error", text: "Erro ao atualizar: " + data.error });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Erro de conexão ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Settings className="text-gray-500" /> Configurações
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Ajuste parâmetros globais do sistema.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          Faturas Proforma
        </h2>

        <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg mb-6 flex items-start gap-3">
          <AlertTriangle className="text-orange-500 mt-1" size={20} />
          <div className="text-sm text-orange-800">
            <p className="font-bold mb-1">Cuidado ao alterar este número</p>
            <p>
              O "Contador Atual" define qual será o número da <b>próxima</b>{" "}
              fatura emitida pelo sistema.
            </p>
            <p>Se você colocar "1000", a próxima fatura será a Nº 1001.</p>
          </div>
        </div>

        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contador Atual (Último ID usado)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={currentCounter}
              onChange={(e) =>
                setCurrentCounter(parseInt(e.target.value) || "")
              }
              disabled={loading || saving}
            />
            <button
              onClick={handleSave}
              disabled={loading || saving || !currentCounter}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save size={18} />
              )}
              Salvar
            </button>
          </div>
          {message && (
            <p
              className={`mt-2 text-sm ${message.type === "success" ? "text-green-600 font-medium" : "text-red-500"}`}
            >
              {message.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
