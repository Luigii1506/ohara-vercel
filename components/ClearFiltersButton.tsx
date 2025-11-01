import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ClearFiltersButtonProps {
  clearFilters: () => void;
  isTouchable: boolean;
  isMobile?: boolean;
}

export default function ClearFiltersButton({
  clearFilters,
  isTouchable,
  isMobile,
}: ClearFiltersButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className={`gap-2 transition-all 

              ${isMobile && "h-[40px]"}
              
              ${
                isTouchable
                  ? "cursor-pointer border-[#ef4444] opacity-1 hover:bg-destructive hover:text-destructive-foreground bg-[#ef4444] text-white"
                  : "cursor-not-allowed opacity-[0.5]"
              }
              `}
            onClick={() => {
              clearFilters();
            }}
          >
            <FilterX className="h-4 w-4" />
            {!isMobile && <span>Clear filters</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Remove all active filters</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
