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
} from "@/helpers/constants";

interface FiltersSidebarProps {
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
}

const FiltersSidebar = forwardRef<HTMLDivElement, FiltersSidebarProps>(
  (
    {
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
    },
    ref
  ) => {
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
              options={rarityOptions}
              selected={selectedRarities}
              setSelected={setSelectedRarities}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Rarity"
              }
              searchPlaceholder="Search rarity..."
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
          </div>

          {/* Footer fijo */}
          <div className="p-4 border-t border-border flex gap-2 flex-col flex-1 justify-end">
            <Button
              className={`w-full ${
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
                selectedCodes.length > 0
                  ? "!bg-[#ef4444] opacity-1 cursor-pointer"
                  : "opacity-[0.5] cursor-not-allowed"
              }`}
              size="lg"
              onClick={() => {
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
              }}
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
