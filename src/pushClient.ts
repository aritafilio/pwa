// src/pushClient.ts
/**
 * Utilidades de Push (frontend)
 * - Pedir permiso
 * - Suscribirse con VAPID
 * - Enviar push de prueba al backend
 */

const API_BASE = import.meta.env.VITE_PUSH_API || ''; // p.ej. http://localhost:3001
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  const cur = Notification.permission;
  if (cur === 'granted' || cur === 'denied') return cur;
  return await Notification.requestPermission();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export async function subscribePush(): Promise<PushSubscriptionJSON | null> {
  if (!('serviceWorker' in navigator)) throw new Error('SW no soportado');
  if (!VAPID_PUBLIC_KEY) throw new Error('Falta VITE_VAPID_PUBLIC_KEY');

  const permission = await requestNotifPermission();
  if (permission !== 'granted') {
    throw new Error('Permiso de notificaciones no concedido');
  }

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Envía la suscripción al backend
  const res = await fetch(`${API_BASE}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });

  if (!res.ok) {
    try {
      const text = await res.text();
      throw new Error(`Error al guardar suscripción (${res.status}): ${text}`);
    } catch {
      throw new Error(`Error al guardar suscripción (${res.status})`);
    }
  }

  return sub.toJSON();
}

export async function sendTestPush(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/push/send`, {
    method: 'POST',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error al enviar push (${res.status}): ${text}`);
  }
}
