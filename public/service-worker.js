

/* ====== VERSIONES DE CACHÉ ====== */
const SHELL_CACHE   = 'shell-cache-v2';
const IMG_CACHE     = 'img-cache-v2';
const DATA_CACHE    = 'data-cache-v2';
const RUNTIME_CACHE = 'rt-cache-v2'; // opcional (para lo que no entre en las reglas)

/* ====== APP SHELL (precarga) ====== */
const CORE_ASSETS = [
  '/',               // navegación raíz (SPA)
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/vite.svg',
];

/* ====== IndexedDB / Outbox (igual a tu app) ====== */
const DB_NAME = 'PwaTasksDB';
const TASKS_STORE = 'tasks';
const OUTBOX_STORE = 'outbox';
const DB_VERSION = 3;

/* ================== INSTALL / ACTIVATE ================== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, IMG_CACHE, DATA_CACHE, RUNTIME_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* ================== ESTRATEGIAS ================== */
async function cacheFirst(request, cacheName = SHELL_CACHE) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok && request.url.startsWith(self.location.origin)) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName = IMG_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((res) => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || fetchPromise || new Response('Offline asset', { status: 503 });
}

async function networkFirst(request, cacheName = DATA_CACHE) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('/offline.html');
    return new Response('Offline data', { status: 503 });
  }
}

/* ================== RUTEO DE PETICIONES ================== */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // 1) Navegaciones (SPA) → cache-first + offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }

  // 2) Shell estático: HTML/CSS/JS → cache-first
  if (isSameOrigin && /\.(?:html|css|js)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }

  // 3) Imágenes / no críticos → stale-while-revalidate
  if (/\.(?:png|jpg|jpeg|webp|gif|svg|ico)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, IMG_CACHE));
    return;
  }

  // 4) API → network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // 5) Resto → network-first
  event.respondWith(networkFirst(req, RUNTIME_CACHE));
});

/* ================== BACKGROUND SYNC (OUTBOX) ================== */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TASKS_STORE))
        db.createObjectStore(TASKS_STORE, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains(OUTBOX_STORE))
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      if (req.error?.name === 'VersionError') {
        const retry = indexedDB.open(DB_NAME);
        retry.onsuccess = () => resolve(retry.result);
        retry.onerror = () => reject(retry.error);
      } else reject(req.error);
    };
  });
}
function tx(db, name, mode='readonly'){ const t=db.transaction(name,mode); return [t,t.objectStore(name)]; }
async function getAllOutbox(){ const db=await openDB(); const [,s]=tx(db,OUTBOX_STORE); return new Promise((res,rej)=>{ const r=s.getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); }
async function deleteOutbox(id){ const db=await openDB(); const [,s]=tx(db,OUTBOX_STORE,'readwrite'); return new Promise((res)=>{ const r=s.delete(id); r.onsuccess=()=>res(); r.onerror=()=>res(); }); }
async function markTaskSynced(id){ if(typeof id!=='number')return; const db=await openDB(); const [,s]=tx(db,TASKS_STORE,'readwrite'); await new Promise((res)=>{ const g=s.get(id); g.onsuccess=()=>{ const t=g.result; if(!t)return res(); t.isSynced=true; const p=s.put(t); p.onsuccess=()=>res(); p.onerror=()=>res(); }; g.onerror=()=>res(); }); }

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-entries') {
    event.waitUntil(processOutbox());
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'force-sync') {
    event.waitUntil(processOutbox());
  }
});

async function processOutbox() {
  try {
    const items = await getAllOutbox();
    if (!items.length) return;

    for (const item of items) {
      const { id: outboxId, op, task, taskId } = item;
      let resp;

      if (op === 'create') {
        resp = await fetch('/api/tasks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        });
        if (!resp.ok) throw new Error(`POST /api/tasks → ${resp.status}`);
        if (task?.id) await markTaskSynced(task.id);
      }

      if (op === 'update') {
        const id = task?.id ?? taskId;
        resp = await fetch(`/api/tasks/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        });
        if (!resp.ok) throw new Error(`PUT /api/tasks/${id} → ${resp.status}`);
        if (id) await markTaskSynced(id);
      }

      if (op === 'delete') {
        const id = taskId ?? task?.id;
        resp = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        if (!resp.ok && resp.status !== 404) throw new Error(`DELETE /api/tasks/${id} → ${resp.status}`);
      }

      await deleteOutbox(outboxId);
    }
  } catch (e) {
    console.error('[SW] Error procesando outbox:', e);
  }
}

/* ================== PUSH NOTIFICATIONS ================== */
/**
 * Normaliza el payload del push: soporta JSON o texto plano.
 * Estructura esperada:
 * { title, body, url, icon, badge, tag, actions, requireInteraction, data }
 */
function parsePushData(event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    const text = event.data ? event.data.text() : '';
    payload = { title: 'Notificación', body: text };
  }
  const {
    title = 'Notificación',
    body = 'Tienes una actualización.',
    url = '/',
    icon = '/vite.svg',
    badge = '/vite.svg',
    tag,
    actions = [],
    data = {},
    requireInteraction = false,
  } = payload;

  return {
    title,
    options: {
      body,
      icon,
      badge,
      tag,
      actions,
      requireInteraction,
      data: { url, ...data },
    },
  };
}

self.addEventListener('push', (event) => {
  const { title, options } = parsePushData(event);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil((async () => {
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsArr) {
      try {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client && client.url !== (self.location.origin + targetUrl)) {
            await client.navigate(targetUrl);
          }
          return;
        }
      } catch {}
    }
    await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('notificationclose', (event) => {
  // Aquí podrías enviar métricas si lo necesitas
  // console.log('Notificación cerrada', event.notification.tag);
});
