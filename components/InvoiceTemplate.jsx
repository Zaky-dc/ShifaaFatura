import React, { forwardRef } from "react";

export const InvoiceTemplate = forwardRef(({ data }, ref) => {
  if (!data) return null;

  const formatMoney = (value) => {
    return Number(value).toLocaleString("pt-PT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div
      ref={ref}
      className="bg-white text-black font-sans text-sm w-[210mm] min-h-[297mm] mx-auto relative flex flex-col"
    >
      <div className="pt-48 px-10 flex-grow flex flex-col">
        {/* --- CABEÇALHO --- */}
        <div className="flex justify-between items-stretch gap-4 mb-1">
          <div className="w-7/12 border-2 border-gray-600 bg-gray-300 p-2">
            <div className="grid grid-cols-[80px_1fr] gap-y-0 text-sm leading-tight">
              <span className="font-bold">Exmos Srs:</span>
              <span className="uppercase font-semibold">
                {data.clientName || "Particular"}
              </span>
              <span className="font-bold">Nome:</span>
              <span className="font-bold">{data.patientName}</span>
              <span className="font-bold">NID:</span>
              <span>{data.patientNid}</span>
              <span className="font-bold">Contacto:</span>
              <span>{data.patientContact}</span>
            </div>
          </div>
          <div className="w-5/12 border-2 border-gray-600 bg-gray-300 p-2 flex flex-col justify-center">
            <div className="flex justify-between items-center px-2">
              <span className="font-bold text-sm">Factura Proforma Nº</span>
              <span className="font-bold text-lg">
                {data.invoiceNumber || "---"}
              </span>
            </div>
          </div>
        </div>

        {/* --- DATAS --- */}
        <div className="grid grid-cols-5 border-y-2 border-gray-600 py-1 mt-4 mb-4 text-xs font-bold text-center bg-white">
          <div className="border-r border-gray-400">
            Data Doc.<br />
            <span className="font-normal">{data.date ? new Date(data.date).toLocaleDateString("pt-PT") : "-"}</span>
          </div>
          <div className="border-r border-gray-400">
            Data Venc.<br />
            <span className="font-normal">{data.dueDate ? new Date(data.dueDate).toLocaleDateString("pt-PT") : "-"}</span>
          </div>
          <div className="border-r border-gray-400">Moeda<br /><span className="font-normal">MZN</span></div>
          <div className="border-r border-gray-400">Câmbio<br /><span className="font-normal">0,00</span></div>
          <div>Desc.Cliente<br /><span className="font-normal">0,00</span></div>
        </div>

        {/* --- TÍTULO --- */}
        <div className="text-center font-bold text-sm mb-1 uppercase py-1 mb-4">
          {data.procedureTitle || "Descrição do Serviço"}
        </div>

        {/* --- TABELA PRINCIPAL --- */}
        <div className="border-2 border-gray-600 flex-grow flex flex-col relative min-h-[500px]">
          {data.displayMode === "descriptive" ? (
            <div className="grid grid-cols-[10%_90%] bg-gray-300 border-b border-gray-500 font-bold text-center text-xs py-1">
              <div className="border-r border-gray-500">Qtd</div>
              <div>Descrição</div>
            </div>
          ) : (
            <div className="grid grid-cols-[10%_50%_20%_20%] bg-gray-300 border-b border-gray-500 font-bold text-center text-xs py-1">
              <div className="border-r border-gray-500">Qtd</div>
              <div className="border-r border-gray-500">Descrição</div>
              <div className="border-r border-gray-500">Preço Unit</div>
              <div>Total</div>
            </div>
          )}

          <div className="flex-grow">
            {data.items.map((item, i) =>
              data.displayMode === "descriptive" ? (
                <div key={i} className="grid grid-cols-[10%_90%] text-xs py-1">
                  <div className="text-center px-1 font-bold border-r border-gray-100">{item.qty}</div>
                  {/* AQUI ESTÁ A CORREÇÃO DO ENTER: whitespace-pre-wrap */}
                  <div className="px-4 whitespace-pre-wrap leading-relaxed">{item.description}</div>
                </div>
              ) : (
                <div key={i} className="grid grid-cols-[10%_50%_20%_20%] text-xs py-1">
                  <div className="text-center px-1">{item.qty > 0 ? item.qty : ""}</div>
                  {/* AQUI ESTÁ A CORREÇÃO DO ENTER: whitespace-pre-wrap */}
                  <div className="px-2 whitespace-pre-wrap leading-relaxed">{item.description}</div>
                  <div className="text-right px-2">{item.price > 0 ? formatMoney(item.price) : ""}</div>
                  <div className="text-right px-2 font-semibold">{formatMoney(item.total)}</div>
                </div>
              )
            )}
          </div>

          <div className="mt-8 px-4 pb-12 text-[10px]">
            <p className="font-bold mb-1">Observação</p>
            <p className="mb-1">1 O valor cotado não inclui custos resultantes de complicações...</p>
            <p>2 O Valor por facturar é regularmente actualizado...</p>
          </div>

          <div className="border-t-2 border-gray-600 flex bg-gray-100 absolute bottom-0 w-full">
            <div className="w-3/4 p-2 font-bold text-left border-r border-gray-600 pl-4">Depósito</div>
            <div className="w-1/4 p-2 text-right font-bold pr-4">{formatMoney(data.grandTotal)}</div>
          </div>
        </div>
      </div>
      <div className="pb-32"></div>
    </div>
  );
});

InvoiceTemplate.displayName = "InvoiceTemplate";
