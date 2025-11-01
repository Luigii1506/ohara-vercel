# 🚀 **Guía de Uso: TanStack Query + Hybrid Sync**

Esta guía te muestra cómo mantener **edit-card siempre actualizado** cuando agregues/modifiques cartas en **otras secciones** de la app.

---

## 📋 **Resumen del Sistema:**

- **Edit-Card**: `alwaysFresh: true` → Siempre obtiene datos frescos
- **Otras páginas**: Cache-first + invalidación cuando sea necesario
- **Sistema Híbrido**: Mantiene compatibilidad con Zustand + TanStack Query

---

## 🎯 **Uso Básico: Invalidar Cache**

### **Ejemplo 1: Add-Cards Page**

```typescript
// app/lists/[id]/add-cards/page.tsx
import { useHybridCardSync } from "@/hooks/queries/useHybridCardSync";

const AddCardsPage = () => {
  const { syncForceRefresh, optimisticUpdate } = useHybridCardSync();

  const handleAddCardToList = async (card: Card) => {
    // 1. Add to list
    await addCardToList(card);

    // 2. 🚀 Sync both systems (edit-card will refresh automatically)
    await syncForceRefresh();
  };

  return (
    // Your component...
  );
};
```

### **Ejemplo 2: Create New Card**

```typescript
// app/admin/create-card/page.tsx
import { useHybridCardSync } from "@/hooks/queries/useHybridCardSync";

const CreateCardPage = () => {
  const { optimisticUpdate, syncForceRefresh } = useHybridCardSync();

  const handleCreateCard = async (newCard: Card) => {
    // 1. Create in database
    const createdCard = await createCard(newCard);

    // 2. 🚀 Add to cache immediately (optimistic)
    optimisticUpdate.addCard(createdCard);

    // 3. 🚀 Sync both systems for safety
    await syncForceRefresh();
  };

  return (
    // Your component...
  );
};
```

### **Ejemplo 3: Simple Invalidation**

```typescript
// En cualquier página donde modifiques cartas
import { useInvalidateCards } from "@/hooks/queries/useInvalidateCards";

const SomePage = () => {
  const { invalidateCards } = useInvalidateCards();

  const handleModifyCard = async (card: Card) => {
    // 1. Modify card
    await updateCard(card);

    // 2. 🚀 Invalidate cache (edit-card will refresh in background)
    invalidateCards();
  };

  return (
    // Your component...
  );
};
```

---

## ⚡ **Uso Avanzado: Optimistic Updates**

### **Ejemplo 4: Instant UI Updates**

```typescript
// Para cambios que quieres ver INMEDIATAMENTE
import { useHybridCardSync } from "@/hooks/queries/useHybridCardSync";

const FastUpdatePage = () => {
  const { optimisticUpdate, syncForceRefresh } = useHybridCardSync();

  const handleQuickEdit = async (cardId: string, changes: Partial<Card>) => {
    // 1. 🚀 Update UI immediately (optimistic)
    optimisticUpdate.updateCard({ id: cardId, ...changes });

    // 2. Update database (in background)
    try {
      await updateCard(cardId, changes);
      // Success - optimistic update was correct
    } catch (error) {
      // Error - sync will revert the optimistic update
      await syncForceRefresh();
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    // 1. 🚀 Remove from UI immediately
    optimisticUpdate.removeCard(cardId);

    // 2. Delete from database
    try {
      await deleteCard(cardId);
    } catch (error) {
      // Error - revert
      await syncForceRefresh();
    }
  };

  return (
    // Your component...
  );
};
```

---

## 🎛️ **API Reference**

### **useHybridCardSync()**

```typescript
const {
  // 🔄 Main Methods
  syncForceRefresh, // Updates both Zustand + TanStack Query
  immediateSync, // Force immediate refetch (parallel)

  // ✨ Optimistic Updates
  optimisticUpdate: {
    addCard, // Add card to cache instantly
    updateCard, // Update card in cache instantly
    removeCard, // Remove card from cache instantly
  },

  // 🔧 Compatibility
  legacyRefresh, // Only Zustand (for old code)
  modernRefresh, // Only TanStack Query (for new code)
} = useHybridCardSync();
```

### **useInvalidateCards()**

```typescript
const {
  invalidateCards, // Basic invalidation
  invalidateAll, // Cards + Sets
  forceRefetch, // Immediate refetch
  updateCardInCache, // Manual cache update
  addCardToCache, // Manual cache addition
  removeCardFromCache, // Manual cache removal
} = useInvalidateCards();
```

---

## 🚀 **Flujo Completo de Datos:**

```
📱 Otras páginas modifican cartas
    ↓
🔄 syncForceRefresh() / invalidateCards()
    ↓
💾 TanStack Query cache se invalida
    ↓
📱 Edit-card (alwaysFresh: true) detecta cache stale
    ↓
⚡ Background refetch automático
    ↓
✨ Edit-card se actualiza con datos frescos
    ↓
🎯 Usuario ve datos actualizados instantáneamente
```

---

## 🎯 **Cuándo usar cada método:**

### **🔄 `syncForceRefresh()`** - **MÁS COMÚN**

- Cuando agregues/edites/elimines cartas
- Quieres máxima compatibilidad
- No te importa un pequeño delay

### **⚡ `optimisticUpdate`** - **PARA UX PREMIUM**

- Cambios que quieres ver al instante
- Tienes los datos disponibles localmente
- Puedes manejar errores revirtiendo

### **🎯 `invalidateCards()`** - **SIMPLE Y RÁPIDO**

- Solo usas TanStack Query
- Background update está bien
- Código más limpio

### **💾 `immediateSync()`** - **CASOS CRÍTICOS**

- Necesitas datos AHORA mismo
- Operaciones críticas de admin
- No puedes esperar background update

---

## ✅ **Resultado Final:**

Con este sistema, **edit-card SIEMPRE tendrá los datos más frescos** sin importar dónde modifiques cartas en la app.

- **Primera entrada a edit-card**: Skeleton → Data fresca
- **Refresh en edit-card**: Instantáneo desde cache → Background refetch
- **Modificas cartas en otra página**: edit-card se actualiza automáticamente
- **Zero configuración adicional**: Solo usa los hooks según necesites

**¡Tu edit-card ahora es la fuente única de verdad para la gestión de cartas! 🎯✨**
