// Configuração do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, onSnapshot, query } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBKQWJykqZfNSWQTQ5Nd_Ukh5trB7-EtLs",
  authDomain: "jogorifa-4d142.firebaseapp.com",
  projectId: "jogorifa-4d142",
  storageBucket: "jogorifa-4d142.firebasestorage.app",
  messagingSenderId: "167295902588",
  appId: "1:167295902588:web:73593ebcd782497fa53af9"
};

const app = initializeApp(firebaseConfig);
export { app };
export const auth = getAuth(app);
export const db = getFirestore(app);
export { doc, getDoc, setDoc, updateDoc, increment };
export const functions = getFunctions(app);
export { httpsCallable };

async function apostar() {
  if (!user) return alert('Faça login!');
  if (selecionado === null) return alert('Selecione um número!');
  if (sorteado) return;
  setLoading(true);
  try {
    const apostarRifa = httpsCallable(functions, 'apostarRifa');
    await apostarRifa({
      numero: selecionado,
      valor: aposta,
      nome,
      grid: rifaCollection
    });
    setSelecionado(null);
  } catch (err) {
    alert(err.message || 'Erro ao apostar');
  }
  setLoading(false);
}

