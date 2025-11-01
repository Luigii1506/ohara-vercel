import { create } from "zustand";
import { persist } from "zustand/middleware";

interface InventoryItem {
  id: number;
  cardId: number;
  price: number;
  stock: number;
  condition: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  card: {
    id: number;
    name: string;
    code: string;
    src: string;
    rarity: string;
    category: string;
    cost: string;
    power: string;
    attribute: string;
    counter: string;
    triggerCard: string;
    colors: Array<{ color: string }>;
    sets: Array<{ set: { title: string } }>;
    types: Array<{ type: string }>;
    effects: Array<{ effect: string }>;
    texts: Array<{ text: string }>;
    alternates: any[];
  };
}

interface InventoryStore {
  inventory: InventoryItem[] | null;
  loading: boolean;
  lastUpdated: number | null;
  fetchInventory: () => Promise<void>;
}

export const useInventoryStore = create(
  persist<InventoryStore>(
    (set, get) => ({
      inventory: null,
      loading: false,
      lastUpdated: null,

      fetchInventory: async () => {
        const currentState = get();

        // Si ya está cargando, no hacer otra petición
        if (currentState.loading) return;

        set({ loading: true });

        try {
          // Verificar si hay cambios más recientes
          const response = await fetch(
            "/api/seller/inventory?limit=1000&includeCard=true"
          );

          if (!response.ok) {
            throw new Error("Error al obtener inventario");
          }

          const data = await response.json();

          if (data.success) {
            set({
              inventory: data.data.items,
              lastUpdated: Date.now(),
              loading: false,
            });
          } else {
            throw new Error(data.message || "Error al cargar inventario");
          }
        } catch (error) {
          console.error("Error en fetchInventory:", error);
          set({ loading: false });
        }
      },
    }),
    {
      name: "inventory-store",
    }
  )
);

