// Patrón reutilizable para modales que contienen popovers/multiselects
// Basado en la solución de EditAlternateModal.tsx

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ModalWithPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const ModalWithPopover: React.FC<ModalWithPopoverProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-2xl",
}) => {
  return (
    <>
      {/* CSS para solucionar conflictos de modales con popovers */}
      <style jsx global>{`
        [data-radix-popover-content] {
          pointer-events: auto !important;
          z-index: 10001 !important;
        }

        [data-radix-popper-content-wrapper] {
          pointer-events: auto !important;
          z-index: 10001 !important;
        }

        /* Asegurar scroll en Command components */
        [data-radix-popover-content] [cmdk-root] {
          overflow: visible !important;
        }

        [data-radix-popover-content] [cmdk-list] {
          max-height: 380px !important;
          overflow-y: auto !important;
        }

        [data-radix-popover-content] [cmdk-input] {
          pointer-events: auto !important;
        }
      `}</style>

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className={`${maxWidth} max-h-[90vh] overflow-y-auto`}
          style={{ zIndex: 9999 }}
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;

            // Selectores para detectar elementos de popover/multiselect
            const popoverSelectors = [
              "[data-radix-popper-content-wrapper]",
              "[data-radix-select-content]",
              "[data-radix-popover-content]",
              "[data-radix-command]",
              "[cmdk-root]",
              "[cmdk-input]",
              "[cmdk-list]",
              "[cmdk-item]",
              "[cmdk-group]",
              ".z-\\[10000\\]",
              ".z-\\[10001\\]",
            ];

            const isPopoverClick = popoverSelectors.some((selector) => {
              return target.closest(selector) !== null;
            });

            // No cerrar modal si click es en popover
            if (isPopoverClick || target.style.zIndex >= "10000") {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            // Solo permitir ESC si no hay popovers abiertos
            const openPopovers = document.querySelectorAll(
              '[data-state="open"][data-radix-popover-content], [data-state="open"][data-radix-command]'
            );
            if (openPopovers.length > 0) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModalWithPopover;
