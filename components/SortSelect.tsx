"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Check, ChevronDown, X } from "lucide-react";
import { lockBodyScroll, unlockBodyScroll } from "@/components/ui/BaseDrawer";

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
  buttonLabel = "Sort by",
}: SortSelectProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentOption = options.find((o) => o.value === selected);

  const wasOpenRef = useRef(false);

  // Handle menu open/close with animations
  useEffect(() => {
    if (isMenuOpen) {
      setShouldRender(true);
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      if (!wasOpenRef.current) {
        lockBodyScroll();
        wasOpenRef.current = true;
      }
    } else {
      setIsVisible(false);
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      if (wasOpenRef.current) {
        unlockBodyScroll();
        wasOpenRef.current = false;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isMenuOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wasOpenRef.current) {
        unlockBodyScroll();
      }
    };
  }, []);

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

  const handleBackdropClick = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

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
            <span>{buttonLabel}</span>
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
          <span>{currentOption?.label || buttonLabel}</span>
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

      {/* Mobile/Desktop Menu Drawer */}
      {shouldRender && (
        <>
          {/* Backdrop */}
          <div
            className={cn(
              "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
              isVisible ? "opacity-100" : "opacity-0"
            )}
            onClick={handleBackdropClick}
          />

          {/* Menu - Mobile bottom sheet, Desktop centered */}
          <div
            className={cn(
              "fixed z-50",
              // Mobile: bottom sheet
              "inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
              isVisible ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
            <div
              className={cn(
                "w-full bg-white shadow-2xl transition-all duration-300 ease-out",
                // Mobile: rounded top, slide up
                "rounded-t-3xl border border-slate-200 sm:rounded-2xl sm:max-w-sm",
                isVisible
                  ? "translate-y-0 sm:scale-100 sm:opacity-100"
                  : "translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0"
              )}
            >
              {/* Handle - Mobile only */}
              <div className="flex justify-center py-3 sm:hidden">
                <div className="h-1.5 w-12 rounded-full bg-slate-300" />
              </div>

              {/* Title */}
              <div className="px-5 pb-3 sm:pt-5 flex flex-col">
                <h3 className="text-lg font-semibold text-slate-900">
                  Sort Cards
                </h3>
                <p className="text-sm text-slate-500">
                  Choose how to order results
                </p>
              </div>

              {/* Options */}
              <div className="px-3 pb-6 space-y-1">
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
                    Clear sorting
                  </button>
                </div>
              )}

              {/* Safe area padding for iOS */}
              <div className="h-[env(safe-area-inset-bottom)]" />
            </div>
          </div>
        </>
      )}
    </>
  );
}
