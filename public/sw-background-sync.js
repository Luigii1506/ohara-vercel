// ============================================
// BACKGROUND SYNC - Service Worker Extension
// ============================================

const SYNC_QUEUE_NAME = 'ohara-sync-queue';
const SYNC_TAG = 'ohara-background-sync';

// Database para guardar requests pendientes
let db;

// Inicializar IndexedDB para la cola de sincronización
async function initSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ohara-sync-db', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store para requests pendientes
      if (!db.objectStoreNames.contains('sync-queue')) {
        const store = db.createObjectStore('sync-queue', {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

// Guardar request en la cola
async function saveToSyncQueue(request) {
  if (!db) {
    db = await initSyncDB();
  }

  const transaction = db.transaction(['sync-queue'], 'readwrite');
  const store = transaction.objectStore('sync-queue');

  const syncRequest = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now(),
    type: request.url.includes('/deck') ? 'deck' :
          request.url.includes('/collection') ? 'collection' :
          'other'
  };

  return new Promise((resolve, reject) => {
    const req = store.add(syncRequest);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Obtener todos los requests pendientes
async function getAllPendingSync() {
  if (!db) {
    db = await initSyncDB();
  }

  const transaction = db.transaction(['sync-queue'], 'readonly');
  const store = transaction.objectStore('sync-queue');

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Eliminar request de la cola después de sincronizar
async function removeFromSyncQueue(id) {
  if (!db) {
    db = await initSyncDB();
  }

  const transaction = db.transaction(['sync-queue'], 'readwrite');
  const store = transaction.objectStore('sync-queue');

  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Interceptar requests que fallan por falta de conexión
self.addEventListener('fetch', (event) => {
  // Solo interceptar POST/PUT/PATCH/DELETE (modificaciones)
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method)) {
    return;
  }

  // Solo para nuestras APIs
  if (!event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request.clone())
      .catch(async (error) => {
        console.log('[SW] Request failed, saving for background sync:', event.request.url);

        // Guardar en cola de sincronización
        await saveToSyncQueue(event.request.clone());

        // Registrar sync
        if ('sync' in self.registration) {
          await self.registration.sync.register(SYNC_TAG);
        }

        // Responder con mensaje de que se guardó para después
        return new Response(
          JSON.stringify({
            offline: true,
            message: 'Guardado. Se sincronizará cuando vuelva la conexión.',
            queued: true
          }),
          {
            status: 202, // Accepted
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
  );
});

// Evento de sincronización en segundo plano
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);

  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncPendingRequests());
  }
});

// Sincronizar todos los requests pendientes
async function syncPendingRequests() {
  console.log('[SW] Starting background sync...');

  const pendingRequests = await getAllPendingSync();
  console.log(`[SW] Found ${pendingRequests.length} pending requests`);

  let successCount = 0;
  let failCount = 0;

  for (const syncRequest of pendingRequests) {
    try {
      // Recrear el request
      const request = new Request(syncRequest.url, {
        method: syncRequest.method,
        headers: syncRequest.headers,
        body: syncRequest.body || undefined,
      });

      // Intentar enviar
      const response = await fetch(request);

      if (response.ok) {
        // Éxito - eliminar de la cola
        await removeFromSyncQueue(syncRequest.id);
        successCount++;
        console.log(`[SW] ✅ Synced: ${syncRequest.url}`);
      } else {
        // Error del servidor - mantener en cola
        failCount++;
        console.log(`[SW] ❌ Server error: ${syncRequest.url} (${response.status})`);
      }
    } catch (error) {
      // Error de red - mantener en cola para siguiente sync
      failCount++;
      console.log(`[SW] ❌ Network error: ${syncRequest.url}`, error);
    }
  }

  console.log(`[SW] Sync complete: ${successCount} success, ${failCount} failed`);

  // Notificar a los clientes
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      success: successCount,
      failed: failCount,
      total: pendingRequests.length
    });
  });

  // Si quedan requests pendientes, programar otro sync
  if (failCount > 0) {
    console.log('[SW] Scheduling retry...');
    if ('sync' in self.registration) {
      await self.registration.sync.register(SYNC_TAG);
    }
  }
}

// Endpoint para verificar estado de sincronización
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'GET_SYNC_STATUS') {
    const pending = await getAllPendingSync();

    event.ports[0].postMessage({
      type: 'SYNC_STATUS',
      pendingCount: pending.length,
      pending: pending
    });
  }

  if (event.data && event.data.type === 'FORCE_SYNC') {
    console.log('[SW] Force sync requested');
    if ('sync' in self.registration) {
      await self.registration.sync.register(SYNC_TAG);
      event.ports[0].postMessage({ type: 'SYNC_STARTED' });
    }
  }

  if (event.data && event.data.type === 'CLEAR_SYNC_QUEUE') {
    console.log('[SW] Clearing sync queue');
    const pending = await getAllPendingSync();
    for (const item of pending) {
      await removeFromSyncQueue(item.id);
    }
    event.ports[0].postMessage({
      type: 'SYNC_QUEUE_CLEARED',
      cleared: pending.length
    });
  }
});

console.log('[SW] Background Sync module loaded');
