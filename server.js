const express = require('express');
const cors = require('cors');
const Coinpayments = require('coinpayments');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// Inicialize o Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Configure CoinPayments
const client = new Coinpayments({
  key: process.env.COINPAYMENTS_PUBLIC_KEY,
  secret: process.env.COINPAYMENTS_PRIVATE_KEY
});

// Endpoint para criar pagamento em cripto
app.post('/criar-pagamento-cripto', async (req, res) => {
  const { valor, userId, nomeUsuario } = req.body;
  try {
    const result = await client.createTransaction({
      currency1: 'BRL', // moeda do valor
      currency2: 'USDT', // moeda que vai receber (pode ser BTC, ETH, etc.)
      amount: valor,
      buyer_email: 'email@cliente.com', // opcional
      custom: userId
    });
    res.json({ checkout_url: result.checkout_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook para receber notificações do CoinPayments
app.post('/webhook-cripto', async (req, res) => {
  // CoinPayments envia dados via POST
  const { custom, status, amount1 } = req.body;
  try {
    // status >= 100 significa pagamento confirmado
    if (status >= 100) {
      const userId = custom;
      const valor = parseFloat(amount1);
      // Atualizar saldo no Firestore
      const saldoRef = db.collection('saldos').doc(userId);
      await saldoRef.set({ saldo: admin.firestore.FieldValue.increment(valor) }, { merge: true });
    }
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.listen(3001, () => {
  console.log('Servidor rodando na porta 3001');
});
