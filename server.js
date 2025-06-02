const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
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

// Configure seu Access Token do MercadoPago
mercadopago.configure({
  access_token: 'SEU_ACCESS_TOKEN_AQUI'
});

// Endpoint para criar pagamento
app.post('/criar-pagamento', async (req, res) => {
  const { valor, userId, nomeUsuario } = req.body;
  try {
    const preference = await mercadopago.preferences.create({
      items: [{
        title: `Depósito de saldo - ${nomeUsuario}`,
        unit_price: Number(valor),
        quantity: 1,
      }],
      metadata: { userId },
      payment_methods: {
        excluded_payment_types: [],
        installments: 1
      },
      back_urls: {
        success: 'https://seusite.com/sucesso',
        failure: 'https://seusite.com/erro',
        pending: 'https://seusite.com/pendente'
      },
      notification_url: 'https://SEU_BACKEND_URL/webhook'
    });
    res.json({ init_point: preference.body.init_point });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook para receber notificações do MercadoPago
app.post('/webhook', async (req, res) => {
  const payment = req.body;
  try {
    if (payment.type === 'payment') {
      // Buscar detalhes do pagamento
      const { data } = await mercadopago.payment.findById(payment.data.id);
      if (data.status === 'approved') {
        const userId = data.metadata.userId;
        const valor = data.transaction_amount;
        // Atualizar saldo no Firestore
        const saldoRef = db.collection('saldos').doc(userId);
        await saldoRef.set({ saldo: admin.firestore.FieldValue.increment(valor) }, { merge: true });
      }
    }
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.listen(3001, () => {
  console.log('Servidor rodando na porta 3001');
});
