if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = '/service-worker.js';
    navigator.serviceWorker.register(swUrl)
      .then(reg => console.log('[SW] registrado en:', reg.scope))
      .catch(console.error);
  });
}
