"use client";

import React, { useState, useEffect } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, Plus, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
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
}

interface EditSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSet: Set | null; // null = creating new set
  onSetSaved: (set: Set) => void;
}

const EditSetModal: React.FC<EditSetModalProps> = ({
  isOpen,
  onClose,
  editingSet,
  onSetSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState({
    title: "",
    code: "",
    image: "",
    releaseDate: "",
    isOpen: false,
  });

  const isEditing = editingSet !== null;

  // Initialize form when modal opens or editing set changes
  useEffect(() => {
    if (isOpen) {
      if (editingSet) {
        // Editing existing set
        setFormData({
          title: editingSet.title,
          code: editingSet.code || "",
          image: editingSet.image || "",
          releaseDate: editingSet.releaseDate,
          isOpen: editingSet.isOpen,
        });
        setDate(new Date(editingSet.releaseDate));
      } else {
        // Creating new set - use today's date
        const today = new Date();
        const todayFormatted = format(today, "yyyy-MM-dd");

        setFormData({
          title: "",
          code: "",
          image: "",
          releaseDate: todayFormatted,
          isOpen: false,
        });
        setDate(today);
      }
    }
  }, [isOpen, editingSet]);

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDateChange = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      handleInputChange("releaseDate", format(selectedDate, "yyyy-MM-dd"));
    } else {
      handleInputChange("releaseDate", "");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      code: "",
      image: "",
      releaseDate: "",
      isOpen: false,
    });
    setDate(undefined);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.releaseDate) {
      showErrorToast("Título y fecha de lanzamiento son requeridos.");
      return;
    }

    setLoading(true);

    try {
      const url = isEditing
        ? `/api/admin/sets/${editingSet!.id}`
        : "/api/admin/sets";

      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            `Error ${response.status}: ${response.statusText}`
        );
      }

      const savedSet = await response.json();

      // Notify parent component
      onSetSaved(savedSet);

      // Close modal
      handleClose();
    } catch (error) {
      console.error("Error al guardar set:", error);
      showErrorToast(
        `Error al ${isEditing ? "actualizar" : "crear"} set: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" style={{ zIndex: 9999 }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Edit className="w-5 h-5 text-blue-600" />
                <span className="text-blue-600">Editar Set</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 text-green-600" />
                <span className="text-green-600">Crear Nuevo Set</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Título (Requerido) */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Título *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Ej: Romance Dawn"
              required
              disabled={loading}
              className="mt-1"
            />
          </div>

          {/* Código (Opcional) */}
          <div className="space-y-2">
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
          <div className="space-y-2">
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

          {/* Fecha de Lanzamiento (Requerida) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Fecha de Lanzamiento *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !date && "text-muted-foreground"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" style={{ zIndex: 10001 }}>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
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
              Set Activo
            </Label>
          </div>

          {/* Información de ayuda */}
          <div
            className={`p-3 rounded-lg ${
              isEditing ? "bg-blue-50" : "bg-green-50"
            }`}
          >
            <p
              className={`text-xs ${
                isEditing ? "text-blue-700" : "text-green-700"
              }`}
            >
              💡 <strong>Tip:</strong>{" "}
              {isEditing
                ? "Los cambios se aplicarán inmediatamente al guardar."
                : "El set estará disponible para asignar a cartas una vez creado."}
            </p>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.title || !formData.releaseDate}
              className={
                isEditing
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-green-500 hover:bg-green-600"
              }
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? "Actualizando..." : "Creando..."}
                </>
              ) : (
                <>
                  {isEditing ? (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Actualizar Set
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Set
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditSetModal;
