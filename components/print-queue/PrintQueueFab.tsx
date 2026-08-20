"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, Eye, Trash2 } from "lucide-react";
import { usePrintQueueStore } from "@/store/printQueueStore";
import { generateProxySheetPdf } from "@/lib/print/generateProxySheetPdf";
import PrintQueueDrawer from "./PrintQueueDrawer";

const PrintQueueFab = () => {
  const items = usePrintQueueStore((state) => state.items);
  const clearQueue = usePrintQueueStore((state) => state.clearQueue);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalCards = items.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  useEffect(() => {
    if (totalCards === 0) {
      setIsMenuOpen(false);
    }
  }, [totalCards]);

  if (totalCards === 0) return null;

  return (
    <>
      <div ref={containerRef} className="fixed bottom-24 left-6 z-50">
        {isMenuOpen && (
          <div className="absolute bottom-[calc(100%+12px)] left-0 w-56 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                generateProxySheetPdf(items);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-purple-50 transition-colors"
            >
              <Printer className="h-4 w-4 text-purple-600" />
              Imprimir ahora
            </button>
            <button
              onClick={() => {
                setIsMenuOpen(false);
                setIsDrawerOpen(true);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors border-t border-slate-100"
            >
              <Eye className="h-4 w-4 text-slate-600" />
              Ver cola ({totalCards})
            </button>
            <button
              onClick={() => {
                setIsMenuOpen(false);
                clearQueue();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar cola
            </button>
          </div>
        )}

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="relative flex items-center justify-center h-16 w-16 rounded-full bg-purple-600 text-white shadow-xl hover:bg-purple-700 active:scale-95 transition-all"
          aria-label="Cola de impresión"
        >
          <Printer className="h-7 w-7" />
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold border-2 border-white">
            {totalCards}
          </div>
        </button>
      </div>

      <PrintQueueDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
};

export default PrintQueueFab;
