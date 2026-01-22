// lib/invoiceService.js
import { ref, runTransaction, set, get, query, limitToLast, orderByKey, remove, update } from "firebase/database";
import { db } from "./firebase";

// 1. SALVAR NOVA FATURA (Com contador automático)
export const createInvoice = async (invoiceData) => {
  const counterRef = ref(db, 'settings/invoiceCounter');

  try {
    const result = await runTransaction(counterRef, (currentValue) => {
      return (currentValue || 3977) + 1; 
    });

    const newNumber = result.snapshot.val();
    
    const finalInvoice = {
      ...invoiceData,
      invoiceNumber: newNumber,
      createdAt: new Date().toISOString(),
      id: newNumber
    };

    await set(ref(db, `invoices/${newNumber}`), finalInvoice);
    return newNumber;
  } catch (error) {
    console.error("Erro ao criar fatura:", error);
    throw error;
  }
};

// 2. BUSCAR AS ÚLTIMAS FATURAS
export const getRecentInvoices = async () => {
  try {
    const invoicesRef = ref(db, 'invoices');
    const recentQuery = query(invoicesRef, orderByKey(), limitToLast(50));
    
    const snapshot = await get(recentQuery);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.values(data).reverse(); 
    }
    return [];
  } catch (error) {
    console.error("Erro ao buscar faturas:", error);
    return [];
  }
};

// 3. BUSCAR UMA FATURA ESPECÍFICA (Pelo ID)
export const getInvoiceById = async (id) => {
  try {
    const snapshot = await get(ref(db, `invoices/${id}`));
    if (snapshot.exists()) return snapshot.val();
    return null;
  } catch (error) {
    console.error("Erro ao buscar fatura:", error);
    return null;
  }
};

// 4. ATUALIZAR UMA FATURA EXISTENTE
export const updateInvoice = async (id, invoiceData) => {
  try {
    // AQUI ESTAVA O ERRO: Agora 'update' já está importado lá em cima
    await update(ref(db, `invoices/${id}`), invoiceData);
    return id;
  } catch (error) {
    console.error("Erro ao atualizar:", error);
    throw error;
  }
};

// 5. APAGAR FATURA
export const deleteInvoice = async (id) => {
  try {
    await remove(ref(db, `invoices/${id}`));
    return true;
  } catch (error) {
    console.error("Erro ao apagar:", error);
    throw error;
  }
};