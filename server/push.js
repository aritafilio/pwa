import express from 'express';
import webpush from 'web-push';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Configura VAPID
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
webpush.setVapidDetails('mailto:tu-email@ejemplo.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Almacén simple (reemplaza por DB real)
const subscriptions = new Set();

// Suscribir (desde el frontend)
app.post('/api/push/subscribe', (req, res) => {
  const sub = req.body; // objeto PushSubscription
  if (!sub?.endpoint) return res.status(400).send('Invalid subscription');
  subscriptions.add(sub);
  return res.sendStatus(201);
});

// Desuscribir
app.post('/api/push/unsubscribe', (req, res) => {
  const toRemove = req.body; // puede venir de sub.toJSON()
  for (const s of subscriptions) {
    if (s.endpoint === toRemove.endpoint) {
      subscriptions.delete(s);
      break;
    }
  }
  return res.sendStatus(200);
});

// Enviar notificación de prueba a todos
app.post('/api/push/test', async (req, res) => {
  const payload = JSON.stringify({
    title: '🚀 Push desde backend',
    body: 'Hola desde el servidor',
    url: '/',
  });

  const results = [];
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      results.push({ endpoint: sub.endpoint, ok: true });
    } catch (e) {
      results.push({ endpoint: sub.endpoint, ok: false, error: e.message });
    }
  }
  res.json(results);
});

app.listen(3000, () => console.log('Push server on http://localhost:3000'));
