"use client";

import { cn } from "@/lib/utils";
import AllIcon from "@/components/Icons/AllIcon";
import SquareAltIcon from "@/components/Icons/SquareAltIcon";
import DefaultViewIcon from "@/components/Icons/DefaultViewIcon";
import TextIcon from "@/components/Icons/TextIcon";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ViewSwitcherProps {
  viewSelected: "grid" | "list" | "alternate" | "text";
  setViewSelected: (view: "grid" | "list" | "alternate" | "text") => void;
  isAlternate?: boolean;
  isText?: boolean;
}

export default function ViewSwitcher({
  viewSelected,
  setViewSelected,
  isAlternate = true,
  isText = true,
}: ViewSwitcherProps) {
  return (
    <div className="inline-flex rounded-lg border p-1 bg-white [&>button+button]:ml-1 h-[42px]">
      {isText && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  setViewSelected("text");
                }}
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
                <span className="sr-only">List view</span>
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
                onClick={() => {
                  setViewSelected("alternate");
                }}
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
              onClick={() => {
                setViewSelected("list");
              }}
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
              <span className="sr-only">List view</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Images View</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
