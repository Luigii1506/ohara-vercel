"use client";

import * as React from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getColors } from "@/helpers/functions";
import RayoIcon from "./Icons/RayoIcon";
import SlashIcon from "./Icons/SlashIcon";
import SpecialIcon from "./Icons/SpecialIcon";
import RangedIcons from "./Icons/RangedIcons";
import WisdomIcons from "./Icons/WisdomIcons";
import StrikeIcon from "./Icons/StrikeIcon";

export interface Option {
  value: string;
  label: string;
  count?: number;
  // También podrías incluir una propiedad 'disabled' en cada opción si lo prefieres:
  // disabled?: boolean;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  setSelected: (selected: string[]) => void;
  buttonLabel?: string;
  searchPlaceholder?: string;
  displaySelectedAs?: (selected: string[]) => string;
  isColor?: boolean;
  isSearchable?: boolean;
  isSolid?: boolean;
  // Nuevo prop para indicar qué opciones están deshabilitadas
  disabledOptions?: string[];
  isFullWidth?: boolean;
  isDisabled?: boolean;
}

export default function MultiSelect({
  options,
  selected,
  setSelected,
  buttonLabel = "Select",
  searchPlaceholder = "Search...",
  displaySelectedAs,
  isColor = false,
  isSearchable = false,
  isSolid = false,
  disabledOptions = [],
  isFullWidth = false,
  isDisabled = false,
}: MultiSelectProps): JSX.Element {
  const [open, setOpen] = React.useState<boolean>(false);
  const [searchValue, setSearchValue] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Auto focus en el input de búsqueda cuando se abre el dropdown
  React.useEffect(() => {
    if (open && isSearchable && searchInputRef.current) {
      // Pequeño delay para asegurar que el input esté completamente renderizado
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);

      return () => clearTimeout(timer);
    }

    // Limpiar búsqueda cuando se cierra el dropdown
    if (!open && searchValue) {
      setSearchValue("");
    }
  }, [open, isSearchable, searchValue]);

  // Click fuera para cerrar dropdown (solo en modo solid)
  React.useEffect(() => {
    if (!open || !isSolid) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, isSolid]);

  // 🔥 ESC key handler - Priority capture over modal
  React.useEffect(() => {
    if (open) {
      // Mark that a MultiSelect is open globally
      document.documentElement.setAttribute("data-multiselect-open", "true");
    } else {
      // Remove the marker when closed
      document.documentElement.removeAttribute("data-multiselect-open");
    }

    if (!open) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // 🚨 CRITICAL: Stop event bubbling to prevent modal from closing
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Close the select first
        setOpen(false);

        // Remove global marker immediately
        document.documentElement.removeAttribute("data-multiselect-open");
      }
    };

    // Add event listener with capture=true for higher priority
    document.addEventListener("keydown", handleEscapeKey, true);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey, true);
      // Cleanup marker on unmount
      document.documentElement.removeAttribute("data-multiselect-open");
    };
  }, [open]);

  const renderSelected =
    displaySelectedAs?.(selected) ??
    (selected?.length > 0 ? selected.join(", ") : buttonLabel);

  const getEffectsStyles = (value: string) => {
    if (
      value === "Blocker" ||
      value === "Rush" ||
      value === "Banish" ||
      value === "Double Attack"
    ) {
      return {
        alignItems: "center",
        color: "white",
        fontWeight: "500",
        fontSize: "12px",
        backgroundColor: "#e57223",
        padding: "0px 8px",
        display: "inline-block",
        textAlign: "center",
        clipPath:
          "polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)",
        width: "fit-content",
      };
    } else if (
      value === "Your Turn" ||
      value === "Activate: Main" ||
      value === "On Play" ||
      value === "When Attacking" ||
      value === "Opponent's Turn" ||
      value === "Main" ||
      value === "On K.O." ||
      value === "End of Your Turn" ||
      value === "On Block" ||
      value === "On Your Opponent's Attack"
    ) {
      return {
        alignItems: "center",
        color: "white",
        fontWeight: "500",
        fontSize: "12px",
        backgroundColor: "#047699",
        display: "inline-block",
        textAlign: "center",
        width: "fit-content",
        paddingLeft: "6px",
        paddingRight: "6px",
        borderRadius: "0.25rem",
      };
    } else if (value === "DON!! x1" || value === "DON!! x2") {
      return {
        alignItems: "center",
        color: "white",
        fontWeight: "500",
        fontSize: "12px",
        backgroundColor: "#000000",
        display: "inline-block",
        textAlign: "center",
        width: "fit-content",
        clipPath:
          "polygon(10% 0%, 90% 0%, 100% 20%, 100% 80%, 90% 100%, 10% 100%, 0% 80%, 0% 20%)",
        paddingLeft: "5px",
        paddingRight: "5px",
      };
    } else if (value === "Once Per Turn") {
      return {
        alignItems: "center",
        color: "white",
        fontWeight: "500",
        fontSize: "12px",
        backgroundColor: "#ed4469",
        display: "inline-block",
        textAlign: "center",
        width: "fit-content",
        paddingLeft: "6px",
        paddingRight: "6px",
        borderRadius: "0.75rem",
      };
    } else if (value === "Counter") {
      return {
        alignItems: "center",
        color: "white",
        fontWeight: "500",
        fontSize: "12px",
        backgroundColor: "#c20819",
        display: "flex",
        textAlign: "center",
        width: "fit-content",
        paddingLeft: "1px",
        paddingRight: "6px",
        borderRadius: "0.25rem",
      };
    } else if (
      value === "Slash" ||
      value === "Strike" ||
      value === "Wisdom" ||
      value === "Special" ||
      value === "Ranged" ||
      value === "Slash/Special" ||
      value === "Strike/Ranged" ||
      value === "Slash/Strike"
    ) {
      return {
        display: "flex",
        alignItems: "center",
        gap: "3px",
      };
    } else if (value === "Trigger") {
      return {
        backgroundColor: "#fee849",
        clipPath: "polygon(0 0, 100% 0%, 80% 100%, 0% 100%)",
        paddingLeft: "4px",
        paddingRight: "10px",
        paddingBottom: "2.5px",
        color: "#000000",
        fontWeight: "800",
        width: "fit-content",
      };
    } else {
      return {};
    }
  };

  // Filtrar opciones basado en búsqueda personalizada
  const filteredOptions = React.useMemo(() => {
    if (!searchValue.trim()) return options;

    const searchLower = searchValue.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchLower) ||
        (option.value &&
          typeof option.value === "string" &&
          option.value.toLowerCase().includes(searchLower))
    );
  }, [options, searchValue]);

  const content = (
    <Command shouldFilter={false}>
      {isSearchable && (
        <div
          className={`flex items-center ${
            isSolid ? "border mt-2 rounded-lg mb-1" : "border-b px-3"
          }`}
        >
          <CommandInput
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            disabled={isDisabled}
            value={searchValue}
            onValueChange={setSearchValue}
            className={`flex ${
              isSolid ? "h-10 text-sm" : "h-14 text-lg"
            } w-full rounded-md bg-transparent py-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50`}
          />
        </div>
      )}

      {/* 🏷️ Píldoras de elementos seleccionados */}
      {selected.length > 0 && (
        <div
          className={`${
            isSolid ? "px-3 py-2" : "px-4 py-3"
          } border-b bg-gray-50`}
        >
          <div className="text-xs text-gray-600 mb-2 font-medium">
            Seleccionados ({selected.length}):
          </div>
          <div className="flex flex-wrap gap-1">
            {selected.map((selectedValue) => {
              const option = options.find((opt) => opt.value === selectedValue);
              return (
                <Badge
                  key={selectedValue}
                  variant="secondary"
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer flex items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDisabled) {
                      const newSelected = selected.filter(
                        (item) => item !== selectedValue
                      );
                      setSelected(newSelected);
                    }
                  }}
                >
                  <span className="truncate max-w-[120px]">
                    {option?.label || selectedValue}
                  </span>
                  <X className="h-3 w-3 hover:text-blue-600" />
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <CommandList>
        <CommandEmpty>No se encontró ningún resultado.</CommandEmpty>
        <CommandGroup className="max-h-[300px] overflow-auto p-2">
          {filteredOptions?.map((option: Option) => {
            // Verifica si la opción está deshabilitada
            const isOptionDisabled = disabledOptions.includes(option.value);

            return (
              <CommandItem
                key={option.value}
                onSelect={() => {
                  // Si está deshabilitada o el multiselect está deshabilitado, no hace nada
                  if (isOptionDisabled || isDisabled) return;

                  const newSelected = selected.includes(option.value)
                    ? selected.filter((item) => item !== option.value)
                    : [...selected, option.value];

                  setSelected(newSelected);
                }}
                className={`flex items-center gap-4 px-2 py-3 rounded-xl ${
                  isOptionDisabled
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={selected.includes(option.value)}
                  className="h-5 w-5"
                  disabled={isOptionDisabled || isDisabled}
                />

                {isColor ? (
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      style={{ backgroundColor: getColors(option.value) }}
                      className="w-4 h-4 rounded-full"
                    />
                    <p className="text-base">{option.label}</p>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div
                      style={
                        getEffectsStyles(option.value) as React.CSSProperties
                      }
                    >
                      {option.label === "Counter" && (
                        <RayoIcon color="#f2e847" size="20" />
                      )}
                      {option.label === "Special" && (
                        <SpecialIcon size="20" color="#b63d88" />
                      )}
                      {option.label === "Ranged" && (
                        <RangedIcons size="20" color="#d43f42" />
                      )}
                      {option.label === "Wisdom" && (
                        <WisdomIcons size="20" color="#05a576" />
                      )}
                      {option.label === "Slash" && (
                        <SlashIcon size="20" color="#0080a5" />
                      )}
                      {option.label === "Strike" && (
                        <StrikeIcon size="20" color="#deaa08" />
                      )}
                      <span
                        className={`${isSolid ? "text-[13px]" : "text-base"}`}
                      >
                        {option.label}
                      </span>
                    </div>
                  </div>
                )}

                {option.count !== undefined && (
                  <span className="text-muted-foreground">
                    ({option.count})
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  if (isSolid) {
    return (
      <div className="w-full">
        <Button
          variant="outline"
          onClick={() => setOpen(!open)}
          disabled={isDisabled}
          className={`group w-full justify-between bg-white hover:bg-gray-100 h-[50px] ${
            selected?.length > 0 &&
            "border-[#2463eb] hover:bg-[#2463eb] text-[#2463eb] hover:text-white"
          }`}
        >
          <div className="flex gap-2 items-center">
            {selected.length > 0 && !isDisabled && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected([]);
                }}
                className="cursor-pointer group-hover:block"
              >
                <X
                  size={20}
                  className="text-[#2463eb] group-hover:text-white"
                />
              </span>
            )}

            <span className="font-bold truncate overflow-hidden whitespace-nowrap w-full">
              {renderSelected.charAt(0).toUpperCase() + renderSelected.slice(1)}
            </span>
            {selected?.length > 1 && (
              <Badge className="ml-2 bg-[#2463eb] text-white">
                {selected?.length}
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {open && (
          <div ref={dropdownRef} className="mt-2 relative z-[10000]">
            {content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={isDisabled}
            className={`group ${
              isFullWidth ? "w-full" : "w-max"
            } justify-between bg-white hover:bg-gray-100 h-full ${
              selected?.length > 0 &&
              "border-[#2463eb] hover:bg-[#2463eb] text-[#2463eb] hover:text-white"
            }`}
          >
            <div className="flex gap-2 items-center w-full">
              {selected.length > 0 && !isDisabled && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected([]);
                  }}
                  className="cursor-pointer group-hover:block"
                >
                  <X
                    size={20}
                    className="text-[#2463eb] group-hover:text-white"
                  />
                </span>
              )}

              {/* Aplicamos restricciones de ancho al texto */}
              <span className="font-bold truncate overflow-hidden whitespace-nowrap flex-1">
                {renderSelected.charAt(0).toUpperCase() +
                  renderSelected.slice(1)}
              </span>

              {selected?.length > 1 && (
                <Badge className="bg-[#2463eb] text-white group-hover:bg-white group-hover:text-[#2463eb]">
                  {selected?.length}
                </Badge>
              )}
            </div>

            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-max p-0 z-[10000]"
          align="start"
          sideOffset={5}
          style={{ zIndex: 10000, pointerEvents: "auto" }}
        >
          {content}
        </PopoverContent>
      </Popover>
    </div>
  );
}
