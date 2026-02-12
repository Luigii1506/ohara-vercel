"use client";

import React from "react";
import { FolderOpen, Plus, Package, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ListsHeaderProps {
  count: number;
  totalCount?: number;
  hasFilters: boolean;
  onCreateCollection: () => void;
  onImport: () => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
}

export const ListsHeader: React.FC<ListsHeaderProps> = ({
  count,
  totalCount,
  hasFilters,
  onCreateCollection,
  onImport,
  onOpenFilters,
  activeFilterCount,
}) => {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Top row: Title and main actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Title section */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Mis Colecciones
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="secondary"
                  className="text-xs font-medium bg-slate-100 text-slate-700"
                >
                  {count} {count === 1 ? "colección" : "colecciones"}
                </Badge>
                {hasFilters && totalCount !== undefined && (
                  <span className="text-xs text-slate-500">
                    de {totalCount} total
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile filter button */}
            <Button
              variant={activeFilterCount > 0 ? "default" : "outline"}
              size="sm"
              onClick={onOpenFilters}
              className="sm:hidden h-10 px-3 rounded-xl"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 bg-white text-slate-900 text-xs"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            {/* Import button - hidden on smallest screens */}
            <Button
              variant="outline"
              onClick={onImport}
              className="hidden sm:flex h-11 px-4 rounded-xl border-slate-200 hover:bg-slate-50"
            >
              <Package className="w-4 h-4 mr-2" />
              Importar
            </Button>

            {/* Create button */}
            <Button
              onClick={onCreateCollection}
              className="h-11 px-4 sm:px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-200 transition-all duration-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Nueva Colección</span>
              <span className="sm:hidden">Nueva</span>
            </Button>
          </div>
        </div>

        {/* Quick stats row - desktop only */}
        <div className="hidden sm:flex items-center gap-6 mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Carpetas organizadas</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Listas flexibles</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Comparte con la comunidad</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListsHeader;
