import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  src?: string;
  rarity?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item: CartItem) => {
        const existingItem = get().items.find((i) => i.id === item.id);
        if (existingItem) {
          // Si el item ya existe, aumentamos la cantidad
          set({
            items: get().items.map((i) =>
              i.id === item.id
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          });
        } else {
          // Se añade el nuevo item, incluyendo el src en caso de existir
          set({ items: [...get().items, item] });
        }
      },
      removeItem: (id: string) => {
        set({
          items: get().items.filter((item) => item.id !== id),
        });
      },
      updateItemQuantity: (id: string, quantity: number) => {
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        });
      },
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "cart-storage", // clave en el localStorage
    }
  )
);
