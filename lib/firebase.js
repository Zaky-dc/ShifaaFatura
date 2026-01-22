import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyC3XSrLQFDXrSJ-TudPKmwTzNtOmejtrvA",
    authDomain: "shifaainvoice.firebaseapp.com",
    projectId: "shifaainvoice",
    storageBucket: "shifaainvoice.firebasestorage.app",
    messagingSenderId: "12295995697",
    appId: "1:12295995697:web:0eda47f16e98b192c87010"
  };

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);