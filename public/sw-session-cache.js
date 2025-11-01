// ============================================
// SESSION CACHING - Service Worker Extension
// ============================================

const SESSION_CACHE_NAME = 'ohara-session-cache';
const SESSION_ENDPOINTS = [
  '/api/auth/session',
  '/api/auth/csrf',
  '/__nextauth',
];

// Cachear respuesta de sesión
async function cacheSessionResponse(request, response) {
  try {
    const cache = await caches.open(SESSION_CACHE_NAME);

    // Solo cachear respuestas exitosas con sesión válida
    if (response.status === 200) {
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();

      // Verificar que tenga datos de usuario
      if (data && data.user) {
        console.log('[SW-Session] Caching session for:', data.user.email);

        // Cachear respuesta
        await cache.put(request, response.clone());

        // Guardar timestamp
        const metadata = {
          url: request.url,
          cachedAt: Date.now(),
          user: data.user.email
        };
        await cache.put(
          new Request(request.url + '-metadata'),
          new Response(JSON.stringify(metadata))
        );
      }
    }
  } catch (error) {
    console.error('[SW-Session] Error caching session:', error);
  }
}

// Obtener sesión cacheada
async function getCachedSession(request) {
  try {
    const cache = await caches.open(SESSION_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (!cachedResponse) {
      return null;
    }

    // Verificar metadata
    const metadataResponse = await cache.match(
      new Request(request.url + '-metadata')
    );

    if (metadataResponse) {
      const metadata = await metadataResponse.json();
      const age = Date.now() - metadata.cachedAt;
      const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 días

      if (age > MAX_AGE) {
        console.log('[SW-Session] Cached session expired');
        await cache.delete(request);
        await cache.delete(new Request(request.url + '-metadata'));
        return null;
      }

      console.log('[SW-Session] Using cached session for:', metadata.user);
    }

    return cachedResponse;
  } catch (error) {
    console.error('[SW-Session] Error getting cached session:', error);
    return null;
  }
}

// Verificar si es endpoint de sesión
function isSessionEndpoint(url) {
  return SESSION_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

// Interceptar requests de sesión
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo interceptar endpoints de sesión
  if (!isSessionEndpoint(url.pathname)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        // Si la request tuvo éxito, cachear la respuesta
        await cacheSessionResponse(event.request, response.clone());
        return response;
      })
      .catch(async (error) => {
        console.log('[SW-Session] Session request failed, using cache');

        // Si falla (offline), intentar usar caché
        const cachedResponse = await getCachedSession(event.request);

        if (cachedResponse) {
          // Agregar header para indicar que es de caché
          const headers = new Headers(cachedResponse.headers);
          headers.set('X-From-Cache', 'true');
          headers.set('X-Offline-Session', 'true');

          const body = await cachedResponse.text();

          return new Response(body, {
            status: 200,
            statusText: 'OK (Cached)',
            headers: headers
          });
        }

        // Si no hay caché, retornar error
        return new Response(
          JSON.stringify({
            error: 'No session available offline',
            offline: true
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
  );
});

// Limpiar caché de sesión cuando el usuario hace logout
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'CLEAR_SESSION_CACHE') {
    console.log('[SW-Session] Clearing session cache');

    try {
      const cache = await caches.open(SESSION_CACHE_NAME);
      const keys = await cache.keys();

      for (const request of keys) {
        await cache.delete(request);
      }

      event.ports[0].postMessage({
        type: 'SESSION_CACHE_CLEARED'
      });
    } catch (error) {
      console.error('[SW-Session] Error clearing cache:', error);
      event.ports[0].postMessage({
        type: 'SESSION_CACHE_ERROR',
        error: error.message
      });
    }
  }
});

console.log('[SW] Session caching module loaded');
