"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  FolderOpen,
  LayoutGrid,
  Palette,
  Eye,
  EyeOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Lock,
  Globe,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import { FolderContainer } from "@/components/folder";
import { GridCard } from "@/components/folder/types";
import { useFolderDimensions } from "@/hooks/useFolderDimensions";

const CreateFolderPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPublic: false,
    color: "#10B981", // Verde por defecto para carpetas
    maxRows: 3,
    maxColumns: 3,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });
  const [currentPage, setCurrentPage] = useState(1);

  // Use the shared hook for folder dimensions
  const folderDimensions = useFolderDimensions(
    formData.maxRows || 3,
    formData.maxColumns || 3,
    windowSize,
    true // editing mode
  );

  // Window resize handler for responsive calculations
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial size
    if (typeof window !== "undefined") {
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleNumberChange = (name: string, value: number) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showErrorToast("El nombre de la carpeta es requerido");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          isOrdered: true, // Las carpetas siempre son ordenadas
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al crear la carpeta");
      }

      const result = await response.json();
      showSuccessToast("Carpeta creada exitosamente");

      // Redirigir directamente a la vista de agregar cartas de la nueva carpeta
      router.push(`/lists/${result.list.id}/add-cards`);
    } catch (error) {
      console.error("Error creating folder:", error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al crear la carpeta"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const colorOptions = [
    { value: "#10B981", name: "Verde", bg: "bg-green-500" },
    { value: "#3B82F6", name: "Azul", bg: "bg-blue-500" },
    { value: "#8B5CF6", name: "Púrpura", bg: "bg-purple-500" },
    { value: "#F59E0B", name: "Naranja", bg: "bg-orange-500" },
    { value: "#EF4444", name: "Rojo", bg: "bg-red-500" },
    { value: "#6B7280", name: "Gris", bg: "bg-gray-500" },
  ];

  // Helper functions for FolderContainer
  const createGrid = (): GridCard[][] => {
    const maxRows = formData.maxRows || 3;
    const maxColumns = formData.maxColumns || 3;
    const grid = Array(maxRows)
      .fill(null)
      .map(() => Array(maxColumns).fill(null));
    return grid;
  };

  const getCardsForPage = () => {
    return []; // No hay cartas en el preview
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 w-full">
      <div className="flex h-full overflow-hidden">
        {/* 📝 SIDEBAR IZQUIERDO - Formulario */}
        <div className="bg-white w-[300px] md:w-[300px] lg:w-[400px] xl:w-[450px] flex-shrink-0 border-r border-slate-200 min-h-0 flex flex-col">
          {/* Header del sidebar */}
          <div className="border-b border-[#f5f5f5] py-4 px-5">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/lists")}
                className="text-gray-600 hover:bg-gray-100 rounded-full w-10 h-10 p-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Nueva Carpeta
                </h1>
                <p className="text-xs text-gray-500">
                  Configura tu carpeta y ve el preview en tiempo real
                </p>
              </div>
            </div>
          </div>

          {/* Contenido del formulario */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Información básica */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-green-600" />
                <h3 className="font-medium text-gray-900">
                  Información Básica
                </h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-sm font-medium text-gray-700"
                  >
                    Nombre de la carpeta *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ej: Mi Colección de Mugiwaras"
                    required
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="description"
                    className="text-sm font-medium text-gray-700"
                  >
                    Descripción (opcional)
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe el propósito de esta carpeta..."
                    className="min-h-[80px] resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Configuración del Grid */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-blue-600" />
                <h3 className="font-medium text-gray-900">Tamaño de Páginas</h3>
              </div>

              <div className="space-y-4">
                {/* Filas */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">
                    Filas por página
                  </Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleNumberChange(
                          "maxRows",
                          Math.max(1, formData.maxRows - 1)
                        )
                      }
                      disabled={formData.maxRows <= 1}
                      className="h-9 w-9 p-0 rounded-full"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>

                    <div className="flex-1 text-center">
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <span className="text-lg font-semibold text-gray-900">
                          {formData.maxRows}
                        </span>
                        <span className="text-sm text-gray-600 ml-1">
                          {formData.maxRows === 1 ? "fila" : "filas"}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleNumberChange(
                          "maxRows",
                          Math.min(4, formData.maxRows + 1)
                        )
                      }
                      disabled={formData.maxRows >= 4}
                      className="h-9 w-9 p-0 rounded-full"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Columnas */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">
                    Columnas por página
                  </Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleNumberChange(
                          "maxColumns",
                          Math.max(1, formData.maxColumns - 1)
                        )
                      }
                      disabled={formData.maxColumns <= 1}
                      className="h-9 w-9 p-0 rounded-full"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>

                    <div className="flex-1 text-center">
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <span className="text-lg font-semibold text-gray-900">
                          {formData.maxColumns}
                        </span>
                        <span className="text-sm text-gray-600 ml-1">
                          {formData.maxColumns === 1 ? "columna" : "columnas"}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleNumberChange(
                          "maxColumns",
                          Math.min(4, formData.maxColumns + 1)
                        )
                      }
                      disabled={formData.maxColumns >= 4}
                      className="h-9 w-9 p-0 rounded-full"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Resumen del Grid */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <LayoutGrid className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-blue-900">
                        Grid {formData.maxRows}×{formData.maxColumns}
                      </div>
                      <div className="text-xs text-blue-700">
                        {(formData.maxRows || 1) * (formData.maxColumns || 1)}{" "}
                        cartas por página
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuración adicional */}
            <div className="space-y-6">
              {/* Visibilidad */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <h3 className="font-medium text-gray-900">Visibilidad</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={formData.isPublic ? "default" : "outline"}
                    onClick={() => handleSwitchChange("isPublic", true)}
                    className={`flex items-center gap-2 h-12 ${
                      formData.isPublic
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    <span className="font-medium">Pública</span>
                    {formData.isPublic && <Check className="h-4 w-4 ml-auto" />}
                  </Button>
                  <Button
                    type="button"
                    variant={!formData.isPublic ? "default" : "outline"}
                    onClick={() => handleSwitchChange("isPublic", false)}
                    className={`flex items-center gap-2 h-12 ${
                      !formData.isPublic
                        ? "bg-gray-600 hover:bg-gray-700 text-white"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Lock className="h-4 w-4" />
                    <span className="font-medium">Privada</span>
                    {!formData.isPublic && (
                      <Check className="h-4 w-4 ml-auto" />
                    )}
                  </Button>
                </div>
                <div className="text-xs text-gray-600 text-center bg-gray-50 rounded-lg py-2">
                  {formData.isPublic
                    ? "✨ Visible para toda la comunidad"
                    : "🔒 Solo visible para ti"}
                </div>
              </div>

              {/* Selector de color */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-purple-600" />
                  <Label className="text-sm font-medium text-gray-700">
                    Color de la carpeta
                  </Label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          color: color.value,
                        }))
                      }
                      className={`w-full h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                        color.bg
                      } ${
                        formData.color === color.value
                          ? "border-gray-900 scale-105 shadow-lg ring-2 ring-offset-2 ring-gray-900"
                          : "border-gray-300 hover:border-gray-400 hover:scale-[1.02]"
                      }`}
                      title={color.name}
                    >
                      {formData.color === color.value && (
                        <Check className="h-6 w-6 text-white drop-shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-gray-600 text-center bg-gray-50 rounded-lg py-2">
                  🎨 Selecciona el color que represente tu carpeta
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="border-t border-gray-200 p-5">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/lists")}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.name.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Crear Carpeta
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 📁 PREVIEW DERECHO - Carpeta en tiempo real */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 p-2 sm:p-4 sm:pt-0 sm:pl-0 sm:pr-0 sm:pb-4 flex flex-col">
            <div className="flex-1 flex flex-col min-h-0">
              {/* Preview de la carpeta */}
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="w-full h-full flex items-center justify-center">
                  <FolderContainer
                    name={formData.name || "Nueva Carpeta"}
                    color={formData.color || "#10B981"}
                    dimensions={folderDimensions}
                    currentPage={currentPage}
                    totalPages={0} // No hay páginas existentes en preview
                    maxRows={formData.maxRows || 3}
                    maxColumns={formData.maxColumns || 3}
                    cardCount={0} // No hay cartas en preview
                    createGrid={createGrid}
                    getCardsForPage={getCardsForPage}
                    isEditing={false} // Es solo preview
                    onCardClick={() => {}} // No hay acciones en preview
                    onPositionClick={() => {}} // No hay acciones en preview
                    onDragHandlers={{
                      onDragOver: () => {},
                      onDragEnter: () => {},
                      onDragLeave: () => {},
                      onDrop: () => {},
                    }}
                    dragOverPosition={null}
                    selectedCardForPlacement={null}
                    showInteriorPage={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateFolderPage;
