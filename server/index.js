// index.js
import express from 'express';
import cors from 'cors';
import webpush from 'web-push';

const app = express();

// 1) CORS para el frontend (Vite) en 5173
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// 2) VAPID keys (usa variables de entorno en producción)
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || 'BLue3hPcRp9oNOAVUPmpbJh2BxqCXgHj390YckU5p5p9JvosoGHsDBKSwHoIIMjcXHYInGFF0hjITYozsqexgE0';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '5Wu14qpSkbmgZ3as7QFAtUS9DzZvm94IfdSCYE3Bhms';

webpush.setVapidDetails(
  'mailto:tu-correo@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// 3) “DB” simple en memoria (cámbialo por una real si lo necesitas)
const subscriptions = new Set();

// 4) Guardar suscripción (la manda el frontend)
app.post('/api/push/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  subscriptions.add(sub);
  return res.sendStatus(201);
});

// (Opcional) cancelar
app.post('/api/push/unsubscribe', (req, res) => {
  for (const s of subscriptions) {
    if (s.endpoint === req.body?.endpoint) subscriptions.delete(s);
  }
  res.sendStatus(200);
});

// 5) Enviar push de prueba a TODAS las suscripciones guardadas
app.post('/api/push/send', async (req, res) => {
  const payload = JSON.stringify({
    title: req.body?.title ?? '📬 Notificación de prueba',
    body:  req.body?.body  ?? 'Hola desde tu backend (3001)',
    url:   req.body?.url   ?? '/',
    icon:  '/vite.svg',
    badge: '/vite.svg',
    tag:   'demo'
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
  res.json({ sent: results.length, results });
});

// 6) Arranque (tú ya usas 3001)
app.listen(3001, () => {
  console.log('API listening on http://localhost:3001');
});
