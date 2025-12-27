"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Check, ChevronDown, X } from "lucide-react";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { useI18n } from "@/components/i18n/I18nProvider";

export interface SortOption {
  value: string;
  label: string;
  description?: string;
}

interface SortSelectProps {
  options: SortOption[];
  selected: string;
  setSelected: (value: string) => void;
  buttonLabel?: string;
}

export default function SortSelect({
  options,
  selected,
  setSelected,
  buttonLabel = "",
}: SortSelectProps) {
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentOption = options.find((o) => o.value === selected);

  const handleSelect = useCallback(
    (value: string) => {
      // Toggle selection - if already selected, clear it
      if (selected === value) {
        setSelected("");
      } else {
        setSelected(value);
      }
      setIsMenuOpen(false);
    },
    [selected, setSelected]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelected("");
    },
    [setSelected]
  );

  return (
    <>
      {/* Mobile: Button that opens drawer */}
      <div className="sm:hidden">
        <button
          onClick={() => setIsMenuOpen(true)}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 h-[42px] text-sm font-medium transition-all active:scale-95",
            selected
              ? "border-purple-300 bg-purple-50 text-purple-700"
              : "border-slate-200 bg-white text-slate-700"
          )}
        >
          <ArrowUpDown className="h-4 w-4" />
          {currentOption ? (
            <span className="max-w-[80px] truncate">{currentOption.label}</span>
          ) : (
            <span>{buttonLabel || t("common.sort")}</span>
          )}
          {selected && (
            <button
              onClick={handleClear}
              className="ml-0.5 rounded-full p-0.5 hover:bg-purple-200 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {!selected && <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
      </div>

      {/* Desktop: Popover-style button */}
      <div className="hidden sm:block">
        <button
          onClick={() => setIsMenuOpen(true)}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg border px-4 h-[42px] text-sm font-medium transition-all hover:bg-slate-50",
            selected
              ? "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100"
              : "border-slate-200 bg-white text-slate-700"
          )}
        >
          <ArrowUpDown className="h-4 w-4" />
          <span>{currentOption?.label || buttonLabel || t("common.sort")}</span>
          {selected ? (
            <button
              onClick={handleClear}
              className="ml-1 rounded-full p-0.5 hover:bg-purple-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>
      </div>

      <BaseDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        maxHeight="80vh"
      >
        <div className="flex flex-col max-h-[80vh] min-h-0">
          {/* Title */}
          <div className="px-5 pb-3 sm:pt-5 flex flex-col">
            <h3 className="text-lg font-semibold text-slate-900">
              {t("sort.title")}
            </h3>
            <p className="text-sm text-slate-500">{t("sort.subtitle")}</p>
          </div>

          {/* Options */}
          <div className="px-3 pb-6 space-y-1 overflow-y-auto min-h-0">
            {options.map((option, index) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "w-full flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 active:scale-[0.98]",
                  selected === option.value
                    ? "bg-purple-50 border-2 border-purple-500"
                    : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                    selected === option.value
                      ? "bg-purple-600 text-white"
                      : "bg-white text-slate-600 shadow-sm"
                  )}
                >
                  <ArrowUpDown className="h-5 w-5" />
                </div>

                {/* Text */}
                <div className="flex-1 text-left flex flex-col">
                  <p
                    className={cn(
                      "font-semibold",
                      selected === option.value
                        ? "text-purple-700"
                        : "text-slate-900"
                    )}
                  >
                    {option.label}
                  </p>
                  {option.description && (
                    <p className="text-sm text-slate-500">
                      {option.description}
                    </p>
                  )}
                </div>

                {/* Checkmark */}
                {selected === option.value && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Clear button if something is selected */}
          {selected && (
            <div className="px-3 pb-4">
              <button
                onClick={() => {
                  setSelected("");
                  setIsMenuOpen(false);
                }}
                className="w-full rounded-xl border-2 border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                {t("sort.clear")}
              </button>
            </div>
          )}

          {/* Safe area padding for iOS */}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </BaseDrawer>
    </>
  );
}
