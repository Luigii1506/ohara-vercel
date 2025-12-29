"use client";

import React from "react";
import MultiSelect, { Option } from "../MultiSelect";
import DropdownSearch from "../DropdownSearch";
import SingleSelect from "../SingleSelect";
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
  setCodesOptions,
  altArtOptions,
} from "@/helpers/constants";

import ClearFiltersButton from "../ClearFiltersButton";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useI18n } from "@/components/i18n/I18nProvider";

interface SearchFiltersProps {
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
  setViewSelected: (view: "grid" | "list" | "alternate" | "text") => void;
  selectedSets: string[];
  setSelectedSets: (sets: string[]) => void;
  selectedCosts: string[];
  setSelectedCosts: (costs: string[]) => void;
  selectedPower: string[];
  setSelectedPower: (power: string[]) => void;
  selectedAttributes: string[];
  setSelectedAttributes: (attributes: string[]) => void;
  isInputClear?: boolean;
  setIsInputClear?: (value: boolean) => void;
  selectedCodes: string[];
  setSelectedCodes: (codes: string[]) => void;
  selectedAltArts: string[];
  setSelectedAltArts: (altArts: string[]) => void;
  selectedRegion?: string;
  setSelectedRegion?: (region: string) => void;
  isProVersion?: boolean;
}

const SearchFilters: React.FC<SearchFiltersProps> = ({
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
  setViewSelected,
  selectedSets,
  setSelectedSets,
  selectedCosts,
  setSelectedCosts,
  selectedPower,
  setSelectedPower,
  selectedAttributes,
  setSelectedAttributes,
  isInputClear,
  setIsInputClear,
  selectedCodes,
  setSelectedCodes,
  selectedAltArts,
  setSelectedAltArts,
  selectedRegion,
  setSelectedRegion,
  isProVersion,
}) => {
  const { t } = useI18n();
  // Detectar si es desktop (1024px+) para habilitar búsqueda
  // En tablets/iPads (< 1024px) se deshabilita para evitar el teclado
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return (
    <div className={"flex items-center justify-center w-full"}>
      {/* Search bars */}
      <div
        className={
          "w-full flex flex-row justify-center flex-wrap md:flex-nowrap gap-4"
        }
      >
        {/* Search bar container */}
        <div
          className={
            "flex flex-row w-full gap-10 md:gap-4 items-start flex-wrap"
          }
        >
          <div
            className={"flex gap-2 justify-start h-full flex-wrap items-center"}
          >
            {/* Code */}

            <div className={"hidden md:flex justify-center min-w-[350px]"}>
              <DropdownSearch
                search={search}
                setSearch={setSearch}
                placeholder={t("common.searchPlaceholder")}
                isInputClear={isInputClear}
                setIsInputClear={setIsInputClear}
              />
            </div>

            <ClearFiltersButton
              clearFilters={() => {
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
                setSelectedAltArts([]);
                setSelectedRegion?.("");
              }}
              isTouchable={
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
                selectedCodes.length > 0 ||
                selectedAltArts.length > 0 ||
                (selectedRegion ?? "") !== ""
              }
            />

            <MultiSelect
              options={setCodesOptions}
              selected={selectedCodes}
              setSelected={setSelectedCodes}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Codes"
              }
              searchPlaceholder="Search code..."
              isSearchable={isDesktop}
            />

            <MultiSelect
              options={setOptions}
              selected={selectedSets}
              setSelected={setSelectedSets}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Sets"
              }
              searchPlaceholder="Search set..."
              isSearchable={isDesktop}
            />
            <MultiSelect
              options={altArtOptions}
              selected={selectedAltArts}
              setSelected={setSelectedAltArts}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Alt Arts"
              }
              searchPlaceholder="Search alt art..."
              isSearchable={isDesktop}
            />

            <MultiSelect
              options={categoryOptions}
              selected={selectedCategories}
              setSelected={setSelectedCategories}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Type"
              }
              searchPlaceholder="Search type..."
            />

            <MultiSelect
              options={colorOptions}
              selected={selectedColors}
              setSelected={setSelectedColors}
              buttonLabel="Color"
              searchPlaceholder="Search color"
              displaySelectedAs={(selected) =>
                selected.length === 1
                  ? selected[0] // Si es un solo elemento, mostrar el valor seleccionado
                  : "Color"
              }
              isColor={true}
            />
            <MultiSelect
              options={costOptions}
              selected={selectedCosts}
              setSelected={setSelectedCosts}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Cost"
              }
              searchPlaceholder="Search cost..."
              isSearchable={isDesktop}
            />

            <MultiSelect
              options={powerOptions}
              selected={selectedPower}
              setSelected={setSelectedPower}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Power"
              }
              searchPlaceholder="Search power..."
              isSearchable={isDesktop}
            />

            <SingleSelect
              options={counterOptions}
              selected={selectedCounter}
              setSelected={setSelectedCounter}
              buttonLabel="Counter"
              isColor={false}
            />

            <MultiSelect
              options={effectsOptions}
              selected={selectedEffects}
              setSelected={setSelectedEffects}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Effects"
              }
              searchPlaceholder="Search effect..."
              isSearchable={isDesktop}
            />

            <SingleSelect
              options={triggerOptions}
              selected={selectedTrigger}
              setSelected={setSelectedTrigger}
              buttonLabel="Trigger"
              isColor={false}
            />
            <MultiSelect
              options={rarityOptions}
              selected={selectedRarities}
              setSelected={setSelectedRarities}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Rarity"
              }
              searchPlaceholder="Search rarity..."
            />

            <MultiSelect
              options={typesOptions}
              selected={selectedTypes}
              setSelected={setSelectedTypes}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Family"
              }
              searchPlaceholder="Search family..."
              isSearchable={isDesktop}
            />

            <MultiSelect
              options={atributeOptions}
              selected={selectedAttributes}
              setSelected={setSelectedAttributes}
              displaySelectedAs={(selected) =>
                selected.length === 1 ? selected[0] : "Attribute"
              }
              searchPlaceholder="Search attribute..."
            />

          </div>
        </div>
      </div>
    </div>
  );
};
export default SearchFilters;
