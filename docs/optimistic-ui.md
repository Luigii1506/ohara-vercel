# Optimistic UI - Sin Inmutación en Hard Refresh

## 2025-01-03 - Implementación tipo Pokedex.org

### El Secreto: Stale-While-Revalidate

Sites como Pokedex.org no "refrescan" porque usan una estrategia donde:
1. **Muestran datos viejos inmediatamente**
2. **Revalidan en background silenciosamente**
3. **Actualizan sin flash cuando está listo**

### Implementación

#### 1. QueryClient con Persist
```typescript
// components/QueryProvider.tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 15,     // 15min fresh
      gcTime: 1000 * 60 * 60 * 24,   // 24h cache
      networkMode: 'offlineFirst',    // Cache-first
      placeholderData: (prev) => prev, // ⚡ CLAVE
    }
  }
})

// Persistir en localStorage
persistQueryClient({
  queryClient,
  persister: createSyncStoragePersister({
    storage: window.localStorage,
  }),
  maxAge: 1000 * 60 * 60 * 24, // 24h
  buster: 'v1',
})
```

#### 2. Hook Optimista
```typescript
// hooks/useCardsQuery.ts
export const useCardsQuery = () => {
  return useQuery({
    queryKey: ['cards'],
    queryFn: fetchCards,

    // ⚡ Configuración optimista
    staleTime: 1000 * 60 * 15,
    placeholderData: (previousData) => previousData,
    refetchOnMount: 'always',
    networkMode: 'offlineFirst',
  });
};
```

#### 3. Background Update Checker
```typescript
export const useCheckCardsUpdate = () => {
  return useQuery({
    queryKey: ['cards-last-updated'],
    queryFn: checkLastUpdated,

    // Check cada 5min en background
    refetchInterval: 1000 * 60 * 5,

    // Si detecta cambio, invalidar
    onSuccess: (serverTimestamp) => {
      if (serverTimestamp > cachedTimestamp) {
        queryClient.invalidateQueries(['cards']);
      }
    },
  });
};
```

### Flujo Completo

```
Usuario hace hard refresh (Cmd+Shift+R)
    ↓
1. React Query lee localStorage (0ms)
    ↓
2. Muestra datos cached INMEDIATAMENTE
    ↓
3. En background: fetch /api/cards
    ↓
4. Compara con cache
    ↓
5. Si hay cambios → Actualiza suavemente
    Si no hay cambios → No hace nada
```

### Comparación

| Acción | Sin Optimistic UI | Con Optimistic UI |
|--------|------------------|-------------------|
| **Primera carga** | 800ms blank | 800ms loading |
| **Hard refresh** | 800ms blank ❌ | 0ms, datos viejos ✅ |
| **Tab focus** | Re-fetch | Silent background |
| **Network offline** | Error ❌ | Usa cache ✅ |
| **Stale data** | Force fetch | Background update |

### Ventajas

**UX:**
- ✅ **Zero blank screens** - Siempre hay contenido
- ✅ **Instant navigation** - 0ms perceived load
- ✅ **Silent updates** - Usuario no ve "loading"
- ✅ **Offline-first** - Funciona sin internet

**Performance:**
- ✅ **LocalStorage persist** - Sobrevive a refreshes
- ✅ **Shared cache** - Todas las tabs comparten
- ✅ **Background sync** - No bloquea UI
- ✅ **Smart refetch** - Solo si data > 15min

**Developer:**
- ✅ **Auto-retry** - 2 reintentos con backoff
- ✅ **Error handling** - Usa cache si falla
- ✅ **DevTools** - Inspect queries en vivo
- ✅ **Type-safe** - Full TypeScript

### Configuración por Tipo de Data

```typescript
// Datos que cambian poco (cards, sets)
staleTime: 1000 * 60 * 15  // 15 min

// Datos que cambian medio (inventory)
staleTime: 1000 * 60 * 5   // 5 min

// Datos en tiempo real (chat, notifications)
staleTime: 0               // Siempre stale
refetchInterval: 10000     // Poll cada 10s
```

### Invalidación Manual

```typescript
const { refresh } = useRefreshCards();

// Forzar actualización
onClick={() => refresh()}

// Limpiar cache completo
onClick={() => {
  queryClient.clear();
  window.location.reload();
}}
```

### Debugging

**React Query DevTools:**
- Ver estado de queries (fresh/stale/fetching)
- Inspeccionar cache
- Refetch manual
- Ver network requests

**Console Logs:**
```
✅ Datos actualizados
🔄 Nueva versión detectada, actualizando en background...
⚠️ Network error, usando cache
```

### Migración desde Zustand

**Antes:**
```typescript
const { cards, fetchCards } = useCardStore();

useEffect(() => {
  fetchCards();
}, []);
```

**Ahora:**
```typescript
const { data: cards } = useCardsQuery();
useCheckCardsUpdate(); // Auto-background check

// No useEffect needed! 🎉
```

### Próximos Pasos

1. **Service Worker** - True offline support
2. **Incremental updates** - Solo fetch cambios
3. **Optimistic mutations** - Update UI antes de server response
4. **Prefetch on hover** - Precargar al hacer hover links

### Resultado Final

**Hard refresh experience:**
```
Antes: [BLANK] → [Loading...] → [Content]
Ahora: [Old Content] → [Silently updated] → [New Content]
```

**Exactamente como Pokedex.org** ✨
