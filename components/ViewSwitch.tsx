"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import AllIcon from "@/components/Icons/AllIcon";
import SquareAltIcon from "@/components/Icons/SquareAltIcon";
import TextIcon from "@/components/Icons/TextIcon";
import { ChevronDown, Check } from "lucide-react";
import { lockBodyScroll, unlockBodyScroll } from "@/components/ui/BaseDrawer";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ViewType = "grid" | "list" | "alternate" | "text";

interface ViewOption {
  id: ViewType;
  label: string;
  description: string;
  icon: (color: string) => React.ReactNode;
}

interface ViewSwitcherProps {
  viewSelected: ViewType;
  setViewSelected: (view: ViewType) => void;
  isAlternate?: boolean;
  isText?: boolean;
}

const VIEW_OPTIONS: ViewOption[] = [
  {
    id: "list",
    label: "Images",
    description: "Card images only",
    icon: (color) => <AllIcon size="22" color={color} />,
  },
  {
    id: "text",
    label: "Description",
    description: "Cards with details",
    icon: (color) => <TextIcon size="22" color={color} />,
  },
  {
    id: "alternate",
    label: "Alternates",
    description: "Show alternate arts",
    icon: (color) => <SquareAltIcon size="22" color={color} />,
  },
];

export default function ViewSwitcher({
  viewSelected,
  setViewSelected,
  isAlternate = true,
  isText = true,
}: ViewSwitcherProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filter available options based on props
  const availableOptions = VIEW_OPTIONS.filter((option) => {
    if (option.id === "text" && !isText) return false;
    if (option.id === "alternate" && !isAlternate) return false;
    return true;
  });

  const currentOption =
    availableOptions.find((o) => o.id === viewSelected) || availableOptions[0];
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
    (view: ViewType) => {
      setViewSelected(view);
      setIsMenuOpen(false);
    },
    [setViewSelected]
  );

  const handleBackdropClick = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  return (
    <>
      {/* Mobile: Single button that opens menu */}
      <div className="sm:hidden">
        <button
          onClick={() => setIsMenuOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border bg-white px-3 h-[42px] text-sm font-medium text-slate-700 transition-all active:scale-95"
        >
          {currentOption.icon("currentColor")}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* Desktop: Horizontal button group */}
      <div className="hidden sm:inline-flex rounded-lg border p-1 bg-white [&>button+button]:ml-1 h-[42px]">
        {isText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewSelected("text")}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md p-2.5 text-sm font-medium transition-all",
                    viewSelected === "text"
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-100 text-gray-500"
                  )}
                >
                  <TextIcon
                    size="22"
                    color={viewSelected === "text" ? "white" : "gray-500"}
                  />
                  <span className="sr-only">Description view</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Description View</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {isAlternate && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewSelected("alternate")}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md p-2.5 text-sm font-medium transition-all",
                    viewSelected === "alternate"
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-100 text-gray-500"
                  )}
                >
                  <SquareAltIcon
                    size="22"
                    color={viewSelected === "alternate" ? "white" : "gray-500"}
                  />
                  <span className="sr-only">Alternate</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Alternates View</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setViewSelected("list")}
                className={cn(
                  "inline-flex items-center justify-center rounded-md p-2.5 text-sm font-medium transition-all",
                  viewSelected === "list"
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-100 text-gray-500"
                )}
              >
                <AllIcon
                  size="22"
                  color={viewSelected === "list" ? "white" : "gray-500"}
                />
                <span className="sr-only">Images view</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Images View</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Mobile Menu Drawer */}
      {shouldRender && (
        <>
          {/* Backdrop */}
          <div
            className={cn(
              "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 sm:hidden",
              isVisible ? "opacity-100" : "opacity-0"
            )}
            onClick={handleBackdropClick}
          />

          {/* Menu */}
          <div
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 sm:hidden",
              isVisible ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
            <div
              className={cn(
                "w-full rounded-t-3xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out",
                isVisible ? "translate-y-0" : "translate-y-full"
              )}
            >
              {/* Handle */}
              <div className="flex justify-center py-3">
                <div className="h-1.5 w-12 rounded-full bg-slate-300" />
              </div>

              {/* Title */}
              <div className="px-5 pb-3 flex flex-col">
                <h3 className="text-lg font-semibold text-slate-900">
                  Select View
                </h3>
                <p className="text-sm text-slate-500">
                  Choose how to display cards
                </p>
              </div>

              {/* Options */}
              <div className="px-3 pb-6 space-y-1">
                {availableOptions.map((option, index) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={cn(
                      "w-full flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 active:scale-[0.98]",
                      viewSelected === option.id
                        ? "bg-blue-50 border-2 border-blue-500"
                        : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                    )}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                        viewSelected === option.id
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-600 shadow-sm"
                      )}
                    >
                      {option.icon(
                        viewSelected === option.id ? "white" : "currentColor"
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 text-left flex flex-col">
                      <p
                        className={cn(
                          "font-semibold",
                          viewSelected === option.id
                            ? "text-blue-700"
                            : "text-slate-900"
                        )}
                      >
                        {option.label}
                      </p>
                      <p className="text-sm text-slate-500">
                        {option.description}
                      </p>
                    </div>

                    {/* Checkmark */}
                    {viewSelected === option.id && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Safe area padding for iOS */}
              <div className="h-[env(safe-area-inset-bottom)]" />
            </div>
          </div>
        </>
      )}
    </>
  );
}
