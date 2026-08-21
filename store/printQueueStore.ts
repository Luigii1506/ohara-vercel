import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CardWithCollectionData } from "@/types";

const PRINT_QUEUE_STORAGE_KEY = "print-queue-storage";

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

function writePersistedPrintQueue(state: {
  items: PrintQueueItem[];
  printLanguage: PrintLanguage;
}) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    PRINT_QUEUE_STORAGE_KEY,
    JSON.stringify({
      state,
      version: 0,
    })
  );
}

function clearPersistedPrintQueue(language: PrintLanguage) {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(PRINT_QUEUE_STORAGE_KEY);
  writePersistedPrintQueue({
    items: [],
    printLanguage: language,
  });
}

export const usePrintQueueStore = create<PrintQueueState>()(
  persist(
    (set, get) => ({
      items: [],
      printLanguage: "en",
      setPrintLanguage: (printLanguage) => {
        set({ printLanguage });
        writePersistedPrintQueue({
          items: get().items,
          printLanguage,
        });
      },
      addCard: (card: CardWithCollectionData) => {
        const existingItem = get().items.find((i) => i.cardId === card.id);
        if (existingItem) {
          const items = get().items.map((i) =>
            i.cardId === card.id ? { ...i, quantity: i.quantity + 1 } : i
          );
          set({
            items,
          });
          writePersistedPrintQueue({
            items,
            printLanguage: get().printLanguage,
          });
        } else {
          const items = [
            ...get().items,
            {
              cardId: card.id,
              name: card.name,
              code: card.code,
              src: card.src,
              rarity: card.rarity,
              quantity: 1,
            },
          ];
          set({ items });
          writePersistedPrintQueue({
            items,
            printLanguage: get().printLanguage,
          });
        }
      },
      removeCard: (cardId: string) => {
        const items = get().items.filter((item) => item.cardId !== cardId);
        set({ items });
        if (items.length === 0) {
          clearPersistedPrintQueue(get().printLanguage);
          return;
        }
        writePersistedPrintQueue({
          items,
          printLanguage: get().printLanguage,
        });
      },
      updateQuantity: (cardId: string, quantity: number) => {
        if (quantity <= 0) {
          const items = get().items.filter((item) => item.cardId !== cardId);
          set({ items });
          if (items.length === 0) {
            clearPersistedPrintQueue(get().printLanguage);
            return;
          }
          writePersistedPrintQueue({
            items,
            printLanguage: get().printLanguage,
          });
          return;
        }
        const items = get().items.map((item) =>
          item.cardId === cardId ? { ...item, quantity } : item
        );
        set({
          items,
        });
        writePersistedPrintQueue({
          items,
          printLanguage: get().printLanguage,
        });
      },
      clearQueue: () => {
        set({ items: [] });
        clearPersistedPrintQueue(get().printLanguage);
      },
    }),
    {
      name: PRINT_QUEUE_STORAGE_KEY,
    }
  )
);
