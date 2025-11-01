"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";

interface Set {
  id: number;
  title: string;
  code?: string;
  image?: string;
  releaseDate: string;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    cards: number;
  };
}

interface DeleteSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  setToDelete: Set | null;
  onSetDeleted: () => void;
}

const DeleteSetModal: React.FC<DeleteSetModalProps> = ({
  isOpen,
  onClose,
  setToDelete,
  onSetDeleted,
}) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!setToDelete) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/admin/sets/${setToDelete.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            `Error ${response.status}: ${response.statusText}`
        );
      }

      // Notify parent component
      onSetDeleted();

      // Close modal
      onClose();
    } catch (error) {
      console.error("Error al eliminar set:", error);
      showErrorToast(
        `Error al eliminar set: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  if (!setToDelete) return null;

  const hasCards = setToDelete._count?.cards && setToDelete._count.cards > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" style={{ zIndex: 9999 }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Confirmar Eliminación
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Set Information */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              {setToDelete.image && (
                <img
                  src={setToDelete.image}
                  alt={setToDelete.title}
                  className="w-12 h-12 rounded object-cover"
                />
              )}
              <div>
                <h3 className="font-semibold text-gray-900">
                  {setToDelete.title}
                </h3>
                {setToDelete.code && (
                  <p className="text-sm text-gray-600 font-mono">
                    {setToDelete.code}
                  </p>
                )}
                <p className="text-sm text-gray-500">
                  Creado:{" "}
                  {new Date(setToDelete.createdAt).toLocaleDateString("es-ES")}
                </p>
              </div>
            </div>
          </div>

          {/* Warning Messages */}
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    ¿Estás seguro de eliminar este set?
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>

            {hasCards && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-800">
                      ⚠️ Este set tiene cartas asociadas
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Se encontraron{" "}
                      <strong>{setToDelete._count?.cards}</strong> cartas
                      asociadas a este set. Eliminar el set podría afectar estas
                      cartas.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirmation Text */}
          <div className="text-center py-2">
            <p className="text-gray-600 text-sm">
              Escribe <strong>"{setToDelete.title}"</strong> para confirmar la
              eliminación:
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>

          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Set
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Additional safety notice */}
        <div className="bg-gray-100 p-3 rounded-lg text-xs text-gray-600 text-center border-t">
          💡 <strong>Nota:</strong> Los administradores son responsables de
          verificar las dependencias antes de eliminar sets del sistema.
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteSetModal;
