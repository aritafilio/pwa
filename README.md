Funcionalidades

App Shell con cache-first (HTML/CSS/JS) para carga ultrarrápida.

Modo offline real: tareas guardadas en IndexedDB.

Outbox + Background Sync: cuando vuelves online, las operaciones pendientes (crear/editar/eliminar) se sincronizan con el backend.

Estrategias de caché:

App Shell: cache-first

Imágenes/no críticos: stale-while-revalidate

API: network-first con fallback a caché

/offline.html como página de respaldo

Push Notifications (VAPID/FCM): solicitud de permiso, prueba desde DevTools, y recepción desde el backend.

Instalable (PWA): manifiesto y service worker listos.
