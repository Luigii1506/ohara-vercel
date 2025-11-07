/**
 * Cloudflare Worker - Versión Simple (Sin transformación en edge)
 *
 * ESTRATEGIA:
 * - Sirve imágenes directamente desde R2
 * - Cache agresivo en Cloudflare Edge (300+ locations)
 * - Las transformaciones se hacen ANTES de subir a R2 (pre-procesamiento)
 *
 * Esta versión es GRATIS y funciona perfecto porque:
 * 1. Subes cada imagen ya optimizada en varios tamaños (thumb, small, medium, large)
 * 2. El Worker solo sirve y cachea (ultra rápido)
 * 3. Zero costos de transformación
 */

export interface Env {
  IMAGES_BUCKET: R2Bucket;
  ENVIRONMENT?: string;
  CACHE_TTL?: string;
  KEYCDN_FALLBACK_URL?: string;
}

const DEFAULT_CACHE_TTL = 31536000; // 1 year
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'];
const KEYCDN_FALLBACK = 'https://oharatcg-21eab.kxcdn.com';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Only allow GET and HEAD requests
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405 });
      }

      const url = new URL(request.url);

      // Health check
      if (url.pathname === '/health') {
        return new Response('OK', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      // Parse image path
      const imagePath = url.pathname.slice(1); // Remove leading slash

      if (!imagePath) {
        return new Response('Image path required', { status: 400 });
      }

      // Validate file extension
      const extension = imagePath.split('.').pop()?.toLowerCase();
      if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
        return new Response('Invalid file type', { status: 400 });
      }

      // Generate cache key (include full URL to support query params if needed)
      const cacheKey = new Request(request.url, request);
      const cache = caches.default;

      // Check Cloudflare Edge Cache
      let response = await cache.match(cacheKey);

      if (response) {
        // Cache HIT - return immediately
        const headers = new Headers(response.headers);
        headers.set('X-Cache-Status', 'HIT');
        headers.set('X-Served-By', 'Cloudflare-Worker');

        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }

      // Cache MISS - Fetch from R2
      let object = await env.IMAGES_BUCKET.get(imagePath);

      if (!object) {
        // Try alternative paths (backwards compatibility)
        const fallbackPaths = generateFallbackPaths(imagePath);

        for (const fallbackPath of fallbackPaths) {
          const fallbackObject = await env.IMAGES_BUCKET.get(fallbackPath);
          if (fallbackObject) {
            return createImageResponse(fallbackObject, fallbackPath, env, cache, cacheKey, ctx);
          }
        }

        // Image not in R2 - Fallback to KeyCDN
        console.log(`Image not found in R2: ${imagePath}, falling back to KeyCDN`);
        return fallbackToKeyCDN(imagePath, env);
      }

      return createImageResponse(object, imagePath, env, cache, cacheKey, ctx);

    } catch (error) {
      console.error('Worker error:', error);

      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },
};

/**
 * Create image response with proper headers and caching
 */
async function createImageResponse(
  object: R2ObjectBody,
  imagePath: string,
  env: Env,
  cache: Cache,
  cacheKey: Request,
  ctx: ExecutionContext
): Promise<Response> {
  const headers = new Headers();

  // Content-Type based on file extension
  const extension = imagePath.split('.').pop()?.toLowerCase();
  const contentType = getContentType(extension || '');
  headers.set('Content-Type', contentType);

  // Cache headers
  const cacheTTL = parseInt(env.CACHE_TTL || String(DEFAULT_CACHE_TTL));
  headers.set('Cache-Control', `public, max-age=${cacheTTL}, immutable`);
  headers.set('CDN-Cache-Control', `max-age=${cacheTTL}`);

  // CORS headers
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Max-Age', '86400');

  // Additional headers
  headers.set('X-Cache-Status', 'MISS');
  headers.set('X-Served-By', 'Cloudflare-Worker');
  headers.set('Vary', 'Accept-Encoding');

  // ETag for caching validation
  if (object.etag) {
    headers.set('ETag', object.etag);
  }

  // Last-Modified
  if (object.uploaded) {
    headers.set('Last-Modified', object.uploaded.toUTCString());
  }

  // Content-Length
  headers.set('Content-Length', String(object.size));

  const response = new Response(object.body, {
    status: 200,
    headers,
  });

  // Store in Cloudflare Edge Cache asynchronously
  ctx.waitUntil(cache.put(cacheKey, response.clone()));

  return response;
}

/**
 * Generate fallback paths to try for backwards compatibility
 * Handles different path formats and WebP conversions
 */
function generateFallbackPaths(imagePath: string): string[] {
  const paths: string[] = [];

  // Get file parts
  const lastSlashIndex = imagePath.lastIndexOf('/');
  const directory = lastSlashIndex >= 0 ? imagePath.substring(0, lastSlashIndex + 1) : '';
  const filename = lastSlashIndex >= 0 ? imagePath.substring(lastSlashIndex + 1) : imagePath;

  // Get filename without extension
  const lastDotIndex = filename.lastIndexOf('.');
  const baseName = lastDotIndex >= 0 ? filename.substring(0, lastDotIndex) : filename;
  const extension = lastDotIndex >= 0 ? filename.substring(lastDotIndex) : '';

  // If requesting .png or .jpg, try WebP equivalents with size suffixes
  if (extension === '.png' || extension === '.jpg' || extension === '.jpeg') {
    // Try different size variants (most common first)
    const sizes = ['', '-medium', '-large', '-small', '-thumb', '-xs', '-tiny'];

    for (const size of sizes) {
      paths.push(`${directory}${baseName}${size}.webp`);
    }

    // Also try original extension
    paths.push(imagePath);
  } else if (extension === '.webp') {
    // Already WebP, just try as-is and with/without size suffix
    paths.push(imagePath);
  }

  // Try with/without images/ prefix
  paths.push(imagePath.replace(/^images\//, '')); // Remove images/ prefix
  paths.push(`images/${imagePath}`); // Add images/ prefix

  // Try with/without cards/ prefix
  if (!imagePath.startsWith('cards/')) {
    paths.push(`cards/${imagePath}`);
  }

  return [...new Set(paths)]; // Remove duplicates
}

/**
 * Get Content-Type header based on file extension
 */
function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'avif': 'image/avif',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
  };

  return contentTypes[extension] || 'application/octet-stream';
}

/**
 * Fallback to KeyCDN if image not found in R2
 * This allows gradual migration without breaking the site
 */
async function fallbackToKeyCDN(imagePath: string, env: Env): Promise<Response> {
  const keyCDNUrl = env.KEYCDN_FALLBACK_URL || KEYCDN_FALLBACK;

  // Convert R2 path back to KeyCDN path
  // R2: cards/OP01-001-medium.webp
  // KeyCDN: /images/OP01-001.png

  let keyCDNPath = imagePath;

  // Remove cards/ prefix if exists
  if (keyCDNPath.startsWith('cards/')) {
    keyCDNPath = keyCDNPath.replace('cards/', '');
  }

  // Remove size suffix (-tiny, -xs, -thumb, -small, -medium, -large)
  keyCDNPath = keyCDNPath
    .replace(/-tiny\.webp$/, '.png')
    .replace(/-xs\.webp$/, '.png')
    .replace(/-thumb\.webp$/, '.png')
    .replace(/-small\.webp$/, '.png')
    .replace(/-medium\.webp$/, '.png')
    .replace(/-large\.webp$/, '.png')
    .replace(/\.webp$/, '.png');

  const fallbackUrl = `${keyCDNUrl}/images/${keyCDNPath}`;

  // Check if KeyCDN has the image with a HEAD request
  try {
    const headResponse = await fetch(fallbackUrl, { method: 'HEAD' });

    if (headResponse.ok) {
      // Image exists on KeyCDN, redirect to it
      return new Response(null, {
        status: 302,
        headers: {
          'Location': fallbackUrl,
          'X-Fallback-To': 'KeyCDN',
          'Cache-Control': 'public, max-age=3600', // Cache redirect for 1 hour
        },
      });
    }
  } catch (error) {
    console.error('Failed to check KeyCDN:', error);
  }

  // Image not found in R2 or KeyCDN, return 404
  return new Response('Image not found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=300', // Cache 404s for 5 minutes
      'X-Image-Path': imagePath,
    },
  });
}
