"use client";

import { BadgeDollarSign } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type PriceField = "marketPrice" | "midPrice";

interface PriceFieldToggleProps {
  value: PriceField;
  onChange: (value: PriceField) => void;
  className?: string;
}

export default function PriceFieldToggle({
  value,
  onChange,
  className,
}: PriceFieldToggleProps) {
  const isMedian = value === "midPrice";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 h-[42px] text-xs font-medium text-slate-700 shadow-sm",
              className
            )}
          >
            <BadgeDollarSign className="h-4 w-4 text-slate-500" />
            <span
              className={cn(
                "hidden sm:inline",
                !isMedian && "font-semibold text-slate-900"
              )}
            >
              Market
            </span>
            <Switch
              checked={isMedian}
              onCheckedChange={(checked) =>
                onChange(checked ? "midPrice" : "marketPrice")
              }
              aria-label="Cambiar entre Market Price y Listed Median"
            />
            <span
              className={cn(
                "hidden sm:inline",
                isMedian && "font-semibold text-slate-900"
              )}
            >
              Median
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          Cambiar todos los precios visibles entre Market Price y Listed Median
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
