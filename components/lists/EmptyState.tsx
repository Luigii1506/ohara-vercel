"use client";

import React from "react";
import { FolderOpen, Search, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
  onCreateCollection: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  hasFilters,
  onClearFilters,
  onCreateCollection,
}) => {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4">
        <div className="relative mb-6">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-slate-100 flex items-center justify-center">
            <Search className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
          </div>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 text-center">
          No se encontraron colecciones
        </h3>

        <p className="text-slate-500 text-center max-w-md mb-8 text-sm sm:text-base">
          Intenta ajustar tus filtros o crear una nueva colección para comenzar
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="h-12 px-6 rounded-xl border-slate-300 hover:bg-slate-50"
          >
            Limpiar Filtros
          </Button>
          <Button
            onClick={onCreateCollection}
            className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Colección
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4">
      <div className="relative mb-6">
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-emerald-100 to-blue-100 flex items-center justify-center">
          <FolderOpen className="w-10 h-10 sm:w-14 sm:h-14 text-emerald-500" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
        </div>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 text-center">
        No tienes colecciones aún
      </h3>

      <p className="text-slate-500 text-center max-w-md mb-8 text-sm sm:text-base">
        Crea tu primera colección para organizar y gestionar tus cartas de One
        Piece
      </p>

      <Button
        onClick={onCreateCollection}
        className="h-12 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-medium shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-200 transition-all duration-300"
      >
        <Plus className="w-5 h-5 mr-2" />
        Crear Primera Colección
      </Button>
    </div>
  );
};

export default EmptyState;
