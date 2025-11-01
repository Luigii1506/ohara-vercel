import React, { useState } from "react";
import { Gem } from "lucide-react";

interface ProToggleButtonProps {
  isActive?: boolean;
  onToggle?: (isActive: boolean) => void;
  className?: string;
}

export const ProToggleButton: React.FC<ProToggleButtonProps> = ({
  isActive: controlledIsActive,
  onToggle,
  className = "",
}) => {
  const [internalIsActive, setInternalIsActive] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isActive =
    controlledIsActive !== undefined ? controlledIsActive : internalIsActive;

  const handleToggle = () => {
    const newState = !isActive;
    if (controlledIsActive === undefined) {
      setInternalIsActive(newState);
    }
    onToggle?.(newState);
  };

  return (
    <button
      onClick={handleToggle}
      className={`
        group relative overflow-hidden rounded-lg px-6 py-2 font-semibold text-sm
        transition-all duration-300 ease-out
        transform hover:scale-105 active:scale-95
        focus:outline-none focus:ring-4 focus:ring-yellow-500/30
        ${
          isActive
            ? "bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-white shadow-xl shadow-yellow-500/25"
            : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 shadow-lg hover:shadow-xl"
        }
        ${className}
      `}
      type="button"
    >
      {/* Animated background shine effect */}
      <div
        className={`
        absolute inset-0 opacity-0 group-hover:opacity-100
        bg-gradient-to-r from-transparent via-white/20 to-transparent
        transform -translate-x-full group-hover:translate-x-full
        transition-all duration-700 ease-out
        ${isActive ? "via-white/30" : "via-white/10"}
      `}
      />

      {/* Content */}
      <div className="relative flex items-center gap-2">
        <Gem
          className={`
            w-5 h-5 transition-all duration-300 ease-out
            transform group-hover:rotate-12
            ${isActive ? "text-white drop-shadow-sm" : "text-gray-600"}
          `}
        />
        <span className="font-bold tracking-wide hidden sm:block">
          {isActive ? "PRO ACTIVADO" : "ACTIVAR PRO"}
        </span>
      </div>

      {/* Glowing border for active state */}
      {isActive && (
        <div className="absolute inset-0 rounded-lg border-2 border-yellow-300/50 animate-pulse" />
      )}

      {/* Inner glow effect */}
      <div
        className={`
        absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100
        transition-opacity duration-300
        ${
          isActive
            ? "bg-gradient-to-r from-yellow-400/10 via-transparent to-yellow-400/10"
            : "bg-gradient-to-r from-gray-300/10 via-transparent to-gray-300/10"
        }
      `}
      />
    </button>
  );
};
