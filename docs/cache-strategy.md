# Estrategia de Cache Mejorada

## 2025-01-03 - Sistema Multi-Capa

### Arquitectura

```
┌─────────────────────────────────────────────┐
│  Layer 1: CDN Optimizado                    │ <- Imágenes thumbnail/small
├─────────────────────────────────────────────┤
│  Layer 2: Browser HTTP Cache                │ <- 24h cache headers
├─────────────────────────────────────────────┤
│  Layer 3: React Query Cache                 │ <- 24h + stale-while-revalidate
├─────────────────────────────────────────────┤
│  Layer 4: Zustand Persist (LocalStorage)    │ <- 15min + server validation
└─────────────────────────────────────────────┘
```

### Mejoras Implementadas

#### 1. Zustand Store con Stale-Time
```typescript
// store/cardStore.ts
const CACHE_DURATION = 1000 * 60 * 15; // 15 minutos

isStale: () => {
  const lastUpdated = get().lastUpdated;
  if (!lastUpdated) return true;
  return Date.now() - lastUpdated > CACHE_DURATION;
}
```

**Flujo:**
1. Si cache < 15min → Usar inmediatamente
2. Si cache > 15min → Verificar con servidor
3. Si servidor sin cambios → Resetear timer, usar cache
4. Si servidor con cambios → Descargar nuevos datos

#### 2. Optimización CDN Automática
```typescript
// lib/imageOptimization.ts
getOptimizedImageUrl(url, 'small')
  → width=300, quality=70, format=auto

// Tamaños disponibles:
- thumb:   150px @ 60% (prefetch)
- small:   300px @ 70% (list view)
- medium:  600px @ 75% (modal)
- large:  1200px @ 80% (fullscreen)
- original: sin resize @ 85%
```

**Soporta:**
- ✅ Cloudinary
- ✅ Imgix
- ✅ Cloudflare Images
- ✅ DigitalOcean Spaces (preparado)

#### 3. React Query con Cache Inteligente
```typescript
// hooks/useImagePreload.ts
staleTime: Infinity     // Nunca re-fetch imágenes
gcTime: 24 horas        // Retener 24h en memoria
retry: 2                // 2 reintentos automáticos
```

### Ventajas

**Velocidad:**
- ✅ Primera carga: Imágenes small (70% más ligeras)
- ✅ Cache hit: 0ms (React Query + Browser)
- ✅ Stale cache: Solo 1 request GET pequeño (/last-updated)
- ✅ Prefetch: Top 20 en paralelo, resto en idle

**Actualización:**
- ✅ Check automático cada 15min
- ✅ Timestamp del servidor (no del cliente)
- ✅ Versioning con `version: 1` en persist
- ✅ Error handling: usa cache si falla network

**UX:**
- ✅ Skeleton con shimmer mientras carga
- ✅ Imágenes thumbnail → full progresivo
- ✅ Sin flash de contenido
- ✅ Offline-first (usa cache en errores)

### Métricas Esperadas

| Escenario | Antes | Ahora | Mejora |
|-----------|-------|-------|--------|
| **Primera visita** | 2.5s | 800ms | **68%** |
| **Cache válido** | 400ms | 0ms | **100%** |
| **Update check** | 2s fetch | 50ms GET | **97%** |
| **Bandwidth** | 5MB | 1.5MB | **70%** |
| **Cache duration** | Session | 15min | ∞ |

### Uso en Componentes

```tsx
// Lista (prioridad velocidad)
<OptimizedImage src={card.src} size="small" />

// Modal (prioridad calidad)
<OptimizedImage src={card.src} size="medium" />

// Fullscreen
<OptimizedImage src={card.src} size="large" priority />
```

### Configuración Recomendada

**Backend (Next.js API):**
```typescript
// /api/admin/cards/last-updated
export async function GET() {
  const lastCard = await db.cards.findOne()
    .sort({ updatedAt: -1 });

  return Response.json({
    lastUpdated: lastCard.updatedAt.getTime()
  }, {
    headers: {
      'Cache-Control': 'no-store', // Siempre fresh
    }
  });
}
```

**CDN Headers:**
```
Cache-Control: public, max-age=31536000, immutable
```

### Invalidación de Cache

**Manual:**
```typescript
const { forceRefresh } = useCardStore();
await forceRefresh(); // Bypass todo cache
```

**Automática:**
- Cambiar `version: 2` en persist config
- Cache expira a los 15 minutos
- Server devuelve nuevo lastUpdated

### Debug

```typescript
// Logs en consola:
✅ Cache local válido, usando datos existentes
✅ Datos sincronizados con servidor
🔄 Descargando datos actualizados del servidor...
✅ 1234 cartas actualizadas
⚠️ Usando cache local por error de red
```