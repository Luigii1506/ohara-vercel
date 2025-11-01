"use client";

import React from "react";
import { CardWithCollectionData } from "@/types";
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
import { Textarea } from "@/components/ui/textarea";
import MultiSelect from "@/components/MultiSelect";
import { effectsOptions } from "@/helpers/constants";
import { Plus, X, Save, Loader2 } from "lucide-react";
import LazyImage from "@/components/LazyImage";

// Helper function para extraer valores de arrays que pueden tener diferentes estructuras
const extractArrayValues = (arr: any[], field: string): string[] => {
  if (!arr || !Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      // Si el item es un string, devolverlo directamente
      if (typeof item === "string") return item;
      // Si el item es un objeto, extraer el campo
      if (typeof item === "object" && item !== null) {
        return item[field] || "";
      }
      return "";
    })
    .filter((value) => value.trim() !== "");
};

const extractTextValues = (texts: any[]): string => {
  if (!texts || !Array.isArray(texts)) return "";
  return texts
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        return item.text || "";
      }
      return "";
    })
    .filter((text) => text.trim() !== "")
    .join(" ");
};

interface EditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardWithCollectionData | null;
  onSave: (updatedCard: Partial<CardWithCollectionData>) => Promise<void>;
  loading?: boolean;
  isCloneMode?: boolean;
}

interface EditCardFormData {
  name: string;
  code: string;
  src: string;
  tcgUrl: string;
  triggerCard: string;
  cardText: string;
  effects: string[];
  conditions: string[];
}

const EditCardModal: React.FC<EditCardModalProps> = ({
  isOpen,
  onClose,
  card,
  onSave,
  loading = false,
  isCloneMode = false,
}) => {
  const [formData, setFormData] = React.useState<EditCardFormData>({
    name: "",
    code: "",
    src: "",
    tcgUrl: "",
    triggerCard: "",
    cardText: "",
    effects: [],
    conditions: [],
  });

  // Actualizar form data cuando cambia la carta
  React.useEffect(() => {
    if (card) {
      setFormData({
        name: card.name || "",
        code: card.code || "",
        src: card.src || "",
        tcgUrl: card.tcgUrl || "",
        triggerCard: card.triggerCard || "",
        cardText: extractTextValues(card.texts || []),
        effects: extractArrayValues(card.effects || [], "effect"),
        conditions: extractArrayValues(card.conditions || [], "condition"),
      });
    }
  }, [card]);

  const handleInputChange = (field: keyof EditCardFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddCondition = () => {
    if (
      formData.conditions.length === 0 ||
      formData.conditions[formData.conditions.length - 1].trim() !== ""
    ) {
      setFormData((prev) => ({
        ...prev,
        conditions: [...prev.conditions, ""],
      }));
    }
  };

  const handleRemoveCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateCondition = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.map((cond, i) =>
        i === index ? value : cond
      ),
    }));
  };

  const handleSave = async () => {
    if (!card) return;

    // Construir objeto de actualización según el modo
    const updatedCard: Partial<CardWithCollectionData> = {
      src: formData.src,
      tcgUrl: formData.tcgUrl.trim() === "" ? "" : formData.tcgUrl,
      triggerCard:
        formData.triggerCard.trim() === "" ? "" : formData.triggerCard,
      // 🔧 ADDED: Include missing fields with correct format
      texts:
        formData.cardText.trim() === ""
          ? []
          : [{ text: formData.cardText.trim() }],
      effects: formData.effects.map((effect) => ({ effect })),
      conditions: formData.conditions
        .filter((cond) => cond.trim() !== "")
        .map((condition) => ({ condition })),
    };

    // En modo clonado, incluir nombre y código
    if (isCloneMode) {
      updatedCard.name = formData.name;
      updatedCard.code = formData.code;
    }

    console.log(
      `🔍 Modal enviando (${isCloneMode ? "clonado" : "edición"}):`,
      updatedCard
    );
    await onSave(updatedCard);
  };

  if (!card) return null;

  return (
    <>
      <style jsx global>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-5xl max-h-[90vh] overflow-hidden"
          onPointerDownOutside={(e) => {
            // Permitir cerrar el modal al hacer click fuera, incluso con selects sólidos
            onClose();
          }}
          onEscapeKeyDown={(e) => {
            // Permitir cerrar el modal con Escape
            onClose();
          }}
        >
          {/* Header profesional con información completa de la carta */}
          <DialogHeader className="pb-6 border-b border-gray-200">
            <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2">
                  {isCloneMode ? (
                    <>
                      <svg
                        className="h-6 w-6 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Clonar Carta
                    </>
                  ) : (
                    "Editar Carta"
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm ${
                      isCloneMode
                        ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                        : "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                    }`}
                  >
                    {formData.code || card.code}
                  </div>
                  <span className="text-lg font-medium text-gray-700">
                    {formData.name || card.name}
                  </span>
                  {isCloneMode && (
                    <div className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                      NUEVA COPIA
                    </div>
                  )}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="py-6">
            {/* Sección 1: Información de la carta y preview */}
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Columna izquierda: Preview de la carta - STATIC */}
              <div className="lg:col-span-1">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">
                    Preview de la carta
                  </Label>
                  <div className="w-full max-w-xs mx-auto">
                    <LazyImage
                      src={formData.src || card.src}
                      fallbackSrc="/assets/images/backcard.webp"
                      alt={card.name}
                      className="w-full aspect-[2/3] object-cover rounded-lg border-2 border-gray-200 shadow-lg"
                    />
                  </div>

                  {/* Información básica de la carta */}
                  <div className="mt-4 space-y-3 text-center">
                    <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                      {card.name}
                    </h3>
                    <div className="space-y-2">
                      <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium inline-block">
                        {card.code}
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 text-xs">
                        {card.power && (
                          <div className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                            Power: {card.power}
                          </div>
                        )}
                        {card.cost && (
                          <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                            Cost: {card.cost}
                          </div>
                        )}
                        {card.attribute && (
                          <div className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                            {card.attribute}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna derecha: Formulario - CON SCROLL */}
              <div className="lg:col-span-2 max-h-[70vh] overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                {/* Campos de clonado - Solo visible en modo clonado */}
                {isCloneMode && (
                  <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="text-lg font-semibold text-green-800 border-b border-green-200 pb-2 flex items-center gap-2">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Información de la Nueva Carta
                    </h4>

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Nombre de la nueva carta */}
                      <div>
                        <Label
                          htmlFor="name"
                          className="text-sm font-medium text-green-700"
                        >
                          Nombre de la Carta
                        </Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) =>
                            handleInputChange("name", e.target.value)
                          }
                          placeholder="Nombre de la nueva carta"
                          disabled={loading}
                          className="mt-1 border-green-300 focus:border-green-500 focus:ring-green-500"
                        />
                      </div>

                      {/* Código de la nueva carta */}
                      <div>
                        <Label
                          htmlFor="code"
                          className="text-sm font-medium text-green-700"
                        >
                          Código de la Carta
                        </Label>
                        <Input
                          id="code"
                          value={formData.code}
                          onChange={(e) =>
                            handleInputChange("code", e.target.value)
                          }
                          placeholder="Código único de la nueva carta"
                          disabled={loading}
                          className="mt-1 border-green-300 focus:border-green-500 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* URLs principales - En líneas separadas como solicitaste */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Enlaces
                  </h4>

                  <div className="space-y-4">
                    {/* URL de Imagen - Línea completa */}
                    <div>
                      <Label
                        htmlFor="src"
                        className="text-sm font-medium text-gray-700"
                      >
                        URL de Imagen
                      </Label>
                      <Input
                        id="src"
                        value={formData.src}
                        onChange={(e) =>
                          handleInputChange("src", e.target.value)
                        }
                        placeholder="https://ejemplo.com/imagen.jpg"
                        disabled={loading}
                        className="mt-1"
                      />
                    </div>

                    {/* URL TCG - Línea completa */}
                    <div>
                      <Label
                        htmlFor="tcgUrl"
                        className="text-sm font-medium text-gray-700"
                      >
                        URL TCG
                      </Label>
                      <Input
                        id="tcgUrl"
                        value={formData.tcgUrl}
                        onChange={(e) =>
                          handleInputChange("tcgUrl", e.target.value)
                        }
                        placeholder="https://tcg.ejemplo.com/carta"
                        disabled={loading}
                        className="mt-1"
                      />
                    </div>

                    {/* Texto Trigger */}
                    <div>
                      <Label
                        htmlFor="triggerCard"
                        className="text-sm font-medium text-gray-700"
                      >
                        Texto Trigger
                      </Label>
                      <Input
                        id="triggerCard"
                        value={formData.triggerCard}
                        onChange={(e) =>
                          handleInputChange("triggerCard", e.target.value)
                        }
                        placeholder="Texto del trigger (opcional)"
                        disabled={loading}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Texto de la carta */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Texto de la Carta
                  </h4>

                  <div>
                    <Label
                      htmlFor="cardText"
                      className="text-sm font-medium text-gray-700"
                    >
                      Descripción
                    </Label>
                    <Textarea
                      id="cardText"
                      rows={5}
                      value={formData.cardText}
                      onChange={(e) =>
                        handleInputChange("cardText", e.target.value)
                      }
                      disabled={loading}
                      placeholder="Texto completo de la carta..."
                      className="mt-1 resize-none"
                    />
                  </div>
                </div>

                {/* Effects */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Efectos de la Carta
                  </h4>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Effects
                    </Label>
                    <MultiSelect
                      options={effectsOptions}
                      selected={formData.effects}
                      setSelected={(effects) =>
                        handleInputChange("effects", effects)
                      }
                      displaySelectedAs={(selected) =>
                        selected.length === 1
                          ? selected[0]
                          : `${selected.length} effects seleccionados`
                      }
                      searchPlaceholder="Buscar effects..."
                      isSolid={true}
                      isSearchable={true}
                      isFullWidth={true}
                      isDisabled={loading}
                    />
                  </div>
                </div>

                {/* Condiciones */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <h4 className="text-lg font-semibold text-gray-900">
                      Condiciones
                    </h4>
                    <Button
                      type="button"
                      onClick={handleAddCondition}
                      size="sm"
                      variant="outline"
                      disabled={
                        loading ||
                        (formData.conditions.length > 0 &&
                          formData.conditions[
                            formData.conditions.length - 1
                          ].trim() === "")
                      }
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar Condición
                    </Button>
                  </div>

                  {formData.conditions.length > 0 ? (
                    <div className="space-y-3">
                      {formData.conditions.map((condition, index) => (
                        <div
                          key={index}
                          className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex-1">
                            <Input
                              value={condition}
                              onChange={(e) =>
                                handleUpdateCondition(index, e.target.value)
                              }
                              placeholder="Escribir condición..."
                              disabled={loading}
                              className="border-0 bg-white focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleRemoveCondition(index)}
                            size="sm"
                            variant="ghost"
                            disabled={loading}
                            className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                      <div className="text-4xl mb-3">📝</div>
                      <p className="text-sm font-medium mb-2">
                        No hay condiciones definidas
                      </p>
                      <p className="text-xs text-gray-400 mb-4">
                        Agrega condiciones específicas para esta carta
                      </p>
                      <Button
                        type="button"
                        onClick={handleAddCondition}
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        disabled={loading}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar Primera Condición
                      </Button>
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                    className="px-6"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={loading}
                    className={`px-6 ${
                      isCloneMode
                        ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                        : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isCloneMode ? "Clonando..." : "Guardando..."}
                      </>
                    ) : (
                      <>
                        {isCloneMode ? (
                          <>
                            <svg
                              className="h-4 w-4 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Crear Copia
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Guardar Cambios
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditCardModal;
