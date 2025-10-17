PWA Lista de Tareas — Offline-First con IndexedDB, Background Sync y Push
Aplicación web progresiva que permite crear/editar/eliminar tareas funcionando sin conexión, guardando en IndexedDB y sincronizando con el backend cuando vuelve la red mediante Background Sync. Incluye Service Worker con estrategias de caché (App Shell), página offline, soporte de notificaciones push (VAPID o FCM), e instalación como app.
Características
Formulario offline → guarda tareas en IndexedDB cuando no hay red.
Outbox + Background Sync → encola cambios (create/update/delete) y los reintenta al reconectar.
Service Worker:
App Shell cache-first (HTML/CSS/JS).
Imágenes stale-while-revalidate.
API network-first con fallback a caché.
offline.html para navegación sin conexión.
Notificaciones Push:
Solicitud de permiso en la UI.
Manejo push/notificationclick en el SW.
Compatible con web-push (VAPID) o Firebase Cloud Messaging (opcional).
Instalable como PWA (manifest + SW + served over HTTP(S)).
⚙️ Requisitos
Node 18+ (recomendado 20+)
Navegador con Service Workers y Background Sync (Chrome/Edge)
Para push con VAPID: web-push en el backend y par de claves.
Para push con FCM: proyecto Firebase y firebase-messaging-sw.js.
🚀 Puesta en marcha (frontend)
# 1) Instalar dependencias
npm i
Desarrollo
npm run dev
Build producción
npm run build
 Preview (sirve dist/)
npm run preview
🗄️ IndexedDB + Outbox
Archivo clave: src/indexedDB.ts
Apertura DB/Stores (openDB) crea tasks y outbox:
Cola de operaciones con queueOutbox.
CRUD de tareas: addTaskToDB, updateTaskInDB, removeTaskFromDB.
Archivo src/useTasks.tsx:
Maneja estado UI + llamadas a IndexedDB.
Si está offline, encola en outbox y registra sync-entries.
Si está online, actualiza DB y (opcionalmente) llama a backend directo.
🧰 Service Worker (caché, offline, sync, push)
Archivo clave: public/service-worker.js (extracto):
Install: precache del App Shell y offline.html.
Fetch routing:
navigate → cache-first con fallback a /offline.html.

*.{html,css,js} → cache-first.

imágenes → stale-while-revalidate.

/api/* → network-first (+ fallback caché).

Background Sync:

sync con tag sync-entries → procesa OUTBOX y hace fetch a /api/tasks.

Push:

push → muestra notificación.

notificationclick → abre/focus la app y navega a data.url.

Recuerda bump de versión de caché (por ej. shell-cache-v2) si cambias el SW para evitar colisiones.

🔔 Notificaciones (cliente)

En src/App.tsx hay una zona de notificaciones:

Botón “🔔 Activar notificaciones” → llama a Notification.requestPermission() y muestra una notificación de prueba via ServiceWorkerRegistration.showNotification(...).

Para Push con VAPID:

En backend, genera claves:

node -e "console.log(require('web-push').generateVAPIDKeys())"


Exporta variables y arranca server:

setx VAPID_PUBLIC_KEY  "TU_PUBLICA_URLSAFE"
setx VAPID_PRIVATE_KEY "TU_PRIVADA_URLSAFE"
npm start


Desde el front, realiza subscribe (JS) y guarda endpoint en tu backend.

Prueba un envío:

curl -X POST http://localhost:3001/api/push-test \
  -H "Content-Type: application/json" \
  -d '{"title":"Hola","body":"Push de prueba"}'


Para Firebase Cloud Messaging (opcional):

Crea public/firebase-messaging-sw.js (con tu config).

Inicializa en src/firebase.ts y pide token con getToken(...).

🧪 Cómo probar Offline, Sync y Caché

Offline UI

DevTools → Network → “Offline”.

Agrega/edita/elimina tareas → se guardan en IndexedDB y se encolan en outbox.

Background Sync

Sigue offline: verás tareas con badge “Pendiente de sincronizar”.

Cambia a “Online” → el SW dispara sync-entries y sincroniza con /api/tasks.

Página Offline

Navega a cualquier ruta en modo offline → debe aparecer offline.html.

Cachés

Application → Cache Storage → verifica caches shell, img, data (según nombres que definiste).

Cambia una imagen en el server → primer load sale de caché, segundo ya actualizada (stale-while-revalidate).
