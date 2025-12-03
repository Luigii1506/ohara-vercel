"use client";

import React from "react";
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
import MultiSelect from "@/components/MultiSelect";
import SingleSelect from "@/components/SingleSelect";
import { allRegions, altArtOptions } from "@/helpers/constants";
import { Save, Loader2, Plus } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import AddSetModal from "./AddSetModal";
import { useQueryClient } from "@tanstack/react-query";

interface AlternateCard {
  id: string;
  src: string;
  sets: { set: { id: string; title: string; code?: string | null } }[];
  alias: string;
  tcgUrl?: string;
  alternateArt?: string | null;
  order?: string;
  isPro?: boolean;
  region?: string;
  isFirstEdition?: boolean;
  code?: string;
  setCode?: string;
  baseCardId?: number | null;
}

interface Set {
  id: string;
  title: string;
  code?: string | null;
}

interface EditAlternateModalProps {
  isOpen: boolean;
  onClose: () => void;
  alternate: AlternateCard | null;
  sets: Set[];
  setsDropdown: { value: string; label: string }[];
  onSave: (updatedAlternate: AlternateCard) => Promise<void>;
  loading?: boolean;
  onCancel?: () => void; // Nueva función para manejar cancelación
}

const EditAlternateModal: React.FC<EditAlternateModalProps> = ({
  isOpen,
  onClose,
  alternate,
  sets,
  setsDropdown,
  onSave,
  loading = false,
  onCancel,
}) => {
  const [editingAlternate, setEditingAlternate] =
    React.useState<AlternateCard | null>(null);
  const [localLoading, setLocalLoading] = React.useState(false);

  // 🎯 Ref para el botón guardar
  const saveButtonRef = React.useRef<HTMLButtonElement>(null);

  // Estados para el modal de agregar sets
  const [showAddSetModal, setShowAddSetModal] = React.useState(false);
  const [localSets, setLocalSets] = React.useState<Set[]>(sets);
  const [localSetsDropdown, setLocalSetsDropdown] =
    React.useState<{ value: string; label: string }[]>(setsDropdown);

  // ✅ OPTIMIZADO: Usar TanStack Query para invalidar cache
  const queryClient = useQueryClient();

  // Actualizar el estado cuando cambia el alternate
  React.useEffect(() => {
    if (alternate) {
      setEditingAlternate({ ...alternate });
    } else {
      setEditingAlternate(null);
    }
  }, [alternate]);

  // Actualizar estados locales cuando cambien las props
  React.useEffect(() => {
    setLocalSets(sets);
    setLocalSetsDropdown(setsDropdown);
  }, [sets, setsDropdown]);

  React.useEffect(() => {
    if (!isOpen) {
      setLocalLoading(false);
    }
  }, [isOpen]);

  // 🚀 Enter key handler - Focus save button
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEnterKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        // Check if focus is on an interactive element that should handle Enter normally
        const activeElement = document.activeElement as HTMLElement;
        const isInteractiveElement =
          activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA" ||
          activeElement?.tagName === "SELECT" ||
          activeElement?.tagName === "BUTTON" ||
          activeElement?.role === "button" ||
          activeElement?.role === "combobox" ||
          activeElement?.contentEditable === "true";

        // If focus is on interactive element, let it handle Enter normally
        if (isInteractiveElement) return;

        // Focus the save button
        event.preventDefault();
        saveButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleEnterKey);

    return () => {
      document.removeEventListener("keydown", handleEnterKey);
    };
  }, [isOpen]);

  const handleFieldChange = (field: string, value: any) => {
    if (!editingAlternate) return;
    setEditingAlternate({
      ...editingAlternate,
      [field]: value,
    });
  };

  const handleSetsChange = (setIds: string[]) => {
    if (!editingAlternate) return;
    const newSets = setIds.map((setId) => {
      const setData = localSets.find((s) => s.id === setId);
      return setData ? { set: setData } : { set: { id: setId, title: setId } };
    });

    // Actualizar setCode con TODOS los códigos de los sets seleccionados, separados por comas
    const setCodes: string[] = [];
    setIds.forEach((setId) => {
      const setData = localSets.find((s) => s.id === setId);
      if (setData && (setData as any)?.code) {
        setCodes.push((setData as any).code);
      }
    });

    // Unir todos los códigos con comas, o dejar vacío si no hay códigos
    const newSetCode = setCodes.length > 0 ? setCodes.join(",") : "";

    // Actualizar ambos campos: sets y setCode
    setEditingAlternate({
      ...editingAlternate,
      sets: newSets,
      setCode: newSetCode,
    });
  };

  // Manejar cuando se crea un nuevo set
  const handleSetCreated = async (newSet: { id: string; title: string }) => {
    // Agregar el nuevo set a los estados locales
    const newSetData: Set = {
      id: newSet.id,
      title: newSet.title,
    };

    const newDropdownItem = {
      value: newSet.id,
      label: newSet.title,
    };

    setLocalSets((prev) => [...prev, newSetData]);
    setLocalSetsDropdown((prev) => [...prev, newDropdownItem]);

    // Seleccionar automáticamente el set recién creado
    if (editingAlternate) {
      const currentSetIds = editingAlternate.sets?.map((s) => s.set.id) || [];
      const updatedSetIds = [...currentSetIds, newSet.id];
      handleSetsChange(updatedSetIds);
    }
  };

  const handleSave = async () => {
    if (!editingAlternate) return;

    const setLoadingState = (value: boolean) => {
      setLocalLoading(value);
    };

    // Verificar si es una alterna temporal (nueva)
    const isTempAlternate =
      typeof editingAlternate.id === "string" &&
      editingAlternate.id.startsWith("temp-");

    if (isTempAlternate) {
      // Es una nueva alterna, crear en BD
      setLoadingState(true);
      try {
        const baseCardNumericId =
          typeof editingAlternate.baseCardId === "number"
            ? editingAlternate.baseCardId
            : editingAlternate.baseCardId
            ? Number(editingAlternate.baseCardId)
            : null;
        const resolvedBaseCardId =
          baseCardNumericId && !Number.isNaN(baseCardNumericId)
            ? baseCardNumericId
            : null;
        // Preparar datos para crear en BD
        const newAlternateData = {
          ...editingAlternate,
          setIds: editingAlternate.sets?.map((s) => s.set.id) || [],
          isFirstEdition: false, // CRÍTICO: Asegurar que las alternas nunca sean first edition
          baseCardId: resolvedBaseCardId ?? undefined,
        };

        // Llamar a la API para crear
        const response = await fetch("/api/admin/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newAlternateData),
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const createdAlternate = await response.json();

        // Llamar a onSave con la alterna creada (que ya no es temporal)
        // Importante: pasar SOLO los datos reales del servidor
        const realAlternateData = {
          ...createdAlternate,
          id: createdAlternate.id, // Usar el ID real de la BD
          sets: createdAlternate.sets || [], // Usar los sets reales del servidor
        };

        await onSave(realAlternateData);

        // 🚀 Invalidar cache de TanStack Query para refrescar datos
        queryClient.invalidateQueries({ queryKey: ['cards'] });
      } catch (error) {
        console.error("Error al crear alterna en BD:", error);
        throw error; // Re-lanzar para que el componente padre maneje el error
      } finally {
        setLoadingState(false);
      }
    } else {
      // Es una alterna existente, solo actualizar
      try {
        setLoadingState(true);
        await onSave(editingAlternate);
      } finally {
        setLoadingState(false);
      }
    }
  };

  const handleModalClose = () => {
    setEditingAlternate(null);

    // Si es una alterna temporal y hay función de cancelación, llamarla
    if (
      editingAlternate?.id &&
      typeof editingAlternate.id === "string" &&
      editingAlternate.id.startsWith("temp-") &&
      onCancel
    ) {
      onCancel();
    }

    onClose();
  };

  // Función removida - ya no es necesaria para el manejo correcto del MultiSelect

  if (!editingAlternate) return null;

  return (
    <>
      {/* CSS simplificado - isSolid=true evita conflictos de popover */}
      <style jsx global>{`
        /* Asegurar funcionalidad del MultiSelect en modo sólido */
        [data-modal-id="edit-alternate-modal"] input {
          pointer-events: auto !important;
          cursor: text !important;
          user-select: text !important;
        }

        /* Checkboxes y elementos interactivos */
        [data-modal-id="edit-alternate-modal"] [data-radix-checkbox-root] {
          pointer-events: auto !important;
          cursor: pointer !important;
        }

        /* Elementos clickeables en general */
        [data-modal-id="edit-alternate-modal"] button {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
      `}</style>

      <Dialog open={isOpen} onOpenChange={handleModalClose}>
        <DialogContent
          className={`max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-200 ${
            showAddSetModal
              ? "opacity-95 scale-[0.98]"
              : "opacity-100 scale-100"
          }`}
          style={{ zIndex: 9999 }}
          data-modal-id="edit-alternate-modal"
          onPointerDownOutside={(e) => {
            // Permitir cerrar el modal al hacer click fuera, incluso con selects sólidos
            handleModalClose();
          }}
          onEscapeKeyDown={(e) => {
            // 🔥 Check global markers set by select components
            const multiSelectOpen = document.documentElement.hasAttribute(
              "data-multiselect-open"
            );
            const singleSelectOpen = document.documentElement.hasAttribute(
              "data-singleselect-open"
            );

            if (multiSelectOpen || singleSelectOpen) {
              // There are open selects, prevent modal from closing
              e.preventDefault();
              return;
            }

            // No selects open, allow modal to close normally
            handleModalClose();
          }}
          // Comportamiento estándar de modal - isSolid=true evita conflictos de popover
        >
          <DialogHeader>
            <DialogTitle>Editar Alterna: {editingAlternate.code}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview y datos básicos */}
            <div className="flex gap-4">
              <div className="w-32 aspect-[2/3] flex-shrink-0">
                <LazyImage
                  src={editingAlternate.src}
                  fallbackSrc="/assets/images/backcard.webp"
                  alt={editingAlternate.alias || "Alterna"}
                  className="w-full h-full object-cover rounded border"
                />
              </div>

              <div className="flex-1 space-y-3">
                {/* URL de Imagen */}
                <div>
                  <Label htmlFor="src">URL de Imagen</Label>
                  <Input
                    id="src"
                    value={editingAlternate.src || ""}
                    onChange={(e) => handleFieldChange("src", e.target.value)}
                    placeholder="https://..."
                    disabled={loading || localLoading}
                  />
                </div>

                {/* Alias */}
                <div>
                  <Label htmlFor="alias">Alias</Label>
                  <Input
                    id="alias"
                    value={editingAlternate.alias || ""}
                    onChange={(e) => handleFieldChange("alias", e.target.value)}
                    placeholder="Nombre de la variación"
                    disabled={loading || localLoading}
                  />
                </div>
              </div>
            </div>

            {/* Sets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Set</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddSetModal(true)}
                  disabled={loading || localLoading}
                  className="h-6 px-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  title="Crear nuevo set"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Nuevo Set
                </Button>
              </div>
              <MultiSelect
                options={localSetsDropdown}
                selected={editingAlternate.sets?.map((s) => s.set.id) || []}
                setSelected={handleSetsChange}
                displaySelectedAs={(selected) =>
                  selected.length === 1
                    ? localSetsDropdown.find((s) => s.value === selected[0])
                        ?.label || selected[0]
                    : `${selected.length} sets`
                }
                searchPlaceholder="Buscar sets..."
                isSolid={true}
                isSearchable={true}
                isFullWidth={true}
                isDisabled={loading || localLoading}
              />
            </div>

            {/* URL TCG */}
            <div>
              <Label htmlFor="tcgUrl">URL TCG</Label>
                <Input
                  id="tcgUrl"
                  value={editingAlternate.tcgUrl || ""}
                  onChange={(e) => handleFieldChange("tcgUrl", e.target.value)}
                  placeholder="https://..."
                  disabled={loading || localLoading}
                />
              </div>

            {/* Tipo de Arte Alternativo */}
            <div>
              <Label>Tipo de Arte</Label>
                <SingleSelect
                  options={altArtOptions}
                  selected={editingAlternate.alternateArt || ""}
                  setSelected={(value) =>
                    handleFieldChange("alternateArt", value)
                  }
                  buttonLabel="Seleccionar tipo"
                  isSearchable={true}
                  isSolid={true}
                  isFullWidth={true}
                  isDisabled={loading || localLoading}
                />
            </div>

            {/* Región */}
            <div>
              <Label>Región</Label>
              <SingleSelect
                options={allRegions}
                selected={editingAlternate.region || ""}
                setSelected={(value) => handleFieldChange("region", value)}
                buttonLabel="Seleccionar región"
                isSearchable={true}
                isSolid={true}
                isFullWidth={true}
                isDisabled={loading || localLoading}
              />
            </div>

            {/* Es Pro */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPro"
                checked={editingAlternate.isPro || false}
                onChange={(e) => handleFieldChange("isPro", e.target.checked)}
                disabled={loading}
                className="rounded"
              />
              <Label htmlFor="isPro">Es carta PRO</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleModalClose}
              disabled={loading || localLoading}
            >
              Cancelar
            </Button>
            <Button
              ref={saveButtonRef}
              onClick={handleSave}
              disabled={
                loading ||
                localLoading ||
                !editingAlternate ||
                editingAlternate.sets.length === 0
              }
            >
              {loading || localLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para crear nuevo set */}
      <AddSetModal
        isOpen={showAddSetModal}
        onClose={() => setShowAddSetModal(false)}
        onSetCreated={handleSetCreated}
      />
    </>
  );
};

export default EditAlternateModal;
