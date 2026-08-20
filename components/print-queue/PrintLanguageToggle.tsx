"use client";

import { Languages } from "lucide-react";
import { PrintLanguage } from "@/store/printQueueStore";

interface PrintLanguageToggleProps {
  value: PrintLanguage;
  onChange: (value: PrintLanguage) => void;
  className?: string;
}

const OPTIONS: { value: PrintLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export default function PrintLanguageToggle({
  value,
  onChange,
  className = "",
}: PrintLanguageToggleProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 ${className}`.trim()}
    >
      <div className="flex items-center gap-2 px-2 text-slate-500">
        <Languages className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em]">
          Proxy
        </span>
      </div>
      <div className="flex items-center gap-1">
        {OPTIONS.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              aria-pressed={isActive}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
