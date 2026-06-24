# AGENTS.md - Ohara TCG

> Este archivo contiene información esencial para agentes de IA que trabajen en este proyecto. Está escrito en español e inglés para máxima claridad.

---

## 📋 Project Overview / Resumen del Proyecto

**Ohara TCG** es una aplicación web completa para el juego de cartas "One Piece Card Game". Proporciona funcionalidades de:

- **Card Database**: Búsqueda, filtrado y visualización de cartas
- **Deck Builder**: Construcción y gestión de mazos con URL únicas compartibles
- **Collection Manager**: Gestión de colección personal de cartas
- **Tournament Tracker**: Seguimiento de torneos y metagame
- **Admin Panel**: Gestión completa de cartas, sets, eventos y productos
- **PWA**: Progressive Web App con soporte offline

### Technology Stack / Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.7 |
| **Styling** | Tailwind CSS 3.4 + Radix UI |
| **Database** | PostgreSQL (Neon) + Prisma ORM |
| **Auth** | NextAuth.js v4 |
| **State** | Zustand (UI) + TanStack Query (Server) |
| **Cache** | IndexedDB (idb-keyval) + Service Worker |
| **PWA** | next-pwa + Workbox |
| **Images** | Cloudflare R2 + Cloudflare Worker |
| **Deploy** | Vercel (frontend) + Cloudflare Workers (images) |

---

## 🏗️ Architecture / Arquitectura

### Directory Structure / Estructura de Directorios

```
/Users/luisencinas/Documents/GitHub/ohara-vercel/
├── app/                      # Next.js App Router
│   ├── (routes)/            # Rutas de la aplicación
│   │   ├── card-list/       # Lista de cartas principal
│   │   ├── deckbuilder/     # Constructor de mazos
│   │   ├── collection/      # Gestión de colección
│   │   ├── events/          # Eventos y torneos
│   │   ├── tournaments/     # Tracker de torneos
│   │   ├── admin/           # Panel de administración
│   │   └── api/             # API Routes
│   ├── layout.tsx           # Root layout con providers
│   ├── page.tsx             # Home (redirect a /card-list)
│   └── globals.css          # Estilos globales
├── components/              # Componentes React
│   ├── ui/                  # Shadcn/Radix UI components
│   ├── deckbuilder/         # Componentes específicos
│   ├── collection/          # Componentes de colección
│   └── ...
├── lib/                     # Utilidades y configuración
│   ├── prisma.ts            # Cliente Prisma
│   ├── react-query/         # Configuración TanStack Query
│   ├── services/            # Servicios (scraping, APIs)
│   └── cards/               # Lógica de cartas
├── store/                   # Zustand stores
│   ├── cardStore.ts         # UI state de cartas
│   └── ...
├── hooks/                   # Custom React hooks
│   ├── queries/             # TanStack Query hooks
│   └── ...
├── prisma/
│   └── schema.prisma        # Esquema de base de datos
├── scripts/                 # Scripts de migración/utilidad
└── cloudflare/              # Cloudflare Worker (imágenes)
```

### Key Architectural Decisions / Decisiones Clave

1. **Hybrid State Management**: 
   - **Zustand**: Solo UI state (modales, filtros, preferencias)
   - **TanStack Query**: Server state (cartas, sets, torneos) con persistencia en IndexedDB

2. **Image Architecture**:
   - Cloudflare R2 como storage de imágenes
   - Cloudflare Worker para optimización on-the-fly (WebP, resizing)
   - CDN: `images.oharatcg.com`

3. **PWA Strategy**:
   - Service Worker solo cachea assets estáticos (NO páginas)
   - TanStack Query maneja datos offline con IndexedDB
   - Sin fallbacks offline para páginas

---

## 🛠️ Development Commands / Comandos de Desarrollo

### Essential Commands / Comandos Esenciales

```bash
# Development / Desarrollo
npm run dev              # Dev server en 0.0.0.0:3000
npm run dev:local        # Dev server local

# Build / Construcción
npm run build            # Build de producción (incluye PWA)
npm run build:analyze    # Build con análisis de bundle

# Database / Base de datos
npm run prisma:generate  # Generar cliente Prisma
npm run prisma:migrate   # Ejecutar migraciones
npm run prisma:studio    # Abrir Prisma Studio
npm run prisma:push      # Push schema a DB

# Scripts de migración
npm run migrate:r2              # Migrar imágenes a R2
npm run migrate:r2:dry          # Dry run
npm run migrate:update-db       # Actualizar URLs en DB
npm run migrate:check-urls      # Verificar URLs de imágenes

# Sync / Sincronización
npm run sync:tcg-catalog        # Sincronizar catálogo TCG
npm run sync:tcgplayer-prices   # Sincronizar precios TCGplayer
npm run sync:sequences          # Sincronizar secuencias de cartas

# Torneos
npm run tournaments:sync:limitless    # Scrape torneos de Limitless
npm run tournaments:test:onepiecegg   # Test scraper de onepiece.gg
```

---

## 🔄 State Management / Gestión de Estado

### TanStack Query Configuration / Configuración

Ubicación: `components/QueryProvider.tsx`

```typescript
// Cache settings
staleTime: 1 hour      // Datos "fresh" por 1 hora
gcTime: 24 hours       // Garbage collection después de 24h
refetchOnWindowFocus: false
refetchOnMount: false
networkMode: 'offlineFirst'
```

**Persistencia**: IndexedDB (50MB-1GB) vs localStorage (5-10MB)

### Query Keys / Claves de Query

Ubicación: `lib/react-query/queryKeys.ts`

```typescript
export const queryKeys = {
  cards: { all: ["cards", "all"], byId: (id) => ["cards", "byId", id] },
  sets: { all: ["sets", "all"] },
  tournaments: { all: ["tournaments", "all"] },
};
```

### Zustand Stores

| Store | Propósito | Persistencia |
|-------|-----------|--------------|
| `cardStore` | UI state de cartas (filtros colapsados) | ❌ No |
| `cartStore` | Carrito de compras | ✅ localStorage |
| `inventoryStore` | Inventario de usuario | ✅ localStorage |

---

## 🗄️ Database / Base de Datos

### Schema Overview / Resumen del Esquema

**Modelos principales:**
- `Card` - Cartas del juego
- `Set` - Sets/expansiones
- `Deck`/`DeckCard` - Mazos y sus cartas
- `Collection`/`CollectionCard` - Colecciones de usuarios
- `Tournament`/`TournamentDeck` - Torneos y mazos ganadores
- `Event`/`EventCard`/`EventProduct` - Eventos del juego
- `User`/`Account`/`Session` - Autenticación (NextAuth)

### Important Indexes / Índices Importantes

```prisma
// Para búsquedas rápidas por código
@@index([code, isFirstEdition])
@@index([code, region, isFirstEdition])

// Para ordenamiento de colección
@@index([collectionOrder])
```

### Environment Variables / Variables de Entorno

```bash
DATABASE_URL="postgresql://..."           # Connection pooled
DATABASE_URL_UNPOOLED="postgresql://..."  # Para migraciones
```

---

## 🔐 Authentication / Autenticación

### NextAuth Configuration / Configuración

Ubicación: `app/api/auth/[...nextauth]/route.js`

**Providers**:
- Google OAuth
- Discord OAuth

**Roles**:
- `USER` - Usuario normal
- `ADMIN` - Acceso a panel de administración

### Protected Routes / Rutas Protegidas

Middleware: `middleware.ts`
- `/admin/*` → Requiere rol ADMIN
- Redirección a `/login` si no autenticado
- Redirección a `/unauthorized` si no es admin

---

## 🖼️ Image Handling / Manejo de Imágenes

### Image Sources / Fuentes de Imágenes

| Fuente | Uso | Patrón |
|--------|-----|--------|
| Cloudflare R2 | Principal | `images.oharatcg.com` |
| KeyCDN | Fallback | `*.kxcdn.com` |
| DigitalOcean Spaces | Legacy | `*.digitaloceanspaces.com` |
| static.dotgg.gg | Terceros | `static.dotgg.gg` |

### Remote Patterns (next.config.mjs)

```javascript
images: {
  remotePatterns: [
    { hostname: "images.oharatcg.com" },
    { hostname: "*.r2.dev" },
    { hostname: "*.digitaloceanspaces.com" },
    // ... más patrones
  ],
  formats: ["image/webp", "image/avif"],
}
```

### Cloudflare Worker

Ubicación: `cloudflare/`
- Endpoint: `https://images.oharatcg.com`
- Funciones: WebP conversion, resizing, caching
- Headers: `cache-control: public, max-age=31536000, immutable`

---

## 📱 PWA Configuration / Configuración PWA

### Service Worker Strategy / Estrategia del SW

Ubicación: `next.config.mjs`

```javascript
workboxOptions: {
  runtimeCaching: [
    // Assets estáticos - CacheFirst
    { urlPattern: /^\/_next\/static\/.*/i, handler: "CacheFirst" },
    
    // Imágenes de CDN - CacheFirst
    { urlPattern: /^https:\/\/.*\.kxcdn\.com\/.*$/i, handler: "CacheFirst" },
    { urlPattern: /^https:\/\/images\.oharatcg\.com\/.*$/i, handler: "CacheFirst" },
    
    // ❌ NO cachear API - TanStack Query maneja esto
  ]
}
```

### Manifest

Ubicación: `public/manifest.json`
- Theme color: `#1a1a1a`
- Background color: `#000000`
- Display: `standalone`

---

## 🧪 Testing & Debugging / Pruebas y Depuración

### Service Worker Debugging

```bash
# Desarrollo
npm run build && npm start

# DevTools
Application → Service Workers → "Unregister" y recarga
```

### TanStack Query DevTools

- Solo disponible en desarrollo
- Botón flotante en esquina inferior izquierda
- Inspeccionar cache, queries, mutations

### Common Issues / Problemas Comunes

**Service Worker no registra:**
1. Verificar HTTPS (localhost funciona sin HTTPS)
2. Application → Clear storage → Rebuild

**Caché de imágenes no funciona:**
1. Application → Clear storage
2. Reconstruir: `npm run build`
3. Hard reload: Ctrl+Shift+F5

**Error "Cannot find name 'R2Bucket'":**
- Ya resuelto: `tsconfig.json` excluye directorio `cloudflare/`
- Vercel NO compila el worker

---

## 🚀 Deployment / Despliegue

### Vercel (Frontend)

```bash
git push origin main  # Auto-deploy
```

### Cloudflare Worker (Images)

```bash
cd cloudflare
npm run deploy:staging     # Testing
npm run deploy:production  # Producción
npm run tail              # Logs en tiempo real
```

### Environment Variables Required / Variables Requeridas

```bash
# Database
DATABASE_URL
DATABASE_URL_UNPOOLED

# NextAuth
NEXTAUTH_URL
NEXTAUTH_SECRET

# OAuth
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET

# Cloudflare R2
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
NEXT_PUBLIC_WORKER_URL

# APIs
TCGPLAYER_PUBLIC_KEY
TCGPLAYER_PRIVATE_KEY
GEMINI_API_KEY
```

---

## 📝 Code Style Guidelines / Guías de Estilo

### TypeScript

- Usar `type` para tipos, `interface` para objetos que se extienden
- Path alias: `@/` para imports desde root
- Strict mode habilitado

### React Components

```typescript
// Nomenclatura de archivos
ComponentName.tsx        # Componente principal
ComponentName.module.scss # Estilos modulares (si aplica)

// Ejemplo de estructura
"use client";           # Si necesita hooks del cliente

import { useState } from "react";
import { useCardsQuery } from "@/hooks/queries/useCardsQuery";

interface Props {
  cardId: string;
}

export function CardComponent({ cardId }: Props) {
  const { data, isLoading } = useCardsQuery();
  // ...
}
```

### Styling / Estilos

- Tailwind para estilos rápidos
- SCSS modules para estilos complejos (ej: `event.module.scss`)
- Variables CSS en `globals.css` para theming

---

## 🔒 Security Considerations / Consideraciones de Seguridad

1. **Middleware**: Siempre verificar rol ADMIN en rutas `/admin/*`
2. **API Routes**: Verificar sesión en rutas sensibles
3. **Env vars**: Nunca exponer keys privadas en cliente
4. **Images**: Validar uploads a R2 (tipos MIME, tamaño)

---

## 📚 Additional Documentation / Documentación Adicional

- `DEPLOYMENT-GUIDE.md` - Guía completa de despliegue
- `PWA_README.md` - Documentación de PWA
- `TANSTACK_QUERY_IMPLEMENTATION.md` - Guía de TanStack Query
- `MIGRATION-GUIDE.md` - Guías de migración
- `cloudflare/README-START-HERE.md` - Cloudflare Worker

---

## 🆘 Quick Reference / Referencia Rápida

| Task | Command |
|------|---------|
| Start dev | `npm run dev` |
| Build | `npm run build` |
| DB migrate | `npm run prisma:migrate` |
| DB studio | `npm run prisma:studio` |
| Deploy worker | `cd cloudflare && npm run deploy:production` |
| View worker logs | `cd cloudflare && npm run tail` |

---

*Última actualización: Febrero 2026*
