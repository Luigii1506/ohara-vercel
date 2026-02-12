"use client";

import React, { useState } from "react";
import { Lock, Globe, MoreHorizontal } from "lucide-react";
import { UserList } from "@/types";

interface CollectionCardProps {
  list: UserList;
  onView: (list: UserList) => void;
  onAddCards: (list: UserList) => void;
  onEdit: (list: UserList) => void;
  onShare: (list: UserList) => void;
  onDelete: (list: UserList) => void;
  onPreview: (list: UserList) => void;
  formatCurrency: (value: number, currency?: string) => string;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({
  list,
  onView,
  onAddCards,
  onEdit,
  onShare,
  onDelete,
  onPreview,
  formatCurrency,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const cardCount = list._count?.cards || 0;
  const hasValue = list.totalValue !== undefined && list.totalValue > 0;
  const themeColor = list.color || "#3B82F6";

  return (
    <div className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all overflow-hidden">
      {/* Color strip at top */}
      <div className="h-1.5 w-full" style={{ backgroundColor: themeColor }} />
      
      {/* Main content */}
      <div 
        className="p-3 sm:p-4 cursor-pointer"
        onClick={() => onView(list)}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: Color indicator + Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Color circle indicator */}
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
              style={{ backgroundColor: themeColor }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 truncate text-base sm:text-lg">
                {list.name}
              </h3>
              
              <div className="flex items-center gap-2 sm:gap-3 mt-1 text-sm text-slate-500">
                <span>{cardCount} cartas</span>
                {list.totalPages && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{list.totalPages} págs</span>
                  </>
                )}
              </div>

              {hasValue && (
                <p className="mt-2 text-base sm:text-lg font-bold text-slate-900">
                  {formatCurrency(list.totalValue!, list.currency)}
                </p>
              )}
            </div>
          </div>

          {/* Right: Visibility icon */}
          <div className="flex-shrink-0">
            {list.isPublic ? (
              <Globe className="w-4 h-4 text-emerald-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Actions footer */}
      <div className="px-3 sm:px-4 pb-3 flex items-center gap-2">
        <button
          onClick={() => onView(list)}
          className="flex-1 h-9 sm:h-10 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: themeColor }}
        >
          Ver
        </button>
        <button
          onClick={() => onAddCards(list)}
          className="flex-1 h-9 sm:h-10 rounded-md text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
        >
          Agregar
        </button>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-9 sm:w-10 h-9 sm:h-10 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 bottom-11 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                <button
                  onClick={() => { onPreview(list); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Vista rápida
                </button>
                <button
                  onClick={() => { onShare(list); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Compartir
                </button>
                <button
                  onClick={() => { onEdit(list); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Editar
                </button>
                {list.isDeletable && (
                  <>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => { onDelete(list); setShowMenu(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectionCard;
