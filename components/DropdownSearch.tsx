"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  onSearchInputChange?: (value: string) => void;
}

export type DropdownSearchHandle = {
  focus: () => void;
  clear: () => void;
  hasText: () => boolean;
  isFocused: () => boolean;
  isVisible: () => boolean;
};

const DropdownSearch = React.forwardRef<DropdownSearchHandle, DropdownSearchProps>(
  function DropdownSearch(
    {
      search,
      setSearch,
      placeholder = "Search from card list",
      isInputClear,
      setIsInputClear,
      suggestionsEndpoint,
      onSuggestionSelect,
      onSearchInputChange,
    }: DropdownSearchProps,
    ref
  ) {
  const [inputValue, setInputValue] = React.useState(search);
  const [suggestions, setSuggestions] = React.useState<SearchSuggestion[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);
  const [portalReady, setPortalReady] = React.useState(false);
  const [floatingStyle, setFloatingStyle] = React.useState<React.CSSProperties>({
    top: 0,
    left: 0,
    minWidth: 0,
    maxWidth: 0,
  });
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const requestIdRef = React.useRef(0);
  // Selecting a suggestion sets inputValue to that suggestion's own text,
  // which still matches itself (and near-duplicates like "X Pre-Release") in
  // the suggestions endpoint — the normal fetch effect would reopen the
  // dropdown right after closing it. This flag suppresses auto-reopen until
  // the user actually types again (onChange clears it).
  const skipAutoOpenRef = React.useRef(false);

  const applySearch = React.useCallback(
    (value: string) => {
      setIsInputClear && setIsInputClear(false);
      setSearch(value);
    },
    [setSearch, setIsInputClear]
  );

  const handleSearch = React.useCallback(() => {
    skipAutoOpenRef.current = true;
    applySearch(inputValue);
    setIsSuggestionsOpen(false);
  }, [applySearch, inputValue]);

  const handleSuggestionSelect = React.useCallback(
    (suggestion: SearchSuggestion) => {
      skipAutoOpenRef.current = true;
      setInputValue(suggestion.value);
      applySearch(suggestion.value);
      onSuggestionSelect?.(suggestion);
      setSuggestions([]);
      setHighlightedIndex(-1);
      setIsSuggestionsOpen(false);
      inputRef.current?.focus();
    },
    [applySearch, onSuggestionSelect]
  );

  const handleClear = React.useCallback(() => {
    requestIdRef.current += 1;
    skipAutoOpenRef.current = true;
    setInputValue("");
    setSearch("");
    onSearchInputChange?.("");
    setSuggestions([]);
    setHighlightedIndex(-1);
    setIsSuggestionsOpen(false);
  }, [onSearchInputChange, setSearch]);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      clear: () => {
        handleClear();
      },
      hasText: () => inputValue.trim().length > 0,
      isFocused: () => document.activeElement === inputRef.current,
      isVisible: () => {
        const element = inputRef.current;
        if (!element) return false;
        return element.offsetParent !== null;
      },
    }),
    [handleClear, inputValue]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        if (!suggestions.length) return;
        e.preventDefault();
        skipAutoOpenRef.current = false;
        setIsSuggestionsOpen(true);
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (e.key === "ArrowUp") {
        if (!suggestions.length) return;
        e.preventDefault();
        skipAutoOpenRef.current = false;
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
        skipAutoOpenRef.current = true;
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
    setPortalReady(true);
  }, []);

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
        // Desktop and mobile both render a DropdownSearch sharing the same
        // `search` state; only one is visible at a time via CSS, but both
        // stay mounted and both run this fetch when `search` changes. Only
        // open the dropdown in the instance the user is actually focused
        // on — otherwise the hidden twin pops its portal open too. Also
        // respect skipAutoOpenRef so selecting/clearing/searching doesn't
        // get reopened by this same fetch resolving with matches for the
        // text it just set (see skipAutoOpenRef comment above).
        setIsSuggestionsOpen(
          !skipAutoOpenRef.current &&
            nextSuggestions.length > 0 &&
            document.activeElement === inputRef.current
        );
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

  const updateFloatingPosition = React.useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const viewportPadding = 16;
    const preferredWidth = Math.max(rect.width, 420);
    const maxWidth = Math.max(
      rect.width,
      window.innerWidth - viewportPadding * 2
    );
    const nextWidth = Math.min(preferredWidth, maxWidth);
    const maxLeft = window.innerWidth - viewportPadding - nextWidth;
    const nextLeft = Math.min(
      Math.max(rect.left, viewportPadding),
      Math.max(viewportPadding, maxLeft)
    );

    setFloatingStyle({
      top: rect.bottom + 8,
      left: nextLeft,
      minWidth: rect.width,
      maxWidth: maxWidth,
      width: nextWidth,
    });
  }, []);

  React.useEffect(() => {
    if (!isSuggestionsOpen && !(isLoadingSuggestions && inputValue.trim().length >= 2)) {
      return;
    }

    updateFloatingPosition();

    const handleViewportChange = () => updateFloatingPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [
    inputValue,
    isLoadingSuggestions,
    isSuggestionsOpen,
    updateFloatingPosition,
  ]);

  const suggestionsDropdown =
    suggestionsEndpoint && isSuggestionsOpen && suggestions.length > 0 ? (
      <div
        className="fixed z-[100000] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        style={floatingStyle}
      >
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
                  isActive
                    ? "bg-blue-50 text-slate-900"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-medium leading-5 whitespace-normal break-words">
                  {suggestion.label ?? suggestion.value}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  const loadingDropdown =
    suggestionsEndpoint &&
    isLoadingSuggestions &&
    inputValue.trim().length >= 2 &&
    suggestions.length === 0 ? (
      <div
        className="fixed z-[100000] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg"
        style={floatingStyle}
      >
        Searching set names...
      </div>
    ) : null;

  return (
    <div className="flex w-full max-w-4xl rounded-lg bg-white border border-gray-200 shadow-sm">
      <div className="relative flex-1 flex items-center gap-2 p-1">
        <div ref={wrapperRef} className="relative flex-1">
          <Input
            ref={inputRef}
            className="h-10 border-0 pl-4 pr-10 w-full focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder={placeholder}
            type="text"
            value={inputValue}
            onChange={(e) => {
              const nextValue = e.target.value;
              skipAutoOpenRef.current = false;
              setInputValue(nextValue);
              onSearchInputChange?.(nextValue);
              setHighlightedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (skipAutoOpenRef.current) return;
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
      {portalReady && typeof document !== "undefined"
        ? createPortal(
            <>
              {suggestionsDropdown}
              {loadingDropdown}
            </>,
            document.body
          )
        : null}
    </div>
  );
}
);

export default DropdownSearch;
