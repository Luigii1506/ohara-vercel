"use client";

import React from "react";
import MobileFiltersDrawer from "@/components/deckbuilder/MobileFiltersDrawer";

interface ProxyFiltersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedColors: string[];
  setSelectedColors: (colors: string[]) => void;
  selectedRarities: string[];
  setSelectedRarities: (rarities: string[]) => void;
  selectedCategories: string[];
  setSelectedCategories: (categories: string[]) => void;
  selectedCounter: string;
  setSelectedCounter: (counter: string) => void;
  selectedTrigger: string;
  setSelectedTrigger: (trigger: string) => void;
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
  onClearFilters: () => void;
  totalFilters: number;
}

const ProxyFiltersDrawer: React.FC<ProxyFiltersDrawerProps> = ({
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
}) => {
  return (
    <MobileFiltersDrawer
      isOpen={isOpen}
      onClose={onClose}
      selectedColors={selectedColors}
      setSelectedColors={setSelectedColors}
      selectedRarities={selectedRarities}
      setSelectedRarities={setSelectedRarities}
      selectedCategories={selectedCategories}
      setSelectedCategories={setSelectedCategories}
      selectedCounter={selectedCounter}
      setSelectedCounter={setSelectedCounter}
      selectedTrigger={selectedTrigger}
      setSelectedTrigger={setSelectedTrigger}
      selectedEffects={selectedEffects}
      setSelectedEffects={setSelectedEffects}
      selectedTypes={selectedTypes}
      setSelectedTypes={setSelectedTypes}
      selectedSets={selectedSets}
      setSelectedSets={setSelectedSets}
      selectedCosts={selectedCosts}
      setSelectedCosts={setSelectedCosts}
      selectedPower={selectedPower}
      setSelectedPower={setSelectedPower}
      selectedAttributes={selectedAttributes}
      setSelectedAttributes={setSelectedAttributes}
      selectedAltArts={selectedAltArts}
      setSelectedAltArts={setSelectedAltArts}
      selectedCodes={selectedCodes}
      setSelectedCodes={setSelectedCodes}
    />
  );
};

export default ProxyFiltersDrawer;
