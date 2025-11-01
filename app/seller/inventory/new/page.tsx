// Página para agregar productos al inventario - Ohara TCG Shop
// Fecha de modificación: 2025-01-19 - Con filtros y observer como card-list

"use client";

import React, { useEffect, useState, Fragment, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Filter,
  Plus,
  Package,
  ChevronLeft,
  RefreshCw,
  Check,
  AlertCircle,
} from "lucide-react";
import { PageSkeleton } from "@/components/skeletons";
import SearchFilters from "@/components/home/SearchFilters";
import ViewSwitch from "@/components/ViewSwitch";
import SearchResults from "@/components/SearchResults";
import { useCards } from "@/hooks/useCards";
import { useQueryClient } from "@tanstack/react-query";
import { useInventoryStore } from "@/store/inventoryStore";
import { highlightText } from "@/helpers/functions";
import { Oswald } from "next/font/google";
import { rarityFormatter } from "@/helpers/formatters";

import FAB from "@/components/Fab";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import AddToInventoryModal from "@/components/seller/AddToInventoryModal";
import AlternatesWhite from "@/public/assets/images/variantsICON_VERTICAL_white.svg";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function AddToInventory() {
  const router = useRouter();
  const { data: cards, isLoading } = useCards();
  const { inventory, fetchInventory } = useInventoryStore();
  const queryClient = useQueryClient();

  // Estados para paginación y vista
  const [visibleCount, setVisibleCount] = useState(50);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showFab, setShowFab] = useState(false);

  // Estados para filtros - siguiendo el mismo patrón de card-list
  const [search, setSearch] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<string>("");
  const [selectedTrigger, setSelectedTrigger] = useState<string>("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);

  // Estados para vista
  const [viewSelected, setViewSelected] = useState<
    "grid" | "list" | "alternate" | "text"
  >("text");

  // Estados para modal y filtros
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Get inventory card IDs para marcar cuáles ya están en inventario
  const inventoryCardIds = inventory?.map((item) => item.cardId) || [];

  // Función para coincidir códigos de cartas (igual que en card-list)
  const matchesCardCode = (code: string, search: string) => {
    const query = search.toLowerCase().trim();
    const fullCode = code.toLowerCase();

    if (query.includes("-")) {
      return fullCode.includes(query);
    }

    const parts = code.split("-");

    if (/^\d+$/.test(query)) {
      if (query[0] === "0") {
        return parts.some((part) => {
          const matchDigits = part.match(/\d+/);
          return matchDigits ? matchDigits[0] === query : false;
        });
      } else {
        const queryNumber = parseInt(query, 10);
        return parts.some((part) => {
          const matchDigits = part.match(/\d+/);
          return matchDigits
            ? parseInt(matchDigits[0], 10) === queryNumber
            : false;
        });
      }
    }

    return parts.some((part) => part.toLowerCase().includes(query));
  };

  // Filtrado de cartas (igual que en card-list)
  const filteredCards = cards
    ?.map((card) => {
      // Filtrar las alternates para excluir "Pre-Errata" y "Demo Version"
      const excludedAlternateArts = ["Pre-Errata", "Demo Version"];
      const filteredAlternates =
        card.alternates?.filter(
          (alt) => !excludedAlternateArts.includes(alt.alternateArt ?? "")
        ) || [];

      // Retornar la carta con las alternates filtradas
      return {
        ...card,
        alternates: filteredAlternates,
      };
    })
    ?.filter((card) => {
      const searchLower = search.trim().toLowerCase();
      const matchesSearch =
        card.name.toLowerCase().includes(searchLower) ||
        (card.power ?? "").toLowerCase().includes(searchLower) ||
        (card.cost ?? "").toLowerCase().includes(searchLower) ||
        (card.attribute ?? "").toLowerCase().includes(searchLower) ||
        (card.rarity ?? "").toLowerCase().includes(searchLower) ||
        matchesCardCode(card.code, search) ||
        (card.texts ?? []).some((item) =>
          item.text.toLowerCase().includes(searchLower)
        ) ||
        (card.types ?? []).some((item) =>
          item.type.toLowerCase().includes(searchLower)
        ) ||
        (card.sets ?? []).some((item) =>
          item.set.title.toLowerCase().includes(searchLower)
        );

      const matchesColors =
        selectedColors?.length === 0 ||
        card.colors.some((col) =>
          selectedColors.includes(col.color.toLowerCase())
        );

      const matchesSets =
        selectedSets?.length === 0 ||
        card.sets.some((set) => selectedSets.includes(set.set.title)) ||
        (card.alternates ?? []).some((alt) =>
          alt.sets.some((set) => selectedSets.includes(set.set.title))
        );

      const matchesTypes =
        selectedTypes?.length === 0 ||
        card.types.some((type) => selectedTypes.includes(type.type));

      const matchesEffects =
        selectedEffects?.length === 0 ||
        (card.effects ?? []).some((effect) =>
          selectedEffects.includes(effect.effect)
        );

      const matchesRarity =
        selectedRarities?.length === 0 ||
        selectedRarities.includes(card.rarity ?? "");

      const matchesAltArts =
        selectedAltArts?.length === 0 ||
        (card.alternates ?? []).some((alt) =>
          selectedAltArts.includes(alt.alternateArt ?? "")
        );

      const matchesCosts =
        selectedCosts?.length === 0 || selectedCosts.includes(card.cost ?? "");

      const matchesPower =
        selectedPower?.length === 0 || selectedPower.includes(card.power ?? "");

      const matchesCategories =
        selectedCategories?.length === 0 ||
        selectedCategories.includes(card.category ?? "");

      const matchesAttributes =
        selectedAttributes?.length === 0 ||
        selectedAttributes.includes(card.attribute ?? "");

      const matchesCounter =
        selectedCounter === ""
          ? true
          : selectedCounter === "No counter"
          ? card.counter == null
          : card.counter?.includes(selectedCounter);

      const matchedTrigger =
        selectedTrigger == ""
          ? true
          : selectedTrigger === "No trigger"
          ? card.triggerCard === null
          : card.triggerCard !== null;

      const matchedCode =
        selectedCodes?.length === 0 || selectedCodes.includes(card.setCode);

      return (
        matchesSearch &&
        matchesColors &&
        matchesRarity &&
        matchesCategories &&
        matchesCounter &&
        matchedTrigger &&
        matchesEffects &&
        matchesTypes &&
        matchesSets &&
        matchesCosts &&
        matchesPower &&
        matchesAttributes &&
        matchedCode &&
        matchesAltArts
      );
    });

  const handleScrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setVisibleCount(50);
  };

  // Intersection Observer para carga paginada
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          visibleCount < (filteredCards?.length ?? 0)
        ) {
          setVisibleCount((prev) => prev + 50);
        }
      },
      { rootMargin: "200px" }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) observer.unobserve(sentinelRef.current);
    };
  }, [visibleCount, filteredCards?.length]);

  // Reset paginación cuando cambien los filtros
  useEffect(() => {
    handleScrollToTop();
  }, [
    viewSelected,
    search,
    selectedColors,
    selectedSets,
    selectedRarities,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedCategories,
    selectedEffects,
    selectedTypes,
    selectedCounter,
    selectedTrigger,
  ]);

  // Fetch inicial
  useEffect(() => {
    fetchInventory();
  }, []);

  const handleCardSelect = (card: any) => {
    setSelectedCard(card);
    setModalOpen(true);
  };

  const handleModalSuccess = () => {
    // Recargar inventario
    fetchInventory();
    toast.success("Producto agregado al inventario exitosamente");
  };

  const totalFilters =
    selectedColors?.length +
    selectedRarities?.length +
    selectedCategories?.length +
    (selectedCounter !== "" ? 1 : 0) +
    (selectedTrigger !== "" ? 1 : 0) +
    selectedEffects?.length +
    selectedTypes?.length +
    selectedSets?.length +
    selectedCosts?.length +
    selectedPower?.length +
    selectedAttributes?.length;

  // Helper para verificar si carta ya está en inventario
  const isCardInInventory = (cardId: string | number) => {
    const id = typeof cardId === "string" ? parseInt(cardId) : cardId;
    return inventoryCardIds.includes(id);
  };

  if (!cards || cards.length === 0) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 w-full">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/seller/inventory")}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Inventory
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Plus className="w-7 h-7 text-blue-500" />
                  Add to Inventory
                </h1>
                <p className="text-gray-600 text-sm">
                  Search and select cards from catalog to add to your inventory
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['cards'] });
                  fetchInventory();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Desktop */}
      <div className="bg-white w-full">
        <div className="justify-center border-b border-[#f5f5f5] py-3 px-5 hidden md:flex gap-5">
          <SearchFilters
            search={search}
            setSearch={setSearch}
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
            setViewSelected={setViewSelected}
            selectedSets={selectedSets}
            setSelectedSets={setSelectedSets}
            selectedCosts={selectedCosts}
            setSelectedCosts={setSelectedCosts}
            selectedPower={selectedPower}
            setSelectedPower={setSelectedPower}
            selectedAttributes={selectedAttributes}
            setSelectedAttributes={setSelectedAttributes}
            selectedCodes={selectedCodes}
            setSelectedCodes={setSelectedCodes}
            setSelectedAltArts={setSelectedAltArts}
            selectedAltArts={selectedAltArts}
          />
        </div>

        {/* Filters - Mobile */}
        <div className="flex md:hidden p-3 flex-col gap-3 border-b border-[#f5f5f5]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search cards to add..."
              className="pl-10 border-gray-300"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2 justify-center items-center">
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {totalFilters > 0 && (
                  <Badge className="ml-2 !bg-white !text-blue-600 font-bold">
                    {totalFilters}
                  </Badge>
                )}
              </Button>
            </div>

            <div className="flex justify-center items-center gap-2">
              <ViewSwitch
                viewSelected={viewSelected}
                setViewSelected={setViewSelected}
              />
            </div>
          </div>

          {/* Expandible filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <SearchFilters
                search={search}
                setSearch={setSearch}
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
                setViewSelected={setViewSelected}
                selectedSets={selectedSets}
                setSelectedSets={setSelectedSets}
                selectedCosts={selectedCosts}
                setSelectedCosts={setSelectedCosts}
                selectedPower={selectedPower}
                setSelectedPower={setSelectedPower}
                selectedAttributes={selectedAttributes}
                setSelectedAttributes={setSelectedAttributes}
                selectedCodes={selectedCodes}
                setSelectedCodes={setSelectedCodes}
                setSelectedAltArts={setSelectedAltArts}
                selectedAltArts={selectedAltArts}
              />
            </div>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="py-2 px-4 border-b bg-white flex justify-between">
        <SearchResults count={filteredCards?.length ?? 0} />
        <div className="hidden md:flex justify-center items-center">
          <ViewSwitch
            viewSelected={viewSelected}
            setViewSelected={setViewSelected}
          />
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-green-50 border-b border-green-200">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <span className="text-green-800">
              Click any card to add it to your inventory. Cards already in
              inventory are marked with a
              <Check className="h-4 w-4 inline mx-1 text-green-600" />
              icon.
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="p-3 md:p-5 overflow-y-scroll flex-1"
        ref={scrollContainerRef}
        onScroll={(e) => {
          const scrollTop = (e.target as HTMLDivElement).scrollTop;
          if (scrollTop > 100) {
            setShowFab(true);
          } else {
            setShowFab(false);
          }
        }}
      >
        {showFab && <FAB onClick={handleScrollToTop} />}

        {/* Vista Text */}
        {viewSelected === "text" && (
          <div className="grid gap-3 lg:gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-[repeat(auto-fit,_minmax(350px,_1fr))] justify-items-center">
            {filteredCards?.slice(0, visibleCount).map((card) => {
              const inInventory = isCardInInventory(card.id);
              return (
                <Card
                  key={card.id}
                  className={`w-full cursor-pointer max-w-[450px] hover:shadow-lg transition-all relative ${
                    inInventory ? "ring-2 ring-green-500" : ""
                  }`}
                  onClick={() => handleCardSelect(card)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="relative">
                        <img
                          src={card.src}
                          alt={card.name}
                          className="w-16 h-22 object-cover rounded"
                        />
                        {inInventory && (
                          <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg line-clamp-2">
                          {highlightText(card.name, search)}
                        </h3>
                        <p
                          className={`${oswald.className} text-sm text-gray-600 mb-2`}
                        >
                          {highlightText(card.code, search)}
                        </p>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary">
                            {card.rarity ? rarityFormatter(card.rarity) : ""}
                          </Badge>
                          {inInventory && (
                            <Badge
                              variant="outline"
                              className="text-green-600 border-green-300"
                            >
                              In Inventory
                            </Badge>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-500">
                            <p>Cost: {card.cost || "—"}</p>
                            <p>Power: {card.power || "—"}</p>
                          </div>
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600"
                            disabled={inInventory}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            {inInventory ? "Added" : "Add"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Vista List */}
        {viewSelected === "list" && (
          <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-[repeat(auto-fit,_minmax(250px,_1fr))] justify-items-center">
            {filteredCards?.slice(0, visibleCount).map((card) => {
              const inInventory = isCardInInventory(card.id);
              return (
                <Card
                  key={card.id}
                  className={`w-full cursor-pointer max-w-[450px] hover:shadow-lg transition-all relative ${
                    inInventory ? "ring-2 ring-green-500" : ""
                  }`}
                  onClick={() => handleCardSelect(card)}
                >
                  <CardContent className="flex justify-center items-center p-4 flex-col h-full">
                    <div className="flex justify-center items-center w-full relative">
                      <img
                        src={card.src}
                        alt={card.name}
                        className="w-[80%] m-auto"
                      />
                      {inInventory && (
                        <div className="absolute top-0 right-0 bg-green-500 rounded-full p-1">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="mt-2 w-full">
                      <div className="text-center">
                        <span
                          className={`${oswald.className} text-[13px] font-bold`}
                        >
                          {highlightText(card.code, search)}
                        </span>
                        <p className="text-[11px] text-gray-600 line-clamp-1">
                          {card.sets[0]?.set?.title}
                        </p>
                        <div className="flex justify-center items-center mt-2">
                          {inInventory ? (
                            <Badge
                              variant="outline"
                              className="text-green-600 border-green-300 text-xs"
                            >
                              Added
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-600 text-xs px-2"
                            >
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Vista Alternate */}
        {viewSelected === "alternate" && (
          <div className="flex flex-col lg:px-5 lg:py-5 gap-5">
            {filteredCards?.slice(0, visibleCount).map((card) => {
              // Función que verifica si la carta base cumple con los filtros
              const baseCardMatches = (): boolean => {
                if (!card) return false;
                let matches = true;
                if (selectedSets.length > 0) {
                  matches =
                    card.sets?.some((s) =>
                      selectedSets.includes(s.set.title)
                    ) || false;
                }
                if (selectedAltArts.length > 0) {
                  matches =
                    matches && selectedAltArts.includes(card?.rarity ?? "");
                }
                return matches;
              };

              // Función que filtra las alternates según set y rareza
              const getFilteredAlternates = () => {
                if (!card?.alternates) return [];
                return card.alternates.filter((alt) => {
                  let matches = true;
                  if (selectedSets.length > 0) {
                    matches =
                      alt.sets?.some((s) =>
                        selectedSets.includes(s.set.title)
                      ) || false;
                  }
                  if (selectedAltArts.length > 0) {
                    matches =
                      matches &&
                      selectedAltArts.includes(alt.alternateArt ?? "");
                  }
                  return matches;
                });
              };

              const filteredAlts = getFilteredAlternates();
              const inInventory = isCardInInventory(card.id);

              // Si ni la carta base ni alguna alterna cumplen los criterios, no se renderiza nada.
              if (!baseCardMatches() && filteredAlts.length === 0) return null;

              return (
                <div className="flex flex-col gap-5" key={card.id}>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-[repeat(auto-fit,_minmax(250px,250px))] mb-3">
                    {/* Card Info Header */}
                    <Card>
                      <CardContent className="p-5 h-full bg-black rounded-lg text-white">
                        <div className="h-full flex flex-col justify-around items-center relative">
                          <div className="flex items-center justify-between flex-col mt-4">
                            <h2 className="text-lg font-black break-normal mb-2 text-center leading-tight line-clamp-2">
                              {highlightText(card?.name, search)}
                            </h2>
                            <p
                              className={`${oswald.className} text-md text-white leading-[16px] mb-4 font-[400]`}
                            >
                              {highlightText(card?.code, search)}
                            </p>
                            <div className="flex justify-between items-end flex-col gap-1 mb-1 mr-1">
                              <Badge
                                variant="secondary"
                                className="text-sm !bg-white text-black rounded-full min-w-[41px] text-center border border-[#000]"
                              >
                                <span className="text-center w-full font-black leading-[16px] mb-[2px]">
                                  {card?.rarity
                                    ? rarityFormatter(card.rarity)
                                    : ""}
                                </span>
                              </Badge>
                            </div>
                            <div className="flex flex-col mt-2">
                              {card?.types.map((type) => (
                                <span
                                  key={type.type}
                                  className="text-[13px] leading-[15px] font-[200] text-center"
                                >
                                  {highlightText(type.type, search)}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 mt-3">
                            <img
                              src={AlternatesWhite.src}
                              alt="eye"
                              className="w-[35px] h-[35px] mt-1"
                            />
                            <div className="flex items-center flex-col">
                              <span className="font-bold text-2xl text-white leading-[30px]">
                                {(card?.alternates?.length ?? 0) + 1}
                              </span>
                              <span className="text-sm text-white leading-[13px]">
                                {card?.alternates?.length === 0
                                  ? "variant"
                                  : "variants"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Renderiza la carta base para vista "Base" */}
                    {baseCardMatches() && (
                      <Card
                        onClick={() => handleCardSelect(card)}
                        className={`cursor-pointer relative ${
                          inInventory ? "ring-2 ring-green-500" : ""
                        }`}
                      >
                        <CardContent className="flex justify-center items-center p-4 flex-col h-full">
                          <div className="flex justify-center items-center w-full relative">
                            <img
                              src={card?.src}
                              alt={card?.name}
                              className="w-[80%] m-auto"
                            />
                            {inInventory && (
                              <div className="absolute top-0 right-0 bg-green-500 rounded-full p-1">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-center font-bold mt-2">
                              Base
                              {inInventory && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-green-600 border-green-300 text-xs"
                                >
                                  Added
                                </Badge>
                              )}
                            </div>
                            {card.sets?.map((set) => (
                              <p
                                key={set.set.title}
                                className="text-[13px] leading-[15px] font-[200] text-center line-clamp-2"
                              >
                                {highlightText(set.set.title, search)}
                              </p>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Renderiza solo las alternates que cumplen los filtros */}
                    {filteredAlts.map((alt) => {
                      const setsArray: string[] | undefined = alt?.sets?.map(
                        (item: any) =>
                          typeof item === "object" ? item.set.title : item
                      );

                      // Create alternate card object for modal
                      const altCard = {
                        ...card,
                        ...alt,
                        id: alt.id || card.id, // Use alt id if available, fallback to card id
                        src: alt.src,
                        alternateArt: alt.alternateArt,
                        sets: alt.sets,
                      };

                      const altInInventory = isCardInInventory(altCard.id);

                      return (
                        <Card
                          key={alt.id || `${card.id}-${alt.alternateArt}`}
                          onClick={() => handleCardSelect(altCard)}
                          className={`cursor-pointer relative ${
                            altInInventory ? "ring-2 ring-green-500" : ""
                          }`}
                        >
                          <CardContent className="flex justify-center items-center p-4 flex-col h-full">
                            <div className="flex justify-center items-center w-full relative">
                              <img
                                src={alt?.src}
                                alt={alt?.name}
                                className="w-[80%] m-auto"
                              />
                              {altInInventory && (
                                <div className="absolute top-0 right-0 bg-green-500 rounded-full p-1">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-center font-bold mt-2">
                                {alt?.alternateArt}
                                {altInInventory && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 text-green-600 border-green-300 text-xs"
                                  >
                                    Added
                                  </Badge>
                                )}
                              </div>
                              {setsArray?.map((set) => (
                                <p
                                  key={set}
                                  className="text-[13px] leading-[15px] font-[200] text-center line-clamp-2"
                                >
                                  {highlightText(set, search)}
                                </p>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {filteredCards?.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No cards found
            </h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search terms or filters
            </p>
          </div>
        )}

        {/* Sentinel para infinite scroll */}
        {visibleCount < (filteredCards?.length ?? 0) && (
          <div ref={sentinelRef} style={{ height: "1px" }} />
        )}
      </div>

      {/* Modal para agregar al inventario */}
      <AddToInventoryModal
        card={selectedCard}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
