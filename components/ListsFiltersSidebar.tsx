"use client";

import React, { forwardRef } from "react";
import {
  X,
  FilterX,
  Check,
  Folder,
  List,
  Globe,
  Lock,
  Calendar,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BaseDrawer from "@/components/ui/BaseDrawer";
// import { Slider } from "@/components/ui/slider"; // Not available
import SingleSelect from "./SingleSelect";

// Color options for folders
const colorOptions = [
  { value: "red", label: "Rojo", color: "#ef4444" },
  { value: "blue", label: "Azul", color: "#3b82f6" },
  { value: "green", label: "Verde", color: "#10b981" },
  { value: "yellow", label: "Amarillo", color: "#f59e0b" },
  { value: "purple", label: "Púrpura", color: "#8b5cf6" },
  { value: "pink", label: "Rosa", color: "#ec4899" },
  { value: "orange", label: "Naranja", color: "#f97316" },
  { value: "gray", label: "Gris", color: "#6b7280" },
];

// Sort options
const sortOptions = [
  { value: "name-asc", label: "Nombre (A-Z)" },
  { value: "name-desc", label: "Nombre (Z-A)" },
  { value: "date-desc", label: "Más reciente" },
  { value: "date-asc", label: "Más antiguo" },
  { value: "cards-desc", label: "Más cartas" },
  { value: "cards-asc", label: "Menos cartas" },
  { value: "pages-desc", label: "Más páginas" },
  { value: "pages-asc", label: "Menos páginas" },
];

interface ListsFiltersSidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;

  // Search
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  // Type filter
  selectedType: string; // "all", "folder", "list"
  setSelectedType: (type: string) => void;

  // Visibility filter
  selectedVisibility: string; // "all", "public", "private"
  setSelectedVisibility: (visibility: string) => void;

  // Status filter
  selectedStatus: string; // "all", "with-cards", "empty"
  setSelectedStatus: (status: string) => void;

  // Color filter
  selectedColors: string[];
  setSelectedColors: (colors: string[]) => void;

  // Cards range (simplified to preset ranges)
  selectedCardsRange: string; // "all", "empty", "1-10", "11-50", "51-100", "100+"
  setSelectedCardsRange: (range: string) => void;

  // Sort
  sortBy: string;
  setSortBy: (sort: string) => void;
}

const ListsFiltersSidebar = forwardRef<
  HTMLDivElement,
  ListsFiltersSidebarProps
>(
  (
    {
      isOpen,
      setIsOpen,
      searchTerm,
      setSearchTerm,
      selectedType,
      setSelectedType,
      selectedVisibility,
      setSelectedVisibility,
      selectedStatus,
      setSelectedStatus,
      selectedColors,
      setSelectedColors,
      selectedCardsRange,
      setSelectedCardsRange,
      sortBy,
      setSortBy,
    },
    ref
  ) => {
    const hasActiveFilters =
      selectedType !== "all" ||
      selectedVisibility !== "all" ||
      selectedStatus !== "all" ||
      selectedColors.length > 0 ||
      selectedCardsRange !== "all" ||
      sortBy !== "date-desc";

    const clearAllFilters = () => {
      setSelectedType("all");
      setSelectedVisibility("all");
      setSelectedStatus("all");
      setSelectedColors([]);
      setSelectedCardsRange("all");
      setSortBy("date-desc");
    };

    const handleColorToggle = (colorValue: string) => {
      if (selectedColors.includes(colorValue)) {
        setSelectedColors(selectedColors.filter((c) => c !== colorValue));
      } else {
        setSelectedColors([...selectedColors, colorValue]);
      }
    };

    return (
      <BaseDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        maxHeight="90vh"
        desktopModal
        desktopMaxWidth="max-w-2xl"
      >
        <div
          ref={ref}
          className="bg-white rounded-t-3xl lg:rounded-2xl border border-gray-200 w-full max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <FilterX className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Filtros de Colecciones
                </h2>
                <p className="text-sm text-gray-600">
                  Personaliza tu vista de colecciones y listas
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Filters Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Type Filter */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Tipo de colección
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={selectedType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("all")}
                  className="justify-start"
                >
                  Todos
                </Button>
                <Button
                  variant={selectedType === "folder" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("folder")}
                  className="justify-start"
                >
                  <Folder className="w-3 h-3 mr-1" />
                  Colecciones
                </Button>
                <Button
                  variant={selectedType === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("list")}
                  className="justify-start"
                >
                  <List className="w-3 h-3 mr-1" />
                  Listas
                </Button>
              </div>
            </div>

            {/* Visibility Filter */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Visibilidad
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={selectedVisibility === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedVisibility("all")}
                  className="justify-start"
                >
                  Todas
                </Button>
                <Button
                  variant={
                    selectedVisibility === "public" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedVisibility("public")}
                  className="justify-start"
                >
                  <Globe className="w-3 h-3 mr-1" />
                  Públicas
                </Button>
                <Button
                  variant={
                    selectedVisibility === "private" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedVisibility("private")}
                  className="justify-start"
                >
                  <Lock className="w-3 h-3 mr-1" />
                  Privadas
                </Button>
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Estado del Contenido
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={selectedStatus === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("all")}
                  className="justify-start"
                >
                  Todas
                </Button>
                <Button
                  variant={
                    selectedStatus === "with-cards" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedStatus("with-cards")}
                  className="justify-start"
                >
                  <Package className="w-3 h-3 mr-1" />
                  Con Cartas
                </Button>
                <Button
                  variant={selectedStatus === "empty" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("empty")}
                  className="justify-start"
                >
                  Vacías
                </Button>
              </div>
            </div>

            {/* Color Filter */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Color de Colección
              </label>
              <div className="grid grid-cols-4 gap-2">
                {colorOptions.map((color) => (
                  <Button
                    key={color.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleColorToggle(color.value)}
                    className={`justify-start border-2 transition-all ${
                      selectedColors.includes(color.value)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: color.color }}
                    />
                    {selectedColors.includes(color.value) && (
                      <Check className="w-3 h-3 ml-auto text-blue-500" />
                    )}
                    <span className="sr-only">{color.label}</span>
                  </Button>
                ))}
              </div>
              {selectedColors.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedColors.map((colorValue) => {
                    const color = colorOptions.find(
                      (c) => c.value === colorValue
                    );
                    return color ? (
                      <Badge
                        key={colorValue}
                        variant="secondary"
                        className="text-xs"
                      >
                        <div
                          className="w-2 h-2 rounded-full mr-1"
                          style={{ backgroundColor: color.color }}
                        />
                        {color.label}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Cards Range */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Rango de Cartas
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={selectedCardsRange === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCardsRange("all")}
                  className="justify-start"
                >
                  Todas
                </Button>
                <Button
                  variant={
                    selectedCardsRange === "empty" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedCardsRange("empty")}
                  className="justify-start"
                >
                  Vacías (0)
                </Button>
                <Button
                  variant={
                    selectedCardsRange === "1-10" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedCardsRange("1-10")}
                  className="justify-start"
                >
                  1-10 cartas
                </Button>
                <Button
                  variant={
                    selectedCardsRange === "11-50" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedCardsRange("11-50")}
                  className="justify-start"
                >
                  11-50 cartas
                </Button>
                <Button
                  variant={
                    selectedCardsRange === "51-100" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedCardsRange("51-100")}
                  className="justify-start"
                >
                  51-100 cartas
                </Button>
                <Button
                  variant={
                    selectedCardsRange === "100+" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedCardsRange("100+")}
                  className="justify-start"
                >
                  100+ cartas
                </Button>
              </div>
            </div>

            {/* Sort */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Ordenar Por
              </label>
              <SingleSelect
                options={sortOptions}
                selected={sortBy}
                setSelected={setSortBy}
                buttonLabel="Seleccionar ordenamiento"
                isSearchable={false}
                isSolid={true}
                isFullWidth={true}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
            <Button
              variant="outline"
              onClick={clearAllFilters}
              disabled={!hasActiveFilters}
              className={`flex-1 ${
                hasActiveFilters
                  ? "border-red-300 text-red-700 hover:bg-red-50"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <FilterX className="w-4 h-4 mr-2" />
              Limpiar Filtros
            </Button>
            <Button
              onClick={() => setIsOpen(false)}
              className="flex-1 bg-blue-500 hover:bg-blue-600"
            >
              <Check className="w-4 h-4 mr-2" />
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </BaseDrawer>
    );
  }
);

ListsFiltersSidebar.displayName = "ListsFiltersSidebar";

export default ListsFiltersSidebar;
