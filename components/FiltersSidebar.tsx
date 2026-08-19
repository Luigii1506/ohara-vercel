"use client";

import React, { forwardRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import MultiSelect, { Option } from "./MultiSelect";
import SingleSelect from "./SingleSelect";
import { FilterX, Check } from "lucide-react";
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
  blockOptions,
} from "@/helpers/constants";

interface FiltersSidebarProps {
  // "overlay" (default): panel flotante de pantalla completa con backdrop, tal
  // como se usa hoy en el resto de la app. "inline": columna persistente sin
  // backdrop ni botón de cerrar, para incrustar dentro de otro layout (ej. el
  // modal de Agregar cartas).
  variant?: "overlay" | "inline";
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  search: string;
  setSearch: (value: string) => void;
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
  disabledColors?: string[];
  disabledTypes?: string[];
  selectedAltArts: string[];
  setSelectedAltArts: (altArts: string[]) => void;
  selectedCodes: string[];
  setSelectedCodes: (codes: string[]) => void;
  // Bloque de regulación (1-5) y legalidad Standard — opcionales.
  selectedBlocks?: string[];
  setSelectedBlocks?: (blocks: string[]) => void;
  standardLegalOnly?: boolean;
  setStandardLegalOnly?: (value: boolean) => void;
}

const FiltersSidebar = forwardRef<HTMLDivElement, FiltersSidebarProps>(
  (
    {
      variant = "overlay",
      isOpen,
      setIsOpen,
      search,
      setSearch,
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
      disabledColors,
      disabledTypes,
      selectedAltArts,
      setSelectedAltArts,
      selectedCodes,
      setSelectedCodes,
      selectedBlocks,
      setSelectedBlocks,
      standardLegalOnly,
      setStandardLegalOnly,
    },
    ref
  ) => {
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
      selectedCodes.length > 0;

    const clearAll = () => {
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
      setSelectedCodes([]);
      setSelectedBlocks?.([]);
      setStandardLegalOnly?.(false);
    };

    const filtersContent = (
      <>
        <MultiSelect
              options={setCodesOptions}
              selected={selectedCodes}
              setSelected={setSelectedCodes}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Codes"
              }
              searchPlaceholder="Search code..."
              isSearchable={true}
              isSolid={true}
            />

            <MultiSelect
              options={setOptions}
              selected={selectedSets}
              setSelected={setSelectedSets}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Sets"
              }
              searchPlaceholder="Search set..."
              isSearchable={true}
              isSolid={true}
            />

            <MultiSelect
              options={altArtOptions}
              selected={selectedAltArts}
              setSelected={setSelectedAltArts}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Alt arts"
              }
              searchPlaceholder="Search alt arts..."
              isSolid={true}
            />

            <MultiSelect
              options={rarityOptions}
              selected={selectedRarities}
              setSelected={setSelectedRarities}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Rarity"
              }
              searchPlaceholder="Search rarity..."
              isSolid={true}
            />

            {setSelectedBlocks && (
              <MultiSelect
                options={blockOptions}
                selected={selectedBlocks ?? []}
                setSelected={setSelectedBlocks}
                displaySelectedAs={(selected) =>
                  selected.length === 1
                    ? `Bloque ${selected[0]}`
                    : "Bloque"
                }
                searchPlaceholder="Bloque..."
                isSolid={true}
              />
            )}

            {setStandardLegalOnly && (
              <button
                type="button"
                onClick={() => setStandardLegalOnly(!standardLegalOnly)}
                className={
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
                  (standardLegalOnly
                    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                    : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10")
                }
              >
                <span
                  className={
                    "h-3.5 w-3.5 rounded border " +
                    (standardLegalOnly
                      ? "border-emerald-400 bg-emerald-400"
                      : "border-white/40")
                  }
                />
                Solo legal (Standard)
              </button>
            )}

            <MultiSelect
              options={categoryOptions}
              selected={selectedCategories}
              setSelected={setSelectedCategories}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Type"
              }
              searchPlaceholder="Search type..."
              isSolid={true}
              disabledOptions={disabledTypes}
            />

            <MultiSelect
              options={colorOptions}
              selected={selectedColors}
              setSelected={setSelectedColors}
              buttonLabel="Color"
              searchPlaceholder="Search color"
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Color"
              }
              isColor={true}
              isSolid={true}
              disabledOptions={disabledColors}
            />

            <MultiSelect
              options={costOptions}
              selected={selectedCosts}
              setSelected={setSelectedCosts}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Cost"
              }
              searchPlaceholder="Search cost..."
              isSearchable={true}
              isSolid={true}
            />
            <MultiSelect
              options={powerOptions}
              selected={selectedPower}
              setSelected={setSelectedPower}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Power"
              }
              searchPlaceholder="Search power..."
              isSearchable={true}
              isSolid={true}
            />

            <SingleSelect
              options={counterOptions}
              selected={selectedCounter}
              setSelected={setSelectedCounter}
              buttonLabel="Counter"
              isColor={false}
              isSolid={true}
            />
            <MultiSelect
              options={effectsOptions}
              selected={selectedEffects}
              setSelected={setSelectedEffects}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Effects"
              }
              searchPlaceholder="Search effect..."
              isSearchable={true}
              isSolid={true}
            />

            <SingleSelect
              options={triggerOptions}
              selected={selectedTrigger}
              setSelected={setSelectedTrigger}
              buttonLabel="Trigger"
              isColor={false}
              isSolid={true}
            />

            <MultiSelect
              options={typesOptions}
              selected={selectedTypes}
              setSelected={setSelectedTypes}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Family"
              }
              searchPlaceholder="Search family..."
              isSearchable={true}
              isSolid={true}
            />

            <MultiSelect
              options={atributeOptions}
              selected={selectedAttributes}
              setSelected={setSelectedAttributes}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Attribute"
              }
              searchPlaceholder="Search attribute..."
              isSolid={true}
            />
      </>
    );

    if (variant === "inline") {
      return (
        <div
          className="flex h-full w-full flex-col bg-white border-r border-slate-200"
          ref={ref}
        >
          <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-slate-700">Filters</h2>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
              >
                <FilterX className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {filtersContent}
          </div>
        </div>
      );
    }

    return (
      <div
        className="fixed inset-0 flex w-screen items-center justify-center p-4 backdrop-blur-md z-[99999]"
        ref={ref}
        onClick={() => setIsOpen(false)}
      >
        <div
          className="fixed inset-y-0 left-0 w-full max-w-[350px] bg-background border-border flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-black text-white">
            <h2 className="text-xl font-semibold">Filters</h2>
            <button
              type="button"
              className="hover:bg-accent hover:text-accent-foreground p-2 rounded-md"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-7 w-7" />
            </button>
          </div>

          {/* Contenedor de filtros con scroll */}
          <div className="overflow-y-auto p-4 flex gap-4 justify-start flex-wrap items-center">
            {filtersContent}
          </div>

          {/* Footer fijo */}
          <div className="p-4 border-t border-border flex gap-2 flex-col flex-1 justify-end">
            <Button
              className={`w-full ${
                hasActiveFilters
                  ? "!bg-[#ef4444] opacity-1 cursor-pointer"
                  : "opacity-[0.5] cursor-not-allowed"
              }`}
              size="lg"
              onClick={clearAll}
            >
              <FilterX className="h-4 w-4" />
              Clear filters
            </Button>
            <Button
              className="w-full !bg-[#2463eb]"
              size="lg"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

export default FiltersSidebar;
