"use client";

import React from "react";
import { X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ActiveFiltersProps {
  searchTerm: string;
  selectedType: string;
  selectedVisibility: string;
  selectedStatus: string;
  selectedColors: string[];
  selectedCardsRange: string;
  sortBy: string;
  onClearSearch: () => void;
  onClearType: () => void;
  onClearVisibility: () => void;
  onClearStatus: () => void;
  onClearColor: (color: string) => void;
  onClearCardsRange: () => void;
  onClearSort: () => void;
  onClearAll: () => void;
}

const colorMap: Record<string, { label: string; color: string }> = {
  red: { label: "Rojo", color: "#ef4444" },
  blue: { label: "Azul", color: "#3b82f6" },
  green: { label: "Verde", color: "#10b981" },
  yellow: { label: "Amarillo", color: "#f59e0b" },
  purple: { label: "Púrpura", color: "#8b5cf6" },
  pink: { label: "Rosa", color: "#ec4899" },
  orange: { label: "Naranja", color: "#f97316" },
  gray: { label: "Gris", color: "#6b7280" },
};

const typeLabels: Record<string, string> = {
  folder: "Carpetas",
  list: "Listas",
};

const visibilityLabels: Record<string, string> = {
  public: "Públicas",
  private: "Privadas",
};

const statusLabels: Record<string, string> = {
  "with-cards": "Con cartas",
  empty: "Vacías",
};

const cardsRangeLabels: Record<string, string> = {
  empty: "0 cartas",
  "1-10": "1-10 cartas",
  "11-50": "11-50 cartas",
  "51-100": "51-100 cartas",
  "100+": "100+ cartas",
};

const sortLabels: Record<string, string> = {
  "name-asc": "Nombre A-Z",
  "name-desc": "Nombre Z-A",
  "date-desc": "Más reciente",
  "date-asc": "Más antiguo",
  "cards-desc": "Más cartas",
  "cards-asc": "Menos cartas",
  "pages-desc": "Más páginas",
  "pages-asc": "Menos páginas",
};

export const ActiveFilters: React.FC<ActiveFiltersProps> = ({
  searchTerm,
  selectedType,
  selectedVisibility,
  selectedStatus,
  selectedColors,
  selectedCardsRange,
  sortBy,
  onClearSearch,
  onClearType,
  onClearVisibility,
  onClearStatus,
  onClearColor,
  onClearCardsRange,
  onClearSort,
  onClearAll,
}) => {
  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    selectedType !== "all" ||
    selectedVisibility !== "all" ||
    selectedStatus !== "all" ||
    selectedColors.length > 0 ||
    selectedCardsRange !== "all" ||
    sortBy !== "date-desc";

  if (!hasActiveFilters) return null;

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Filtros activos:</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 ml-auto"
        >
          Limpiar todo
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Search term */}
        {searchTerm.trim() !== "" && (
          <Badge
            variant="secondary"
            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors"
            onClick={onClearSearch}
          >
            Buscar: {searchTerm.length > 20 ? `${searchTerm.slice(0, 20)}...` : searchTerm}
            <X className="w-3 h-3 ml-2" />
          </Badge>
        )}

        {/* Type */}
        {selectedType !== "all" && (
          <Badge
            variant="secondary"
            className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 cursor-pointer transition-colors"
            onClick={onClearType}
          >
            {typeLabels[selectedType] || selectedType}
            <X className="w-3 h-3 ml-2" />
          </Badge>
        )}

        {/* Visibility */}
        {selectedVisibility !== "all" && (
          <Badge
            variant="secondary"
            className="px-3 py-1.5 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer transition-colors"
            onClick={onClearVisibility}
          >
            {visibilityLabels[selectedVisibility] || selectedVisibility}
            <X className="w-3 h-3 ml-2" />
          </Badge>
        )}

        {/* Status */}
        {selectedStatus !== "all" && (
          <Badge
            variant="secondary"
            className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer transition-colors"
            onClick={onClearStatus}
          >
            {statusLabels[selectedStatus] || selectedStatus}
            <X className="w-3 h-3 ml-2" />
          </Badge>
        )}

        {/* Colors */}
        {selectedColors.map((color) => {
          const colorInfo = colorMap[color];
          return (
            <Badge
              key={color}
              variant="secondary"
              className="px-3 py-1.5 text-sm border hover:opacity-80 cursor-pointer transition-opacity"
              style={{
                backgroundColor: `${colorInfo?.color}15`,
                borderColor: `${colorInfo?.color}40`,
                color: colorInfo?.color,
              }}
              onClick={() => onClearColor(color)}
            >
              <span
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: colorInfo?.color }}
              />
              {colorInfo?.label || color}
              <X className="w-3 h-3 ml-2" />
            </Badge>
          );
        })}

        {/* Cards range */}
        {selectedCardsRange !== "all" && (
          <Badge
            variant="secondary"
            className="px-3 py-1.5 text-sm bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 cursor-pointer transition-colors"
            onClick={onClearCardsRange}
          >
            {cardsRangeLabels[selectedCardsRange] || selectedCardsRange}
            <X className="w-3 h-3 ml-2" />
          </Badge>
        )}

        {/* Sort */}
        {sortBy !== "date-desc" && (
          <Badge
            variant="secondary"
            className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 cursor-pointer transition-colors"
            onClick={onClearSort}
          >
            Orden: {sortLabels[sortBy] || sortBy}
            <X className="w-3 h-3 ml-2" />
          </Badge>
        )}
      </div>
    </div>
  );
};

export default ActiveFilters;
