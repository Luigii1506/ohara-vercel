"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DropdownSearchProps {
  search: string;
  setSearch: (value: string) => void;
  placeholder?: string;
  isInputClear?: boolean;
  setIsInputClear?: (value: boolean) => void;
}

export default function DropdownSearch({
  search,
  setSearch,
  placeholder = "Search from card list",
  isInputClear,
  setIsInputClear,
}: DropdownSearchProps) {
  // Estado local para el input, que se actualizará en cada tecla.
  const [inputValue, setInputValue] = React.useState(search);

  // Función que ejecuta la búsqueda
  const handleSearch = React.useCallback(() => {
    setIsInputClear && setIsInputClear(false);
    setSearch(inputValue);
  }, [inputValue, setSearch, setIsInputClear]);

  // Función para limpiar el input
  const handleClear = React.useCallback(() => {
    setInputValue("");
    setSearch("");
  }, [setSearch]);

  // Manejar Enter para ejecutar búsqueda
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
  );

  React.useEffect(() => {
    if (isInputClear) {
      setInputValue("");
    }
  }, [isInputClear]);

  React.useEffect(() => {
    if (search !== inputValue) {
      setInputValue(search);
    }
  }, [search]);

  return (
    <div className="flex w-full max-w-4xl rounded-lg bg-white border border-gray-200 shadow-sm">
      <div className="relative flex-1 flex items-center gap-2 p-1">
        <div className="relative flex-1">
          <Input
            className="h-10 border-0 pl-4 pr-10 w-full focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder={placeholder}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {inputValue && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={handleClear}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md hover:bg-gray-100 transition-colors"
              title="Limpiar búsqueda"
            >
              <X className="h-4 w-4 text-gray-500" />
              <span className="sr-only">Limpiar búsqueda</span>
            </Button>
          )}
        </div>
        <Button
          type="button"
          onClick={handleSearch}
          className="h-10 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          title="Buscar"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Buscar</span>
        </Button>
      </div>
    </div>
  );
}
