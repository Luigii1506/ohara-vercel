"use client";

import type * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";
import clsx from "clsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FABProps {
  onClick?: () => void;
  size?: "small" | "medium" | "large";
}

const sizeClasses = {
  small: "w-8 h-8",
  medium: "w-12 h-12",
  large: "w-16 h-16",
};

const FAB: React.FC<FABProps> = ({ onClick, size = "medium" }) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className={clsx(
              "fixed bottom-6 right-6 rounded-full bg-black hover:bg-gray-800 shadow-lg flex items-center justify-center [&_svg]:size-7 z-[50]",
              sizeClasses[size]
            )}
            onClick={handleClick}
            aria-label="Scroll to top"
          >
            <ArrowUp size={24} className="text-white opacity-1 z-50" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Go back to Top</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default FAB;
