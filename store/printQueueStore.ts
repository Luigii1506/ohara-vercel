import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CardWithCollectionData } from "@/types";

export interface PrintQueueItem {
  cardId: string;
  name: string;
  code: string;
  src: string;
  rarity?: string;
  quantity: number;
}

export type PrintLanguage = "en" | "es";

interface PrintQueueState {
  items: PrintQueueItem[];
  printLanguage: PrintLanguage;
  setPrintLanguage: (language: PrintLanguage) => void;
  addCard: (card: CardWithCollectionData) => void;
  removeCard: (cardId: string) => void;
  updateQuantity: (cardId: string, quantity: number) => void;
  clearQueue: () => void;
}

export const usePrintQueueStore = create<PrintQueueState>()(
  persist(
    (set, get) => ({
      items: [],
      printLanguage: "en",
      setPrintLanguage: (printLanguage) => set({ printLanguage }),
      addCard: (card: CardWithCollectionData) => {
        const existingItem = get().items.find((i) => i.cardId === card.id);
        if (existingItem) {
          set({
            items: get().items.map((i) =>
              i.cardId === card.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          });
        } else {
          set({
            items: [
              ...get().items,
              {
                cardId: card.id,
                name: card.name,
                code: card.code,
                src: card.src,
                rarity: card.rarity,
                quantity: 1,
              },
            ],
          });
        }
      },
      removeCard: (cardId: string) => {
        set({
          items: get().items.filter((item) => item.cardId !== cardId),
        });
      },
      updateQuantity: (cardId: string, quantity: number) => {
        if (quantity <= 0) {
          set({
            items: get().items.filter((item) => item.cardId !== cardId),
          });
          return;
        }
        set({
          items: get().items.map((item) =>
            item.cardId === cardId ? { ...item, quantity } : item
          ),
        });
      },
      clearQueue: () => set({ items: [] }),
    }),
    {
      name: "print-queue-storage",
    }
  )
);
