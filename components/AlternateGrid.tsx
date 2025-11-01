"use client";

import React from "react";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MultiSelect from "@/components/MultiSelect";
import SingleSelect from "@/components/SingleSelect";
import { allRegions } from "@/helpers/constants";
import { ProToggleButton } from "@/components/shared/ProToggleButton";

// Interfaz para cada alterna
export interface Alternate {
  id: string;
  src: string;
  sets: string[]; // IDs de los sets seleccionados
  alias: string;
  tcgUrl?: string;
  alternateArt?: string | null;
  order?: string;
  isPro?: boolean;
  region?: string;
}

// Props extendidas para AlternatesGrid
interface AlternatesGridProps {
  editedAlternates: Alternate[];
  setEditedAlternates: React.Dispatch<React.SetStateAction<Alternate[]>>;
  setsDropdown: { value: string; label: string }[];
  selectedCard: any; // Ajusta el tipo según corresponda (por ejemplo, CardWithCollectionData)
  isButtonDisabled: boolean;
  handleEditAlternateSets: (index: number, value: string[]) => void;
  handleEditAlternateSrc: (index: number, newSrc: string) => void;
  handleEditTcgUrl: (index: number, newTcgUrl: string) => void;
  handleEditAltAlias: (index: number, newAlias: string) => void;
  handleEditRarity: (index: number, newValue: string) => void;
  handleEditRegion: (index: number, newValue: string) => void;
  handleEditIsPro: (index: number, newValue: string) => void;
  handleDeleteAlternate: (index: number) => void;
  altArtOptions: { value: string; label: string }[];
}

// Componente para cada elemento sortable
const SortableItem: React.FC<{
  item: Alternate;
  index: number;
  // Funciones pasadas del padre
  handleEditAlternateSets: (index: number, value: string[]) => void;
  handleEditAlternateSrc: (index: number, newSrc: string) => void;
  handleEditTcgUrl: (index: number, newTcgUrl: string) => void;
  handleEditAltAlias: (index: number, newAlias: string) => void;
  handleEditRarity: (index: number, newValue: string) => void;
  handleEditRegion: (index: number, newValue: string) => void;
  handleEditIsPro: (index: number, newValue: string) => void;
  handleDeleteAlternate: (index: number) => void;
  selectedCard: any;
  isButtonDisabled: boolean;
  setsDropdown: { value: string; label: string }[];
  altArtOptions: { value: string; label: string }[];
}> = ({
  item,
  index,
  handleEditAlternateSets,
  handleEditAlternateSrc,
  handleEditTcgUrl,
  handleEditAltAlias,
  handleEditRarity,
  handleEditRegion,
  handleEditIsPro,
  handleDeleteAlternate,
  selectedCard,
  isButtonDisabled,
  setsDropdown,
  altArtOptions,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  console.log(item);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex flex-col justify-between gap-3 p-2 border border-gray-300 rounded-lg"
    >
      <div
        {...listeners}
        className="cursor-move self-end text-gray-500 text-center flex justify-center items-center w-full h-8 bg-gray-200 rounded-lg"
        title="Arrastra aquí para reordenar"
      >
        Arrastrar :: {/* Puedes usar un ícono aquí */}
      </div>

      <div>
        <img
          src={item.src}
          alt={item.src}
          className="w-full h-full border-[#000] border-[3px]"
        />
      </div>

      <div className="space-y-2 w-full">
        <Label htmlFor="cardSearch">Set(s)</Label>
        <MultiSelect
          options={setsDropdown}
          selected={item.sets}
          setSelected={(value) => handleEditAlternateSets(index, value)}
          displaySelectedAs={(selected) =>
            selected.length === 1
              ? setsDropdown.find((s) => s.value === selected[0])?.label ||
                "Set"
              : "Sets"
          }
          searchPlaceholder="Buscar set..."
          isSolid={false}
          isSearchable={true}
          isFullWidth={true}
          isDisabled={!selectedCard || isButtonDisabled}
        />
      </div>

      <div className="space-y-2 w-full">
        <Label htmlFor="cardSearch">Src</Label>
        <Input
          type="text"
          value={item.src}
          onChange={(e) => handleEditAlternateSrc(index, e.target.value)}
          disabled={!selectedCard || isButtonDisabled}
          placeholder="URL de la imagen"
        />
      </div>

      <div className="space-y-2 w-full">
        <Label htmlFor="cardSearch">TCG URL</Label>
        <Input
          type="text"
          value={item.tcgUrl || ""}
          onChange={(e) => handleEditTcgUrl(index, e.target.value)}
          disabled={!selectedCard || isButtonDisabled}
          placeholder="URL del TCG"
        />
      </div>

      <div className="space-y-2 w-full">
        <Label htmlFor="cardSearch">Alias</Label>
        <Input
          type="text"
          value={item.alias}
          onChange={(e) => {
            console.log("dddd");
            handleEditAltAlias(index, e.target.value);
          }}
          disabled={!selectedCard || isButtonDisabled}
          placeholder="Alias imagen"
        />
      </div>

      <div className="space-y-2 w-full">
        <Label htmlFor="cardSearch">Rareza</Label>
        <SingleSelect
          options={altArtOptions}
          selected={item.alternateArt ?? null}
          setSelected={(value) => handleEditRarity(index, value)}
          buttonLabel="Rarity..."
          isSearchable={true}
          isColor={false}
          isSolid={false}
          isFullWidth={true}
          isDisabled={!selectedCard || isButtonDisabled}
        />
      </div>

      <div className="space-y-2 w-full">
        <Label htmlFor="cardSearch">Region</Label>
        <SingleSelect
          options={allRegions}
          selected={item.region ?? null}
          setSelected={(value) => handleEditRegion(index, value)}
          buttonLabel="Region..."
          isSearchable={true}
          isColor={false}
          isSolid={false}
          isFullWidth={true}
          isDisabled={!selectedCard || isButtonDisabled}
        />
      </div>

      {/* <div className="space-y-2 w-full">
        <Label htmlFor="cardSearch">Pro Version</Label>
        <SingleSelect
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
          selected={item.isPro ? "true" : "false"}
          setSelected={(value) => handleEditIsPro(index, value)}
          buttonLabel="Pro Version..."
          isSearchable={true}
          isColor={false}
          isSolid={false}
          isFullWidth={true}
          isDisabled={!selectedCard || isButtonDisabled}
        />
      </div> */}
      <div className="space-y-2 w-full flex justify-center items-center">
        <ProToggleButton
          isActive={item.isPro}
          onToggle={(value) => handleEditIsPro(index, value.toString())}
        />
      </div>

      <Button
        type="button"
        onClick={() => handleDeleteAlternate(index)}
        className="bg-red-500 text-white"
        disabled={!selectedCard || isButtonDisabled}
      >
        Eliminar
      </Button>
    </div>
  );
};

const AlternatesGrid: React.FC<AlternatesGridProps> = ({
  editedAlternates,
  setEditedAlternates,
  setsDropdown,
  selectedCard,
  isButtonDisabled,
  handleEditAlternateSets,
  handleEditAlternateSrc,
  handleEditTcgUrl,
  handleEditAltAlias,
  handleEditRarity,
  handleEditRegion,
  handleEditIsPro,
  handleDeleteAlternate,
  altArtOptions,
}) => {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = editedAlternates.findIndex(
        (item) => item.id === active.id
      );
      const newIndex = editedAlternates.findIndex(
        (item) => item.id === over.id
      );
      const newItems = arrayMove(editedAlternates, oldIndex, newIndex);
      // Actualiza la propiedad "order" según la nueva posición
      const updatedAlternates = newItems.map((item, index) => ({
        ...item,
        order: index.toString(),
      }));

      console.log(updatedAlternates);
      setEditedAlternates(updatedAlternates);
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={editedAlternates.map((item) => item.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="grid grid-cols-4 gap-x-4 gap-y-14 w-full overflow-auto p-1">
          {editedAlternates.map((alt, index) => (
            <SortableItem
              key={alt.id}
              item={alt}
              index={index}
              handleEditAlternateSrc={handleEditAlternateSrc}
              handleEditTcgUrl={handleEditTcgUrl}
              handleEditAltAlias={handleEditAltAlias}
              handleEditAlternateSets={handleEditAlternateSets}
              handleEditRarity={handleEditRarity}
              handleEditRegion={handleEditRegion}
              handleEditIsPro={handleEditIsPro}
              handleDeleteAlternate={handleDeleteAlternate}
              selectedCard={selectedCard}
              isButtonDisabled={isButtonDisabled}
              setsDropdown={setsDropdown}
              altArtOptions={altArtOptions}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default AlternatesGrid;
