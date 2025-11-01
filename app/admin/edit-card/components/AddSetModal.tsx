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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2 } from "lucide-react";

import { format } from "date-fns";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";

interface NewSet {
  image: string;
  title: string;
  code: string;
  releaseDate: string;
  isOpen: boolean;
}

interface AddSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetCreated: (newSet: { id: string; title: string }) => Promise<void>;
}

const AddSetModal: React.FC<AddSetModalProps> = ({
  isOpen,
  onClose,
  onSetCreated,
}) => {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<NewSet>({
    image: "",
    title: "",
    code: "",
    releaseDate: format(new Date(), "yyyy-MM-dd"), // Fecha actual automática
    isOpen: false,
  });

  const handleInputChange = (field: keyof NewSet, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      image: "",
      title: "",
      code: "",
      releaseDate: format(new Date(), "yyyy-MM-dd"), // Siempre fecha actual
      isOpen: false,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!formData.title) {
      showErrorToast("Título es requerido");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/sets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const newSet = await response.json();

      // Notificar al componente padre que se creó un nuevo set
      await onSetCreated({
        id: newSet.id,
        title: newSet.title,
      });

      showSuccessToast("Set creado exitosamente");
      handleClose();
    } catch (error) {
      console.error("Error al crear set:", error);
      showErrorToast(
        `Error al crear set: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-md bg-white border-2 border-green-200 shadow-2xl ring-4 ring-green-100"
        style={{ zIndex: 10002 }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-green-600">📦</span>
            Crear Nuevo Set
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Título (Único campo requerido) */}
          <div>
            <Label htmlFor="title" className="text-sm font-medium">
              Título *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Ej: Booster Pack Romance Dawn"
              disabled={loading}
              className="mt-1"
            />
          </div>

          {/* Código (Opcional) */}
          <div>
            <Label htmlFor="code" className="text-sm font-medium">
              Código
            </Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => handleInputChange("code", e.target.value)}
              placeholder="Ej: OP01"
              disabled={loading}
              className="mt-1"
            />
          </div>

          {/* URL de Imagen (Opcional) */}
          <div>
            <Label htmlFor="image" className="text-sm font-medium">
              URL de Imagen
            </Label>
            <Input
              id="image"
              value={formData.image}
              onChange={(e) => handleInputChange("image", e.target.value)}
              placeholder="https://..."
              disabled={loading}
              className="mt-1"
            />
          </div>

          {/* Switch Is Open */}
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="isOpen"
              checked={formData.isOpen}
              onCheckedChange={(checked) =>
                handleInputChange("isOpen", checked)
              }
              disabled={loading}
            />
            <Label htmlFor="isOpen" className="text-sm">
              Set Abierto
            </Label>
          </div>

          {/* Información de ayuda */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-700">
              💡 <strong>Tip:</strong> El set se creará con la fecha actual y
              estará disponible inmediatamente para seleccionar.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !formData.title}
            className="bg-green-500 hover:bg-green-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Crear Set
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddSetModal;
