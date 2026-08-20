"use client";

import { Printer, RotateCcw, Minus, Plus, Trash2, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePrintQueueStore } from "@/store/printQueueStore";
import { generateProxySheetPdf } from "@/lib/print/generateProxySheetPdf";
import PrintLanguageToggle from "./PrintLanguageToggle";

interface PrintQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PrintQueueDrawer: React.FC<PrintQueueDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const items = usePrintQueueStore((state) => state.items);
  const updateQuantity = usePrintQueueStore((state) => state.updateQuantity);
  const removeCard = usePrintQueueStore((state) => state.removeCard);
  const clearQueue = usePrintQueueStore((state) => state.clearQueue);
  const printLanguage = usePrintQueueStore((state) => state.printLanguage);
  const setPrintLanguage = usePrintQueueStore(
    (state) => state.setPrintLanguage
  );

  const totalCards = items.reduce((total, item) => total + item.quantity, 0);

  const handlePrintNow = () => {
    onClose();
    setTimeout(
      () => generateProxySheetPdf(items, { language: printLanguage }),
      350
    );
  };

  const content = (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-100 flex-shrink-0">
                <Printer className="w-6 h-6 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold text-slate-900">
                  Cola de impresión
                </h2>
                <p className="text-xs text-slate-500">
                  {totalCards} {totalCards === 1 ? "carta" : "cartas"}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-purple-100 px-2.5 py-1.5 rounded-lg">
            <Printer className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-bold text-purple-700">
              {totalCards}
            </span>
            <span className="text-xs text-purple-500">cartas</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg">
            <span className="text-sm font-bold text-slate-700">
              {Math.ceil(totalCards / 9)}
            </span>
            <span className="text-xs text-slate-500">
              {Math.ceil(totalCards / 9) === 1 ? "hoja" : "hojas"}
            </span>
          </div>
        </div>
        <PrintLanguageToggle
          value={printLanguage}
          onChange={setPrintLanguage}
          className="mt-3"
        />
      </div>

      {/* Scrollable Content */}
      <div
        className="overflow-y-auto overflow-x-hidden px-4 pb-4"
        style={{ maxHeight: "calc(92vh - 250px)" }}
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="max-w-sm mx-auto text-center p-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-100 flex items-center justify-center">
                <Printer className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Cola vacía
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Agrega cartas a la cola de impresión desde el modal de detalle
                en la lista de cartas.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.cardId}
                className="rounded-xl shadow-sm bg-white border border-slate-100 p-1.5 relative transition-all hover:shadow-md"
              >
                <div className="aspect-[3/4] relative overflow-hidden rounded-lg">
                  <img
                    src={getOptimizedImageUrl(item.src, "small")}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <button
                    onClick={() => removeCard(item.cardId)}
                    className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-red-600 rounded-tr-lg rounded-bl-lg p-1.5 z-10 border-l border-b border-gray-200 hover:bg-white active:scale-95 transition-all"
                    aria-label="Quitar carta de la cola"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-1.5">
                  <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-2 py-1">
                    <button
                      onClick={() =>
                        updateQuantity(item.cardId, item.quantity - 1)
                      }
                      className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-white font-bold text-base">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.cardId, item.quantity + 1)
                      }
                      className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with action buttons */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            type="button"
            className="flex-1 h-12 text-red-600 border-2 border-red-300 hover:bg-red-50 font-semibold rounded-xl"
            onClick={clearQueue}
            disabled={items.length === 0}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Vaciar cola
          </Button>

          <Button
            onClick={handlePrintNow}
            disabled={items.length === 0}
            size="lg"
            className="flex-1 h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Imprimir ahora
          </Button>
        </div>
      </div>
    </>
  );

  // Desktop: a real, non-draggable modal (Radix Dialog composed directly,
  // not BaseDrawer's desktopModal mode) — BaseDrawer's drag-to-dismiss
  // handling captures the pointer on mousedown anywhere in its container,
  // which swallowed clicks on the close button for mouse users.
  if (isDesktop) {
    return (
      <DialogPrimitive.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-50 flex w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            style={{ maxHeight: "85vh" }}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogPrimitive.Title className="sr-only">
              Cola de impresión
            </DialogPrimitive.Title>
            {content}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <BaseDrawer isOpen={isOpen} onClose={onClose} maxHeight="92vh">
      {content}
    </BaseDrawer>
  );
};

export default PrintQueueDrawer;
