"use client";

import { cn } from "@/lib/utils";
import { LayoutGrid, List, Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ListsViewSwitcherProps {
  viewSelected: "grid" | "list" | "detailed";
  setViewSelected: (view: "grid" | "list" | "detailed") => void;
}

export default function ListsViewSwitcher({
  viewSelected,
  setViewSelected,
}: ListsViewSwitcherProps) {
  return (
    <div className="inline-flex rounded-lg border p-1 bg-white [&>button+button]:ml-1 h-[42px]">
      {/* Grid View */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setViewSelected("grid")}
              className={cn(
                "inline-flex items-center justify-center rounded-md p-2.5 text-sm font-medium transition-all",
                viewSelected === "grid"
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-100 text-gray-500"
              )}
            >
              <LayoutGrid className="w-5 h-5" />
              <span className="sr-only">Vista de cuadrícula</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Vista Cuadrícula</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* List View */}
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
              <List className="w-5 h-5" />
              <span className="sr-only">Vista de lista</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Vista Lista</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Detailed View */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setViewSelected("detailed")}
              className={cn(
                "inline-flex items-center justify-center rounded-md p-2.5 text-sm font-medium transition-all",
                viewSelected === "detailed"
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-100 text-gray-500"
              )}
            >
              <Info className="w-5 h-5" />
              <span className="sr-only">Vista detallada</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Vista Detallada</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
