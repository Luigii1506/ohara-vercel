import withPWAInit from "@ducanh2912/next-pwa";
import withBundleAnalyzer from "@next/bundle-analyzer";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: false, // ❌ No cachear navegación
  aggressiveFrontEndNavCaching: false, // ❌ No precachear páginas
  reloadOnOnline: false,
  swcMinify: true,
  disable: false, // ✅ ACTIVADO solo para cache de imágenes
  // ❌ SIN fallbacks offline
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    disableDevLogs: true,
    // Limitar tamaño máximo de caché para evitar llenar disco
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB máximo por archivo
    // ❌ NO precachear páginas - solo runtime caching de imágenes
    runtimeCaching: [
      // ❌ NO cachear navegación ni páginas - solo imágenes y assets
      // ✅ ASSETS ESTÁTICOS (_next/static) - CacheFirst (inmutable)
      {
        urlPattern: /^\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static-assets",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 año (inmutable)
          },
        },
      },
      // ✅ ASSETS DE BUILD (_next/data) - StaleWhileRevalidate
      {
        urlPattern: /^\/_next\/data\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-data",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 1 día
          },
        },
      },
      // KeyCDN - Tu CDN principal (PRIORIDAD MÁXIMA)
      {
        urlPattern: /^https:\/\/.*\.kxcdn\.com\/.*$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "keycdn-optimized-images",
          expiration: {
            maxEntries: 5000, // Más espacio para imágenes optimizadas
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 año (immutable)
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
          // Plugin para cachear diferentes tamaños de la misma imagen
          plugins: [
            {
              cacheKeyWillBeUsed: async ({ request }) => {
                // Cachear por URL completa incluyendo query params (width, quality, etc)
                return request.url;
              },
            },
          ],
        },
      },
      // DigitalOcean Spaces (fallback)
      {
        urlPattern: /^https:\/\/.*\.digitaloceanspaces\.com\/.*$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "card-images-spaces",
          expiration: {
            maxEntries: 3000,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 año
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // dotgg
      {
        urlPattern: /^https:\/\/static\.dotgg\.gg\/.*$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "card-images-dotgg",
          expiration: {
            maxEntries: 1000,
            maxAgeSeconds: 180 * 24 * 60 * 60, // 6 meses
          },
        },
      },
      // Official site
      {
        urlPattern: /^https:\/\/en\.onepiece-cardgame\.com\/.*$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "card-images-official",
          expiration: {
            maxEntries: 1000,
            maxAgeSeconds: 180 * 24 * 60 * 60, // 6 meses
          },
        },
      },
      // ✅ ELIMINADO: Cache de API - TanStack Query maneja esto en IndexedDB
      // El Service Worker ahora SOLO cachea assets estáticos (imágenes, fonts)
      {
        urlPattern: /\.(?:png|jpg|jpeg|webp|svg|gif)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-images",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimizaciones de rendimiento
  compress: true, // Habilitar compresión gzip
  swcMinify: true, // Minificación más rápida con SWC

  // Optimizaciones de producción
  productionBrowserSourceMaps: false, // Deshabilitar source maps en producción

  // Optimización de CSS
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Optimización de módulos - Tree shaking automático
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      skipDefaultConversion: true,
    },
    '@headlessui/react': {
      transform: '@headlessui/react/dist/components/{{member}}/{{member}}.js',
    },
  },

  experimental: {
    serverComponentsExternalPackages: [
      "mongoose",
      "puppeteer",
      "cheerio",
      "@neondatabase/serverless",
      "@aws-sdk/client-s3",
      "xlsx",
    ],
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-label',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-progress',
      'framer-motion',
      'react-chartjs-2',
      'chart.js',
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.digitaloceanspaces.com",
      },
      {
        protocol: "https",
        hostname: "static.dotgg.gg",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "en.onepiece-cardgame.com",
      },
      {
        protocol: "https",
        hostname: "i.pinimg.com",
      },
      {
        protocol: "https",
        hostname: "assets.pokemon.com",
      },
      {
        protocol: "https",
        hostname: "bez3ta.com",
      },
      {
        protocol: "https",
        hostname: "spellmana.com",
      },
      {
        protocol: "https",
        hostname: "tcgplayer-cdn.tcgplayer.com",
      },
    ],
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
};

export default bundleAnalyzer(withPWA(nextConfig));
