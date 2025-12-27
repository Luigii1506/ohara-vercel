"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

interface BaseCardsToggleProps {
  isActive: boolean;
  onToggle: () => void;
  className?: string;
}

export default function BaseCardsToggle({
  isActive,
  onToggle,
  className,
}: BaseCardsToggleProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Show tooltip when state changes (but not on first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set message based on new state
    setTooltipMessage(isActive ? "Alternates hidden" : "Showing all variants");
    setShowTooltip(true);

    // Hide tooltip after 2 seconds
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 2000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isActive]);

  return (
    <div className="relative">
      {/* Animated Tooltip */}
      <div
        className={cn(
          "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none transition-all duration-300 ease-out z-50",
          showTooltip
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2"
        )}
      >
        <div
          className={cn(
            "relative px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg",
            isActive
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
              : "bg-slate-800 text-white"
          )}
        >
          {tooltipMessage}
          {/* Arrow */}
          <div
            className={cn(
              "absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent",
              isActive ? "border-t-orange-500" : "border-t-slate-800"
            )}
          />
        </div>
      </div>

      {/* Toggle Button */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "relative inline-flex items-center gap-1.5 px-2.5 h-[42px] rounded-lg font-medium text-xs transition-all duration-200 ease-out active:scale-95",
          isActive
            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-200"
            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
          className
        )}
      >
        {/* Icon with animated layers effect */}
        <div className="relative flex items-center justify-center w-5 h-5">
          <Layers
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isActive && "scale-90"
            )}
          />
          {/* Animated slash overlay when active */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-all duration-200",
              isActive ? "opacity-100 scale-100" : "opacity-0 scale-75"
            )}
          >
            <div className="w-5 h-0.5 bg-current rotate-45 rounded-full" />
          </div>
        </div>

        {/* Label - hidden on mobile, visible on sm+ */}
        <span className="hidden sm:inline whitespace-nowrap">
          {isActive ? "Base" : "All"}
        </span>
      </button>
    </div>
  );
}
