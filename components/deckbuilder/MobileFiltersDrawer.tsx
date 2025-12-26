"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  FilterX,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getColors } from "@/helpers/functions";
import BaseDrawer from "@/components/ui/BaseDrawer";
import {
  rarityOptions,
  typesOptions,
  categoryOptions,
  effectsOptions,
  counterOptions,
  triggerOptions,
  colorOptions,
  setOptions,
  costOptions,
  powerOptions,
  atributeOptions,
  altArtOptions,
  setCodesOptions,
} from "@/helpers/constants";

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterConfig {
  id: string;
  label: string;
  options: FilterOption[];
  isMulti: boolean;
  isColor?: boolean;
  isSearchable?: boolean;
}

interface MobileFiltersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedColors: string[];
  setSelectedColors: (colors: string[]) => void;
  selectedRarities: string[];
  setSelectedRarities: (rarities: string[]) => void;
  selectedCategories: string[];
  setSelectedCategories: (categories: string[]) => void;
  selectedCounter: string;
  setSelectedCounter: (value: string) => void;
  selectedTrigger: string;
  setSelectedTrigger: (value: string) => void;
  selectedEffects: string[];
  setSelectedEffects: (effects: string[]) => void;
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
  selectedSets: string[];
  setSelectedSets: (sets: string[]) => void;
  selectedCosts: string[];
  setSelectedCosts: (costs: string[]) => void;
  selectedPower: string[];
  setSelectedPower: (power: string[]) => void;
  selectedAttributes: string[];
  setSelectedAttributes: (attributes: string[]) => void;
  selectedAltArts: string[];
  setSelectedAltArts: (altArts: string[]) => void;
  selectedCodes: string[];
  setSelectedCodes: (codes: string[]) => void;
  disabledColors?: string[];
  disabledTypes?: string[];
}

const MobileFiltersDrawer: React.FC<MobileFiltersDrawerProps> = ({
  isOpen,
  onClose,
  selectedColors,
  setSelectedColors,
  selectedRarities,
  setSelectedRarities,
  selectedCategories,
  setSelectedCategories,
  selectedCounter,
  setSelectedCounter,
  selectedTrigger,
  setSelectedTrigger,
  selectedEffects,
  setSelectedEffects,
  selectedTypes,
  setSelectedTypes,
  selectedSets,
  setSelectedSets,
  selectedCosts,
  setSelectedCosts,
  selectedPower,
  setSelectedPower,
  selectedAttributes,
  setSelectedAttributes,
  selectedAltArts,
  setSelectedAltArts,
  selectedCodes,
  setSelectedCodes,
  disabledColors = [],
  disabledTypes = [],
}) => {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when entering a filter sub-view
  useEffect(() => {
    if (activeFilter && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeFilter]);

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      setActiveFilter(null);
      setSearchQuery("");
    }
  }, [isOpen]);

  // Reset search when going back
  useEffect(() => {
    if (!activeFilter) {
      setSearchQuery("");
    }
  }, [activeFilter]);

  // Filter configurations
  const filters: FilterConfig[] = [
    {
      id: "codes",
      label: "Codes",
      options: setCodesOptions,
      isMulti: true,
      isSearchable: true,
    },
    {
      id: "sets",
      label: "Sets",
      options: setOptions,
      isMulti: true,
      isSearchable: true,
    },

    {
      id: "altArts",
      label: "Alt Arts",
      options: altArtOptions,
      isMulti: true,
      isSearchable: true,
    },
    {
      id: "categories",
      label: "Type",
      options: categoryOptions,
      isMulti: true,
    },
    {
      id: "colors",
      label: "Color",
      options: colorOptions,
      isMulti: true,
      isColor: true,
    },
    { id: "rarity", label: "Rarity", options: rarityOptions, isMulti: true },

    { id: "costs", label: "Cost", options: costOptions, isMulti: true },
    {
      id: "power",
      label: "Power",
      options: powerOptions,
      isMulti: true,
      isSearchable: true,
    },
    {
      id: "effects",
      label: "Effects",
      options: effectsOptions,
      isMulti: true,
      isSearchable: true,
    },
    {
      id: "counter",
      label: "Counter",
      options: counterOptions,
      isMulti: false,
    },

    {
      id: "trigger",
      label: "Trigger",
      options: triggerOptions,
      isMulti: false,
    },

    {
      id: "types",
      label: "Family",
      options: typesOptions,
      isMulti: true,
      isSearchable: true,
    },
    {
      id: "attributes",
      label: "Attribute",
      options: atributeOptions,
      isMulti: true,
    },
  ];

  const getSelectedValues = (filterId: string): string[] => {
    switch (filterId) {
      case "colors":
        return selectedColors;
      case "rarity":
        return selectedRarities;
      case "categories":
        return selectedCategories;
      case "counter":
        return selectedCounter ? [selectedCounter] : [];
      case "trigger":
        return selectedTrigger ? [selectedTrigger] : [];
      case "effects":
        return selectedEffects;
      case "types":
        return selectedTypes;
      case "sets":
        return selectedSets;
      case "costs":
        return selectedCosts;
      case "power":
        return selectedPower;
      case "attributes":
        return selectedAttributes;
      case "altArts":
        return selectedAltArts;
      case "codes":
        return selectedCodes;
      default:
        return [];
    }
  };

  const toggleSelection = (
    filterId: string,
    value: string,
    isMulti: boolean
  ) => {
    const currentSelected = getSelectedValues(filterId);

    if (isMulti) {
      const newSelected = currentSelected.includes(value)
        ? currentSelected.filter((v) => v !== value)
        : [...currentSelected, value];

      switch (filterId) {
        case "colors":
          setSelectedColors(newSelected);
          break;
        case "rarity":
          setSelectedRarities(newSelected);
          break;
        case "categories":
          setSelectedCategories(newSelected);
          break;
        case "effects":
          setSelectedEffects(newSelected);
          break;
        case "types":
          setSelectedTypes(newSelected);
          break;
        case "sets":
          setSelectedSets(newSelected);
          break;
        case "costs":
          setSelectedCosts(newSelected);
          break;
        case "power":
          setSelectedPower(newSelected);
          break;
        case "attributes":
          setSelectedAttributes(newSelected);
          break;
        case "altArts":
          setSelectedAltArts(newSelected);
          break;
        case "codes":
          setSelectedCodes(newSelected);
          break;
      }
    } else {
      const newValue = currentSelected.includes(value) ? "" : value;
      switch (filterId) {
        case "counter":
          setSelectedCounter(newValue);
          break;
        case "trigger":
          setSelectedTrigger(newValue);
          break;
      }
    }
  };

  const clearFilter = (filterId: string) => {
    switch (filterId) {
      case "colors":
        setSelectedColors([]);
        break;
      case "rarity":
        setSelectedRarities([]);
        break;
      case "categories":
        setSelectedCategories([]);
        break;
      case "counter":
        setSelectedCounter("");
        break;
      case "trigger":
        setSelectedTrigger("");
        break;
      case "effects":
        setSelectedEffects([]);
        break;
      case "types":
        setSelectedTypes([]);
        break;
      case "sets":
        setSelectedSets([]);
        break;
      case "costs":
        setSelectedCosts([]);
        break;
      case "power":
        setSelectedPower([]);
        break;
      case "attributes":
        setSelectedAttributes([]);
        break;
      case "altArts":
        setSelectedAltArts([]);
        break;
      case "codes":
        setSelectedCodes([]);
        break;
    }
  };

  const getDisabledOptions = (filterId: string): string[] => {
    switch (filterId) {
      case "colors":
        return disabledColors;
      case "categories":
        return disabledTypes;
      default:
        return [];
    }
  };

  const clearAllFilters = () => {
    setSelectedColors([]);
    setSelectedRarities([]);
    setSelectedCategories([]);
    setSelectedCounter("");
    setSelectedTrigger("");
    setSelectedEffects([]);
    setSelectedTypes([]);
    setSelectedSets([]);
    setSelectedCosts([]);
    setSelectedPower([]);
    setSelectedAttributes([]);
    setSelectedAltArts([]);
    setSelectedCodes([]);
  };

  const hasActiveFilters =
    selectedColors.length > 0 ||
    selectedRarities.length > 0 ||
    selectedCategories.length > 0 ||
    selectedCounter !== "" ||
    selectedTrigger !== "" ||
    selectedEffects.length > 0 ||
    selectedTypes.length > 0 ||
    selectedSets.length > 0 ||
    selectedCosts.length > 0 ||
    selectedPower.length > 0 ||
    selectedAttributes.length > 0 ||
    selectedAltArts.length > 0 ||
    selectedCodes.length > 0;

  const totalActiveFilters =
    selectedColors.length +
    selectedRarities.length +
    selectedCategories.length +
    (selectedCounter ? 1 : 0) +
    (selectedTrigger ? 1 : 0) +
    selectedEffects.length +
    selectedTypes.length +
    selectedSets.length +
    selectedCosts.length +
    selectedPower.length +
    selectedAttributes.length +
    selectedAltArts.length +
    selectedCodes.length;

  const activeFilterConfig = filters.find((f) => f.id === activeFilter);

  const filteredOptions = useMemo(() => {
    if (!activeFilterConfig) return [];
    if (!searchQuery.trim()) return activeFilterConfig.options;

    const query = searchQuery.toLowerCase();
    return activeFilterConfig.options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.value.toLowerCase().includes(query)
    );
  }, [activeFilterConfig, searchQuery]);

  return (
    <BaseDrawer isOpen={isOpen} onClose={onClose}>
      {/* Content - Switch between main view and filter detail */}
      {!activeFilter ? (
        /* Main View - Filter List */
        <div
          className="flex flex-col"
          style={{ maxHeight: "calc(92vh - 24px)" }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <SlidersHorizontal className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Filters
                  </h2>
                  {totalActiveFilters > 0 && (
                    <p className="text-xs text-slate-500">
                      {totalActiveFilters} filter
                      {totalActiveFilters > 1 ? "s" : ""} applied
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Filter List - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            {filters.map((filter) => {
              const selected = getSelectedValues(filter.id);
              const hasSelection = selected.length > 0;

              return (
                <div key={filter.id} className="border-b border-slate-100">
                  {/* Filter row - clickable to open detail */}
                  <button
                    onClick={() => setActiveFilter(filter.id)}
                    className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {filter.label}
                      </span>
                      {hasSelection && (
                        <Badge className="bg-blue-100 text-blue-700 text-xs font-semibold">
                          {selected.length}
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </button>

                  {/* Selected values as removable badges */}
                  {hasSelection && (
                    <div className="px-4 pb-3 -mt-1">
                      <div className="flex flex-wrap gap-1.5">
                        {selected.map((value) => (
                          <button
                            key={value}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelection(filter.id, value, filter.isMulti);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-full active:bg-blue-700 transition-colors"
                          >
                            {filter.isColor && (
                              <span
                                className="w-3 h-3 rounded-full border border-white/40"
                                style={{ backgroundColor: getColors(value) }}
                              />
                            )}
                            <span className="max-w-[100px] truncate">
                              {value}
                            </span>
                            <X className="h-3 w-3 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 shadow-lg">
            <div className="flex gap-2">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 h-12 text-red-600 border-2 border-red-200 hover:bg-red-50 font-semibold rounded-xl"
                  onClick={clearAllFilters}
                >
                  <FilterX className="h-4 w-4 mr-1.5" />
                  Clear
                </Button>
              )}
              <Button
                size="lg"
                className={`${
                  hasActiveFilters ? "flex-1" : "w-full"
                } h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl`}
                onClick={onClose}
              >
                Show results
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Filter Detail View */
        <div
          className="flex flex-col"
          style={{ maxHeight: "calc(92vh - 24px)" }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveFilter(null)}
                  className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {activeFilterConfig?.label}
                  </h2>
                  {getSelectedValues(activeFilter).length > 0 && (
                    <p className="text-xs text-slate-500">
                      {getSelectedValues(activeFilter).length} selected
                    </p>
                  )}
                </div>
              </div>
              {getSelectedValues(activeFilter).length > 0 && (
                <button
                  onClick={() => clearFilter(activeFilter)}
                  className="text-sm text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Search (if searchable) */}
            {activeFilterConfig?.isSearchable && (
              <div className="mt-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder={`Search ${activeFilterConfig.label.toLowerCase()}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 bg-slate-50 border-slate-200 rounded-xl"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"
                    >
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selected items pills */}
          {getSelectedValues(activeFilter).length > 0 && (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
              <div className="flex flex-wrap gap-2">
                {getSelectedValues(activeFilter).map((value) => (
                  <Badge
                    key={value}
                    className="bg-blue-600 text-white cursor-pointer flex items-center gap-1.5 py-1.5 px-3 rounded-full hover:bg-blue-700 transition-colors"
                    onClick={() =>
                      toggleSelection(
                        activeFilter,
                        value,
                        activeFilterConfig?.isMulti ?? true
                      )
                    }
                  >
                    {activeFilterConfig?.isColor && (
                      <span
                        className="w-3 h-3 rounded-full border border-white/50"
                        style={{ backgroundColor: getColors(value) }}
                      />
                    )}
                    <span className="text-sm font-medium">{value}</span>
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Options List - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-12 text-center text-slate-500">
                No results found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = getSelectedValues(activeFilter).includes(
                  option.value
                );
                const isDisabled = getDisabledOptions(activeFilter).includes(
                  option.value
                );

                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      if (!isDisabled) {
                        toggleSelection(
                          activeFilter,
                          option.value,
                          activeFilterConfig?.isMulti ?? true
                        );
                      }
                    }}
                    disabled={isDisabled}
                    className={`w-full flex items-center justify-between px-4 py-3.5 border-b border-slate-100 transition-colors ${
                      isDisabled
                        ? "opacity-40 cursor-not-allowed bg-slate-50"
                        : isSelected
                        ? "bg-blue-50"
                        : "active:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {activeFilterConfig?.isColor && (
                        <span
                          className="w-6 h-6 rounded-full border border-slate-200 shadow-sm"
                          style={{
                            backgroundColor: getColors(option.value),
                          }}
                        />
                      )}
                      <span
                        className={`text-base ${
                          isSelected
                            ? "font-semibold text-blue-700"
                            : "text-slate-900"
                        }`}
                      >
                        {option.label}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shadow-sm">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Done Button */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 shadow-lg">
            <Button
              size="lg"
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
              onClick={() => setActiveFilter(null)}
            >
              Done
              {getSelectedValues(activeFilter).length > 0 && (
                <span className="ml-1">
                  ({getSelectedValues(activeFilter).length})
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </BaseDrawer>
  );
};

export default MobileFiltersDrawer;
