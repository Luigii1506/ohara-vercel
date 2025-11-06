/**
 * Cloudflare Worker - Image Optimization con R2
 * Maneja transformación, cache y serving de imágenes
 */

export interface Env {
  IMAGES_BUCKET: R2Bucket;
  IMAGE_CACHE?: KVNamespace;
  ENVIRONMENT?: string;
  CACHE_TTL?: string;
  MAX_IMAGE_SIZE?: string;
  ALLOWED_FORMATS?: string;
}

interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

const DEFAULT_CACHE_TTL = 31536000; // 1 year
const DEFAULT_QUALITY = 80;
const MAX_WIDTH = 2000;
const MAX_HEIGHT = 2000;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response('OK', { status: 200 });
      }

      // Parse image path (remove leading slash)
      const imagePath = url.pathname.slice(1);

      if (!imagePath) {
        return new Response('Image path required', { status: 400 });
      }

      // Parse transformation options from query params
      const options = parseTransformOptions(url.searchParams);

      // Validate options
      const validation = validateOptions(options);
      if (!validation.valid) {
        return new Response(validation.error, { status: 400 });
      }

      // Generate cache key
      const cacheKey = generateCacheKey(imagePath, options);

      // Check Cloudflare Cache first
      const cache = caches.default;
      let response = await cache.match(cacheKey);

      if (response) {
        // Cache HIT
        const headers = new Headers(response.headers);
        headers.set('X-Cache', 'HIT');
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }

      // Cache MISS - Get from R2
      const object = await env.IMAGES_BUCKET.get(imagePath);

      if (!object) {
        return new Response('Image not found', { status: 404 });
      }

      // Get original image data
      const imageData = await object.arrayBuffer();

      // Transform image
      const transformedImage = await transformImage(imageData, options, request);

      // Create response with proper headers
      const cacheTTL = parseInt(env.CACHE_TTL || String(DEFAULT_CACHE_TTL));
      response = new Response(transformedImage, {
        status: 200,
        headers: {
          'Content-Type': `image/${options.format || 'webp'}`,
          'Cache-Control': `public, max-age=${cacheTTL}, immutable`,
          'CDN-Cache-Control': `max-age=${cacheTTL}`,
          'Vary': 'Accept',
          'X-Cache': 'MISS',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });

      // Store in Cloudflare Cache
      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return response;

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        `Internal Server Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { status: 500 }
      );
    }
  },
};

/**
 * Parse transformation options from URL search params
 */
function parseTransformOptions(params: URLSearchParams): ImageTransformOptions {
  const options: ImageTransformOptions = {};

  // Width
  const width = params.get('width');
  if (width) {
    const parsed = parseInt(width);
    if (!isNaN(parsed) && parsed > 0) {
      options.width = Math.min(parsed, MAX_WIDTH);
    }
  }

  // Height
  const height = params.get('height');
  if (height) {
    const parsed = parseInt(height);
    if (!isNaN(parsed) && parsed > 0) {
      options.height = Math.min(parsed, MAX_HEIGHT);
    }
  }

  // Quality
  const quality = params.get('quality');
  if (quality) {
    const parsed = parseInt(quality);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
      options.quality = parsed;
    }
  } else {
    options.quality = DEFAULT_QUALITY;
  }

  // Format
  const format = params.get('format');
  if (format && ['webp', 'avif', 'jpeg', 'png'].includes(format)) {
    options.format = format as ImageTransformOptions['format'];
  } else {
    options.format = 'webp'; // Default to WebP
  }

  // Fit
  const fit = params.get('fit');
  if (fit && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(fit)) {
    options.fit = fit as ImageTransformOptions['fit'];
  } else {
    options.fit = 'contain'; // Default to contain
  }

  return options;
}

/**
 * Validate transformation options
 */
function validateOptions(options: ImageTransformOptions): { valid: boolean; error?: string } {
  if (options.width && (options.width < 1 || options.width > MAX_WIDTH)) {
    return { valid: false, error: `Width must be between 1 and ${MAX_WIDTH}` };
  }

  if (options.height && (options.height < 1 || options.height > MAX_HEIGHT)) {
    return { valid: false, error: `Height must be between 1 and ${MAX_HEIGHT}` };
  }

  if (options.quality && (options.quality < 1 || options.quality > 100)) {
    return { valid: false, error: 'Quality must be between 1 and 100' };
  }

  return { valid: true };
}

/**
 * Generate cache key for the transformed image
 */
function generateCacheKey(path: string, options: ImageTransformOptions): string {
  const parts = [
    path,
    options.width || 'auto',
    options.height || 'auto',
    options.quality || DEFAULT_QUALITY,
    options.format || 'webp',
    options.fit || 'contain',
  ];
  return parts.join('-');
}

/**
 * Transform image using Cloudflare's Image Resizing
 * Docs: https://developers.cloudflare.com/images/image-resizing/
 */
async function transformImage(
  imageData: ArrayBuffer,
  options: ImageTransformOptions,
  request: Request
): Promise<ArrayBuffer> {
  // Create a new Request with the image data
  const imageRequest = new Request('https://example.com/image', {
    method: 'GET',
    headers: request.headers,
  });

  // Build resize options for Cloudflare
  const resizeOptions: any = {
    quality: options.quality || DEFAULT_QUALITY,
    format: options.format || 'webp',
  };

  if (options.width) {
    resizeOptions.width = options.width;
  }

  if (options.height) {
    resizeOptions.height = options.height;
  }

  if (options.fit) {
    resizeOptions.fit = options.fit;
  }

  // Use Cloudflare's built-in image transformation
  // Note: This requires Cloudflare Images subscription OR we can use fetch with cf.image
  const transformedResponse = await fetch(imageRequest, {
    cf: {
      image: resizeOptions,
    },
  });

  if (!transformedResponse.ok) {
    // If CF transformation fails, return original
    console.warn('Image transformation failed, returning original');
    return imageData;
  }

  return await transformedResponse.arrayBuffer();
}
