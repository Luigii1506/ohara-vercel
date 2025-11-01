// Custom Service Worker extensions
// Este archivo se puede usar para agregar funcionalidad personalizada al SW

// Escuchar mensajes del cliente (para SKIP_WAITING)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notificar a todos los clientes cuando el SW se activa
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Tomar control de todos los clientes inmediatamente
      if (self.clients && self.clients.claim) {
        await self.clients.claim();
      }

      // Notificar a todos los clientes que hay un nuevo SW
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: self.registration.scope,
        });
      });
    })()
  );
});

console.log('[SW] Custom extensions loaded');
