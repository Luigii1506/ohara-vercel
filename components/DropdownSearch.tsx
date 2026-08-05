"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchSuggestion = {
  id: number | string;
  value: string;
  label?: string;
};

interface DropdownSearchProps {
  search: string;
  setSearch: (value: string) => void;
  placeholder?: string;
  isInputClear?: boolean;
  setIsInputClear?: (value: boolean) => void;
  suggestionsEndpoint?: string;
}

export default function DropdownSearch({
  search,
  setSearch,
  placeholder = "Search from card list",
  isInputClear,
  setIsInputClear,
  suggestionsEndpoint,
}: DropdownSearchProps) {
  const [inputValue, setInputValue] = React.useState(search);
  const [suggestions, setSuggestions] = React.useState<SearchSuggestion[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const requestIdRef = React.useRef(0);

  const applySearch = React.useCallback(
    (value: string) => {
      setIsInputClear && setIsInputClear(false);
      setSearch(value);
    },
    [setSearch, setIsInputClear]
  );

  const handleSearch = React.useCallback(() => {
    applySearch(inputValue);
    setIsSuggestionsOpen(false);
  }, [applySearch, inputValue]);

  const handleSuggestionSelect = React.useCallback(
    (suggestion: SearchSuggestion) => {
      setInputValue(suggestion.value);
      applySearch(suggestion.value);
      setSuggestions([]);
      setHighlightedIndex(-1);
      setIsSuggestionsOpen(false);
      inputRef.current?.focus();
    },
    [applySearch]
  );

  const handleClear = React.useCallback(() => {
    requestIdRef.current += 1;
    setInputValue("");
    setSearch("");
    setSuggestions([]);
    setHighlightedIndex(-1);
    setIsSuggestionsOpen(false);
  }, [setSearch]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        if (!suggestions.length) return;
        e.preventDefault();
        setIsSuggestionsOpen(true);
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (e.key === "ArrowUp") {
        if (!suggestions.length) return;
        e.preventDefault();
        setIsSuggestionsOpen(true);
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (isSuggestionsOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          handleSuggestionSelect(suggestions[highlightedIndex]);
          return;
        }
        handleSearch();
        return;
      }

      if (e.key === "Escape") {
        setIsSuggestionsOpen(false);
        setHighlightedIndex(-1);
      }
    },
    [
      handleSearch,
      handleSuggestionSelect,
      highlightedIndex,
      isSuggestionsOpen,
      suggestions,
    ]
  );

  React.useEffect(() => {
    if (isInputClear) {
      setInputValue("");
    }
  }, [isInputClear]);

  React.useEffect(() => {
    setInputValue(search);
  }, [search]);

  React.useEffect(() => {
    if (!suggestionsEndpoint) return;

    const query = inputValue.trim();
    if (query.length < 2) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setHighlightedIndex(-1);
      setIsSuggestionsOpen(false);
      setIsLoadingSuggestions(false);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsLoadingSuggestions(true);

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `${suggestionsEndpoint}?query=${encodeURIComponent(query)}&limit=8`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch suggestions");
        }

        const data = await response.json();
        if (requestIdRef.current !== currentRequestId) return;

        const nextSuggestions = Array.isArray(data?.suggestions)
          ? data.suggestions
          : [];

        setSuggestions(nextSuggestions);
        setHighlightedIndex(-1);
        setIsSuggestionsOpen(nextSuggestions.length > 0);
      } catch (error) {
        if (requestIdRef.current !== currentRequestId) return;
        console.error("Autocomplete suggestion error:", error);
        setSuggestions([]);
        setHighlightedIndex(-1);
        setIsSuggestionsOpen(false);
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [inputValue, suggestionsEndpoint]);

  return (
    <div className="flex w-full max-w-4xl rounded-lg bg-white border border-gray-200 shadow-sm">
      <div className="relative flex-1 flex items-center gap-2 p-1">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            className="h-10 border-0 pl-4 pr-10 w-full focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder={placeholder}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setHighlightedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) {
                setIsSuggestionsOpen(true);
              }
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setIsSuggestionsOpen(false);
              }, 120);
            }}
            autoComplete="off"
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

          {suggestionsEndpoint && isSuggestionsOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Set Names
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {suggestions.map((suggestion, index) => {
                  const isActive = index === highlightedIndex;
                  return (
                    <button
                      key={suggestion.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleSuggestionSelect(suggestion);
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                        isActive ? "bg-blue-50 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="min-w-0 truncate text-sm font-medium">
                        {suggestion.label ?? suggestion.value}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {suggestionsEndpoint &&
            isLoadingSuggestions &&
            inputValue.trim().length >= 2 &&
            suggestions.length === 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[120] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
                Searching set names...
              </div>
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
