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

export interface Option {
  value: string;
  label: string;
  count?: number; // Opcional, en caso de que quieras mostrar un contador
}

interface SingleSelectProps {
  /** Lista de opciones disponibles */
  options: Option[];
  /** Valor seleccionado actualmente. Null/undefined si no hay nada seleccionado */
  selected: string | null;
  /** Función para actualizar el valor seleccionado */
  setSelected: (selected: string) => void;
  /** Texto a mostrar en el botón cuando no hay nada seleccionado */
  buttonLabel?: string;
  /** Placeholder del buscador */
  searchPlaceholder?: string;
  /** Función opcional para personalizar la forma en que se muestra la selección */
  displaySelectedAs?: (selected: string) => string;
  /** Mostrar un círculo (o cuadrado) de color si la opción es un color */
  isColor?: boolean;
  /** Si se puede buscar en la lista de opciones */
  isSearchable?: boolean;
  isSolid?: boolean;
  isFullWidth?: boolean;
  isDisabled?: boolean;
}

export default function SingleSelect({
  options,
  selected,
  setSelected,
  buttonLabel = "Select",
  searchPlaceholder = "Search...",
  displaySelectedAs,
  isColor = false,
  isSearchable = false,
  isSolid = false,
  isFullWidth = false,
  isDisabled = false,
}: SingleSelectProps): JSX.Element {
  const [open, setOpen] = React.useState<boolean>(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Auto focus en el input de búsqueda cuando se abre el dropdown
  React.useEffect(() => {
    if (open && isSearchable && searchInputRef.current) {
      // Pequeño delay para asegurar que el input esté completamente renderizado
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [open, isSearchable]);

  // Click fuera para cerrar dropdown (solo en modo solid)
  React.useEffect(() => {
    if (!open || !isSolid) return;

    const handleClickOutside = (event: MouseEvent) => {
      // No cerrar si el click es en el botón o en el dropdown
      if (
        buttonRef.current?.contains(event.target as Node) ||
        dropdownRef.current?.contains(event.target as Node)
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, isSolid]);

  // 🔥 ESC key handler - Priority capture over modal
  React.useEffect(() => {
    if (open) {
      // Mark that a SingleSelect is open globally
      document.documentElement.setAttribute("data-singleselect-open", "true");
    } else {
      // Remove the marker when closed
      document.documentElement.removeAttribute("data-singleselect-open");
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
        document.documentElement.removeAttribute("data-singleselect-open");
      }
    };

    // Add event listener with capture=true for higher priority
    document.addEventListener("keydown", handleEscapeKey, true);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey, true);
      // Cleanup marker on unmount
      document.documentElement.removeAttribute("data-singleselect-open");
    };
  }, [open]);

  // Función para mostrar el texto en el botón según el valor seleccionado
  const renderSelected =
    displaySelectedAs?.(selected ?? "") ?? (selected ? selected : buttonLabel);

  if (isSolid) {
    return (
      <div className="w-full">
        <Button
          ref={buttonRef}
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            if (isDisabled) return;
            setOpen(!open);
          }}
          disabled={isDisabled}
          className={`group w-full justify-between bg-white hover:bg-gray-100 h-[50px] ${
            selected
              ? "border-[#2463eb] hover:bg-[#2463eb] text-[#2463eb] hover:text-white"
              : ""
          }`}
        >
          <div className="flex gap-2 items-center">
            {selected && (
              <span
                onClick={(e) => {
                  e.stopPropagation(); // Evita que se active el toggle
                  setSelected("");
                }}
                className="cursor-pointer group-hover:block"
              >
                <X
                  size={20}
                  className="text-[#2463eb] group-hover:text-white"
                />
              </span>
            )}
            <span className="font-bold">
              {renderSelected.charAt(0).toUpperCase() + renderSelected.slice(1)}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {open && !isDisabled && (
          <div ref={dropdownRef} className="mt-2">
            <Command>
              {isSearchable && (
                <div className="flex items-center border-b px-3">
                  <CommandInput
                    ref={searchInputRef}
                    placeholder={searchPlaceholder}
                    className="flex h-14 w-full rounded-md bg-transparent py-3 text-lg outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              )}
              <CommandList>
                <CommandEmpty>No se encontró ningún resultado.</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-auto p-2">
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      onSelect={() => {
                        // Si la opción ya está seleccionada, se deselecciona
                        if (selected === option.value) {
                          setSelected("");
                        } else {
                          setSelected(option.value);
                        }
                        // Se cierra el acordeón tras la selección/deselección
                        setOpen(false);
                      }}
                      className="flex items-center gap-4 px-2 py-3 cursor-pointer hover:bg-muted/50 rounded-xl"
                    >
                      <Checkbox
                        checked={selected === option.value}
                        className="h-5 w-5"
                      />
                      {isColor ? (
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            style={{ backgroundColor: option.value }}
                            className="w-4 h-4 rounded-full"
                          />
                          <p className="text-[13px]">{option.label}</p>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <p className="text-[13px]">{option.label}</p>
                        </div>
                      )}
                      {option.count !== undefined && (
                        <span className="text-muted-foreground">
                          ({option.count})
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="">
      <Popover
        open={open}
        onOpenChange={(open) => {
          if (!isDisabled) setOpen(open);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={isDisabled}
            className={`group ${
              isFullWidth ? "w-full" : "w-max"
            } justify-between bg-white hover:bg-gray-100 h-full ${
              selected
                ? "border-[#2463eb] hover:bg-[#2463eb] text-[#2463eb] hover:text-white"
                : ""
            }`}
          >
            <div className="flex gap-2 items-center">
              {selected && (
                <span
                  onClick={(e) => {
                    e.stopPropagation(); // Evita que se abra el popover
                    setSelected("");
                  }}
                  className="cursor-pointer group-hover:block"
                >
                  <X
                    size={20}
                    className="text-[#2463eb] group-hover:text-white"
                  />
                </span>
              )}
              <span className="font-bold">
                {renderSelected.charAt(0).toUpperCase() +
                  renderSelected.slice(1)}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-max p-0" align="start">
          <Command>
            {isSearchable && (
              <div className="flex items-center border-b px-3">
                <CommandInput
                  ref={searchInputRef}
                  placeholder={searchPlaceholder}
                  className="flex h-14 w-full rounded-md bg-transparent py-3 text-lg outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            )}
            <CommandList>
              <CommandEmpty>No se encontró ningún resultado.</CommandEmpty>
              <CommandGroup className="max-h-[300px] overflow-auto p-2">
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (selected === option.value) {
                        setSelected("");
                      } else {
                        setSelected(option.value);
                      }
                      setOpen(false);
                    }}
                    className="flex items-center gap-4 px-2 py-3 cursor-pointer hover:bg-muted/50 rounded-xl"
                  >
                    <Checkbox
                      checked={selected === option.value}
                      className="h-5 w-5"
                    />
                    {isColor ? (
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          style={{ backgroundColor: option.value }}
                          className="w-4 h-4 rounded-full"
                        />
                        <p className="text-base">{option.label}</p>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="text-base">{option.label}</p>
                      </div>
                    )}
                    {option.count !== undefined && (
                      <span className="text-muted-foreground">
                        ({option.count})
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
