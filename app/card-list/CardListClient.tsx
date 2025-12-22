"use client";

import React, {
  useEffect,
  useState,
  Fragment,
  useRef,
  useMemo,
  useCallback,
} from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { CardWithCollectionData } from "@/types";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { CardListPageSkeleton } from "@/components/skeletons";
import SearchFilters from "@/components/home/SearchFilters";
import CardModal from "@/components/CardModal";
import DonModal from "@/components/DonModal";
import FiltersSidebar from "@/components/FiltersSidebar";

// Componentes críticos - carga inmediata
import StoreCard from "@/components/StoreCard";
import ViewSwitch from "@/components/ViewSwitch";
import SearchResults from "@/components/SearchResults";
import DropdownSearch from "@/components/DropdownSearch";
import { rarityFormatter } from "@/helpers/formatters";
import AlternatesWhite from "@/public/assets/images/variantsICON_VERTICAL_white.svg";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Oswald } from "next/font/google";
import SingleSelect from "@/components/SingleSelect";
import { Option } from "@/components/MultiSelect";
import FAB from "@/components/Fab";
import type { CardsFilters, CardsPage } from "@/lib/cards/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { highlightText } from "@/helpers/functions";
import { ProToggleButton } from "@/components/shared/ProToggleButton";
import { useCardStore } from "@/store/cardStore";
import { useCardsSyncStatus, useAllCards } from "@/hooks/useCards";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { RefreshCw, WifiOff } from "lucide-react";
import ClearFiltersButton from "@/components/ClearFiltersButton";
import { useSession } from "next-auth/react";
import { getOptimizedImageUrl, smartPrefetch } from "@/lib/imageOptimization";
import {
  matchesCardCode,
  baseCardMatches,
  getFilteredAlternates,
} from "@/lib/cardFilters";
import LazyImage from "@/components/LazyImage";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { sortByCollectionOrder } from "@/lib/cards/sort";
import { DON_CATEGORY } from "@/helpers/constants";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const sortOptions: Option[] = [
  { value: "Most variants", label: "Most variants" },
  { value: "Less variants", label: "Less variant" },
  { value: "Ascending code", label: "Ascending code" },
  { value: "Descending code", label: "Descending code" },
  { value: "Price high", label: "Price: high to low" },
  { value: "Price low", label: "Price: low to high" },
];

const NO_COUNTER_LABEL = "No counter";
const NO_TRIGGER_LABEL = "No trigger";

const toLower = (value: string | null | undefined) =>
  value?.toLowerCase().trim() ?? "";

const matchesCardFilters = (
  card: CardWithCollectionData,
  filters: CardsFilters
) => {
  if (!card) return false;

  const {
    search,
    sets,
    setCodes,
    colors,
    rarities,
    categories,
    costs,
    power,
    attributes,
    types,
    effects,
    altArts,
    region,
    counter,
    trigger,
  } = filters;

  if (search) {
    const normalized = search.toLowerCase().trim();
    const codeMatch = matchesCardCode(card.code, search);
    const nameMatch = toLower(card.name).includes(normalized);
    const aliasMatch = toLower(card.alias).includes(normalized);
    const effectMatch =
      card.effects?.some((entry) =>
        toLower(entry.effect).includes(normalized)
      ) ?? false;
    const textMatch =
      card.texts?.some((entry) => toLower(entry.text).includes(normalized)) ??
      false;
    const setMatch =
      card.sets?.some((entry) =>
        toLower(entry.set.title).includes(normalized)
      ) ?? false;

    if (
      !codeMatch &&
      !nameMatch &&
      !aliasMatch &&
      !effectMatch &&
      !textMatch &&
      !setMatch
    ) {
      return false;
    }
  }

  if (sets?.length) {
    const normalizedSets = sets.map((value) => value.toLowerCase());

    // Dividir setCode por comas y verificar si alguno coincide
    const baseSetCodes = (card.setCode ?? "")
      .split(",")
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean);
    const matchesBase = baseSetCodes.some((code) =>
      normalizedSets.includes(code)
    );

    const matchesAlternate =
      card.alternates?.some((alt) => {
        const altSetCodes = (alt.setCode ?? "")
          .split(",")
          .map((code) => code.trim().toLowerCase())
          .filter(Boolean);
        return altSetCodes.some((code) => normalizedSets.includes(code));
      }) ?? false;

    if (!matchesBase && !matchesAlternate) {
      return false;
    }
  }

  if (setCodes?.length) {
    const matchesSelectedCode = setCodes.some((selectedCode) =>
      matchesCardCode(card.code, selectedCode)
    );
    if (!matchesSelectedCode) {
      return false;
    }
  }

  if (colors?.length) {
    const normalizedSelected = colors.map((color) => color.toLowerCase());
    const cardColors =
      card.colors?.map((entry) => toLower(entry.color)).filter(Boolean) ?? [];
    if (!cardColors.some((color) => normalizedSelected.includes(color))) {
      return false;
    }
  }

  if (rarities?.length) {
    const normalized = rarities.map((value) => value.toLowerCase());
    if (!card.rarity || !normalized.includes(toLower(card.rarity))) {
      return false;
    }
  }

  if (categories?.length) {
    const normalized = categories.map((value) => value.toLowerCase());
    if (!normalized.includes(toLower(card.category))) {
      return false;
    }
  }

  if (costs?.length) {
    if (!card.cost || !costs.includes(card.cost)) {
      return false;
    }
  }

  if (power?.length) {
    if (!card.power || !power.includes(card.power)) {
      return false;
    }
  }

  if (attributes?.length) {
    const normalized = attributes.map((value) => value.toLowerCase());
    if (!normalized.includes(toLower(card.attribute))) {
      return false;
    }
  }

  if (types?.length) {
    const normalized = types.map((value) => value.toLowerCase());
    const cardTypes =
      card.types?.map((entry) => toLower(entry.type)).filter(Boolean) ?? [];
    if (!cardTypes.some((type) => normalized.includes(type))) {
      return false;
    }
  }

  if (effects?.length) {
    const normalized = effects.map((value) => value.toLowerCase());
    const cardEffects =
      card.effects?.map((entry) => toLower(entry.effect)).filter(Boolean) ?? [];
    if (!cardEffects.some((effect) => normalized.includes(effect))) {
      return false;
    }
  }

  if (altArts?.length) {
    // La carta debe coincidir si su alternateArt está en el filtro
    // O si alguna de sus alternativas tiene ese alternateArt
    const baseMatches =
      card.alternateArt && altArts.includes(card.alternateArt);
    const hasMatchingAlternate =
      card.alternates?.some(
        (alt) => alt.alternateArt && altArts.includes(alt.alternateArt)
      ) ?? false;

    if (!baseMatches && !hasMatchingAlternate) {
      return false;
    }
  }

  if (region) {
    if (toLower(card.region) !== toLower(region)) {
      return false;
    }
  }

  if (counter) {
    if (
      counter === NO_COUNTER_LABEL
        ? Boolean(card.counter && card.counter.trim().length)
        : !toLower(card.counter).includes(toLower(counter))
    ) {
      return false;
    }
  }

  if (trigger) {
    if (
      trigger === NO_TRIGGER_LABEL
        ? Boolean(card.triggerCard && card.triggerCard.trim().length)
        : toLower(card.triggerCard) !== toLower(trigger)
    ) {
      return false;
    }
  }

  return true;
};

type CardListClientProps = {
  initialData: CardsPage;
  initialFilters: CardsFilters;
};

const CardListClient = ({
  initialData,
  initialFilters,
}: CardListClientProps) => {
  const searchParams = useSearchParams();
  const getArrayParam = useCallback(
    (key: string, fallback: string[] = []) =>
      searchParams.get(key)?.split(",").filter(Boolean) ?? fallback,
    [searchParams]
  );

  const [selectedCard, setSelectedCard] = useState<CardWithCollectionData>();
  const [baseCard, setBaseCard] = useState<CardWithCollectionData>();
  const activeBaseCard = baseCard ?? selectedCard;
  const isDonModal = activeBaseCard?.category === DON_CATEGORY;
  const modalKey = `${isDonModal ? "don" : "card"}-${
    activeBaseCard?.id ?? "modal"
  }`;
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const allCardsSignatureRef = useRef<string | null>(null);

  // Leer estado desde URL params
  const [search, setSearch] = useState(
    searchParams.get("search") ?? initialFilters.search ?? ""
  );
  const [selectedColors, setSelectedColors] = useState<string[]>(
    getArrayParam("colors", initialFilters.colors ?? [])
  );
  const [selectedSets, setSelectedSets] = useState<string[]>(
    getArrayParam("sets", initialFilters.sets ?? [])
  );
  const [selectedRarities, setSelectedRarities] = useState<string[]>(
    getArrayParam("rarities", initialFilters.rarities ?? [])
  );
  const [selectedCosts, setSelectedCosts] = useState<string[]>(
    getArrayParam("costs", initialFilters.costs ?? [])
  );
  const [selectedPower, setSelectedPower] = useState<string[]>(
    getArrayParam("power", initialFilters.power ?? [])
  );
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(
    getArrayParam("attributes", initialFilters.attributes ?? [])
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    getArrayParam("categories", initialFilters.categories ?? [])
  );
  const [selectedEffects, setSelectedEffects] = useState<string[]>(
    getArrayParam("effects", initialFilters.effects ?? [])
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    getArrayParam("types", initialFilters.types ?? [])
  );
  const [selectedCounter, setSelectedCounter] = useState<string>(
    searchParams.get("counter") ?? initialFilters.counter ?? ""
  );
  const [selectedTrigger, setSelectedTrigger] = useState<string>(
    searchParams.get("trigger") ?? initialFilters.trigger ?? ""
  );
  const [selectedSort, setSelectedSort] = useState<string>(
    searchParams.get("sort") ?? ""
  );
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    getArrayParam("codes", [])
  );
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>(
    getArrayParam("altArts", initialFilters.altArts ?? [])
  );
  const [selectedRegion, setSelectedRegion] = useState<string>(
    searchParams.get("region") ?? initialFilters.region ?? ""
  );
  const [viewSelected, setViewSelected] = useState<
    "grid" | "list" | "alternate" | "text"
  >((searchParams.get("view") as any) || "list");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [isProVersion, setIsProVersion] = useState(false);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [alternatesCards, setAlternatesCards] = useState<
    CardWithCollectionData[]
  >([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(-1);

  const { data: session } = useSession();

  // ✅ UI state desde Zustand
  const isFiltersCollapsed = useCardStore((state) => state.isFiltersCollapsed);
  const setIsFiltersCollapsed = useCardStore(
    (state) => state.setIsFiltersCollapsed
  );
  const cachedCards = useCardStore((state) => state.allCards);
  const setAllCards = useCardStore((state) => state.setAllCards);
  const isFullyLoaded = useCardStore((state) => state.isFullyLoaded);
  const setIsFullyLoaded = useCardStore((state) => state.setIsFullyLoaded);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(() => isFullyLoaded);

  // Estado local para animación de refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ✅ OPTIMIZADO: filtros memorizados para llamadas al endpoint paginado
  const filters = useMemo<CardsFilters>(() => {
    return {
      search: search.trim() || undefined,
      sets: selectedSets.length > 0 ? selectedSets : undefined,
      setCodes: selectedCodes.length > 0 ? selectedCodes : undefined,
      colors: selectedColors.length > 0 ? selectedColors : undefined,
      rarities: selectedRarities.length > 0 ? selectedRarities : undefined,
      categories:
        selectedCategories.length > 0 ? selectedCategories : undefined,
      costs: selectedCosts.length > 0 ? selectedCosts : undefined,
      power: selectedPower.length > 0 ? selectedPower : undefined,
      attributes:
        selectedAttributes.length > 0 ? selectedAttributes : undefined,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      effects: selectedEffects.length > 0 ? selectedEffects : undefined,
      altArts: selectedAltArts.length > 0 ? selectedAltArts : undefined,
      region: selectedRegion || undefined,
      counter:
        selectedCounter && selectedCounter !== "No counter"
          ? selectedCounter
          : undefined,
      trigger:
        selectedTrigger && selectedTrigger !== "No trigger"
          ? selectedTrigger
          : undefined,
    };
  }, [
    search,
    selectedCodes,
    selectedSets,
    selectedColors,
    selectedRarities,
    selectedCategories,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedTypes,
    selectedEffects,
    selectedAltArts,
    selectedRegion,
    selectedCounter,
    selectedTrigger,
  ]);

  const fullQueryFilters = useMemo<CardsFilters>(() => ({}), []);
  const initialItems = useMemo(() => initialData?.items ?? [], [initialData]);

  const {
    data: allCardsData,
    isLoading: isLoadingAllCards,
    isFetching: isFetchingAllCards,
    error: allCardsError,
    refetch: refetchAllCards,
    queryKey: allCardsQueryKey,
  } = useAllCards(fullQueryFilters, {
    includeRelations: true,
    includeAlternates: true,
    includeCounts: true,
  });

  useEffect(() => {
    if (allCardsError) {
      console.error("Error al cargar todas las cartas:", allCardsError);
    }
  }, [allCardsError]);

  useEffect(() => {
    if (!allCardsData) return;

    if (!allCardsData.length) {
      if (allCardsSignatureRef.current !== "empty") {
        allCardsSignatureRef.current = "empty";
        setAllCards([]);
      }
      return;
    }

    const firstCard = allCardsData[0];
    const lastCard = allCardsData[allCardsData.length - 1];

    const normalizeTimestamp = (value: Date | string | undefined) => {
      if (!value) return "";
      if (value instanceof Date) return value.getTime().toString();
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? String(value) : parsed.toString();
    };

    const signature = [
      allCardsData.length,
      firstCard?.id ?? "",
      lastCard?.id ?? "",
      normalizeTimestamp(firstCard?.updatedAt),
      normalizeTimestamp(lastCard?.updatedAt),
    ].join("-");

    if (allCardsSignatureRef.current !== signature) {
      allCardsSignatureRef.current = signature;
      setAllCards(allCardsData);
    }

    if (!isFetchingAllCards) {
      setIsFullyLoaded(true);
      setHasCompletedOnce(true);
    }
  }, [allCardsData, isFetchingAllCards, setAllCards, setIsFullyLoaded]);

  const { isSyncing, lastUpdated } = useCardsSyncStatus(allCardsQueryKey);
  const isOnline = useOnlineStatus();

  // ✅ Datos ahora vienen de TanStack Query (arriba)

  const BATCH_SIZE = 200;
  const LOAD_THRESHOLD_PX = 10000;
  const DEFAULT_VISIBLE_COUNT = BATCH_SIZE;
  const SCROLL_RESET_COUNT = BATCH_SIZE;
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const isLoadingMoreRef = useRef(false);

  const handleScrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setVisibleCount(SCROLL_RESET_COUNT);
  }, []);

  const totalFilters = useMemo(
    () =>
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
      selectedAttributes?.length +
      selectedCodes?.length +
      selectedAltArts?.length +
      (selectedRegion !== "" ? 1 : 0),
    [
      selectedColors,
      selectedRarities,
      selectedCategories,
      selectedCounter,
      selectedTrigger,
      selectedEffects,
      selectedTypes,
      selectedCosts,
      selectedPower,
      selectedAttributes,
      selectedSets,
      selectedCodes,
      selectedAltArts,
      selectedRegion,
    ]
  );

  const canUseLocalDataset =
    (hasCompletedOnce || isFullyLoaded) && cachedCards.length > 0;

  const dataSource = useMemo(() => {
    if (canUseLocalDataset && cachedCards.length) {
      return cachedCards;
    }

    if (allCardsData && allCardsData.length) {
      return allCardsData;
    }

    return initialItems;
  }, [canUseLocalDataset, cachedCards, allCardsData, initialItems]);

  const shouldApplyClientFilters =
    canUseLocalDataset || (!!allCardsData && !isFetchingAllCards);

  // ✅ Filtrado local cuando ya tenemos todas las cartas en memoria
const filteredCards = useMemo(() => {
    if (!dataSource) return [];

    const baseList = shouldApplyClientFilters
      ? dataSource.filter((card) => matchesCardFilters(card, filters))
      : dataSource;

    const normalizedCards = baseList.map((card) => {
      // Filtrar alternates pro (client-side porque es específico del usuario)
      if (!isProVersion && card.alternates && card.alternates.length > 0) {
        const filteredAlts = card.alternates.filter(
          (alt) => alt.isPro === false
        );
        if (filteredAlts.length !== card.alternates.length) {
          return { ...card, alternates: filteredAlts };
        }
      }
      return card;
    });

    const sortedCards = [...normalizedCards];

    const getNumericPrice = (price: any) => {
      if (price === null || price === undefined || price === "") return null;
      const value = typeof price === "number" ? price : Number(price);
      return Number.isFinite(value) ? value : null;
    };

    if (selectedSort === "Most variants") {
      sortedCards.sort(
        (a, b) => (b.alternates?.length ?? 0) - (a.alternates?.length ?? 0)
      );
    } else if (selectedSort === "Less variants") {
      sortedCards.sort(
        (a, b) => (a.alternates?.length ?? 0) - (b.alternates?.length ?? 0)
      );
    } else if (selectedSort === "Ascending code") {
      sortedCards.sort((a, b) => a.code.localeCompare(b.code));
    } else if (selectedSort === "Descending code") {
      sortedCards.sort((a, b) => b.code.localeCompare(a.code));
    } else if (selectedSort === "Price high") {
      sortedCards.sort((a, b) => {
        const priceA = getNumericPrice(a.marketPrice ?? a.tcgplayerMarketPrice);
        const priceB = getNumericPrice(b.marketPrice ?? b.tcgplayerMarketPrice);
        if (priceA === null && priceB === null) return 0;
        if (priceA === null) return 1;
        if (priceB === null) return -1;
        return priceB - priceA;
      });
    } else if (selectedSort === "Price low") {
      sortedCards.sort((a, b) => {
        const priceA = getNumericPrice(a.marketPrice ?? a.tcgplayerMarketPrice);
        const priceB = getNumericPrice(b.marketPrice ?? b.tcgplayerMarketPrice);
        if (priceA === null && priceB === null) return 0;
        if (priceA === null) return 1;
        if (priceB === null) return -1;
        return priceA - priceB;
      });
    } else {
      sortedCards.sort(sortByCollectionOrder);
    }

    return sortedCards;
  }, [
    dataSource,
    isProVersion,
    selectedSort,
    shouldApplyClientFilters,
    filters,
    selectedSets,
    selectedAltArts,
    search,
  ]);

  // Calcular el total incluyendo alternativas
  const { totalVisibleCards, uniqueVisibleCards } = useMemo(() => {
    if (!filteredCards.length) {
      return {
        totalVisibleCards: 0,
        uniqueVisibleCards: 0,
      };
    }

    return filteredCards.reduce(
      (acc, card) => {
        const baseVisible = baseCardMatches(
          card,
          selectedSets,
          selectedAltArts
        );
        const filteredAlternates = getFilteredAlternates(
          card,
          selectedSets,
          selectedAltArts
        );
        const alternatesVisible = filteredAlternates.length;

        if (baseVisible) {
          acc.totalVisibleCards += 1;
        }

        if (alternatesVisible > 0) {
          acc.totalVisibleCards += alternatesVisible;
        }

        if (baseVisible || alternatesVisible > 0) {
          acc.uniqueVisibleCards += 1;
        }

        return acc;
      },
      {
        totalVisibleCards: 0,
        uniqueVisibleCards: 0,
      }
    );
  }, [filteredCards, selectedSets, selectedAltArts]);

  // Scroll to top y resetear visibleCount cuando cambien filtros
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setVisibleCount(SCROLL_RESET_COUNT);
    isLoadingMoreRef.current = false;
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
    selectedSort,
    selectedCodes,
    selectedAltArts,
    selectedRegion,
  ]);

  useEffect(() => {
    if (filteredCards.length === 0) {
      setVisibleCount(0);
      isLoadingMoreRef.current = false;
      return;
    }

    if (visibleCount > filteredCards.length) {
      setVisibleCount(filteredCards.length);
    }
    isLoadingMoreRef.current = false;
  }, [filteredCards.length, visibleCount]);

  const shouldShowSkeleton =
    !canUseLocalDataset && !dataSource.length && isLoadingAllCards;

  if (shouldShowSkeleton) {
    return <CardListPageSkeleton />;
  }

  // Mostrar error si falla la carga
  if (allCardsError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">
            Error al cargar cartas
          </h2>
          <p className="text-gray-600">{allCardsError.message}</p>
        </div>
      </div>
    );
  }

  // Funciones de navegación entre cartas principales
  const handleNavigatePrevious = () => {
    if (currentCardIndex > 0) {
      const previousCard = filteredCards[currentCardIndex - 1];
      setBaseCard(previousCard);
      setSelectedCard(previousCard);
      setAlternatesCards(previousCard.alternates || []);
      setCurrentCardIndex(currentCardIndex - 1);
    }
  };

  const handleNavigateNext = () => {
    if (currentCardIndex < filteredCards.length - 1) {
      const nextCard = filteredCards[currentCardIndex + 1];
      setBaseCard(nextCard);
      setSelectedCard(nextCard);
      setAlternatesCards(nextCard.alternates || []);
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const hasPreviousCard = currentCardIndex > 0;
  const hasNextCard = currentCardIndex < filteredCards.length - 1;

  return (
    <div className="bg-[#f2eede] flex-1 overflow-hidden flex flex-col max-h-dvh">
      {/* Header y filtros... */}
      <div className="bg-white w-full">
        {/* Filtros desktop - Colapsables */}
        <div
          className={`justify-center border-b border-[#f5f5f5] px-5 hidden md:flex gap-5 overflow-hidden transition-all duration-300 ease-in-out ${
            isFiltersCollapsed ? "max-h-0 py-0" : "max-h-[500px] py-3"
          }`}
        >
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
            selectedRegion={selectedRegion}
            setSelectedRegion={setSelectedRegion}
            isProVersion={isProVersion}
          />
        </div>

        <div className="flex md:hidden p-3 flex-col gap-3 border-b border-[#f5f5f5]">
          <DropdownSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search..."
          />

          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2 justify-center items-center">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className={`${
                  totalFilters > 0
                    ? "bg-[#2463eb] !text-white"
                    : "bg-gray-100 !text-black"
                } px-4 py-2 text-black font-bold border rounded-lg`}
              >
                Filters
                {totalFilters > 0 && (
                  <Badge className="ml-2 !bg-white !text-[#2463eb] font-bold">
                    {totalFilters}
                  </Badge>
                )}
              </button>
              <ClearFiltersButton
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
                  selectedRegion !== ""
                }
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
                  setSelectedRegion("");
                }}
                isMobile={true}
              />
            </div>

            <div className="flex justify-center items-center gap-2">
              <ViewSwitch
                viewSelected={viewSelected}
                setViewSelected={setViewSelected}
              />
            </div>
          </div>
        </div>

        <Transition show={isModalOpen} as={Fragment}>
          <TransitionChild
            as={Fragment}
            enter="transition transform duration-300"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition transform duration-200"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <FiltersSidebar
              isOpen={isModalOpen}
              setIsOpen={setIsModalOpen}
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
          </TransitionChild>
        </Transition>
      </div>

      <div className="py-2 px-4 border-b bg-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <SearchResults
            count={totalVisibleCards}
            uniqueCount={uniqueVisibleCards}
            showResult={isFullyLoaded || hasCompletedOnce}
          />

          {/* Botón para colapsar/expandir filtros - Solo visible en desktop */}
          <button
            onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all text-gray-700 font-medium text-sm group border border-gray-200"
            aria-label={isFiltersCollapsed ? "Show filters" : "Hide filters"}
          >
            {isFiltersCollapsed ? (
              <>
                <ChevronDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                <span className="hidden lg:inline">Filters</span>
                {totalFilters > 0 && (
                  <Badge className="!bg-[#2463eb] !text-white font-bold text-xs min-w-[20px] h-5 flex items-center justify-center">
                    {totalFilters}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
                <span className="hidden lg:inline">Filters</span>
                {totalFilters > 0 && (
                  <Badge className="!bg-[#2463eb] !text-white font-bold text-xs min-w-[20px] h-5 flex items-center justify-center">
                    {totalFilters}
                  </Badge>
                )}
              </>
            )}
          </button>

          {/* Botón de Refresh Manual */}
          <button
            onClick={async () => {
              setIsRefreshing(true);
              if (canUseLocalDataset) {
                setIsFullyLoaded(false);
              }
              allCardsSignatureRef.current = null;

              try {
                await refetchAllCards();
              } finally {
                setTimeout(() => setIsRefreshing(false), 500);
              }
            }}
            disabled={isRefreshing || isSyncing}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all text-gray-700 font-medium text-sm group border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Refresh cards"
            title={
              lastUpdated
                ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
                : "Refresh"
            }
          >
            <RefreshCw
              className={`h-4 w-4 transition-transform ${
                isRefreshing || isSyncing
                  ? "animate-spin"
                  : "group-hover:rotate-180"
              }`}
            />
            <span className="hidden lg:inline">
              {isSyncing ? "Syncing..." : "Refresh"}
            </span>
          </button>

          {/* Indicador de sincronización en background */}
          {isSyncing && !isRefreshing && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm animate-pulse">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium">Updating...</span>
            </div>
          )}

          {/* Indicador de estado offline */}
          {!isOnline && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-sm">
              <WifiOff className="h-4 w-4" />
              <span className="text-xs font-medium">Offline Mode</span>
            </div>
          )}
        </div>

        <div className="flex flex-row gap-3 items-center">
          {session?.user?.role === "ADMIN" && (
            <ProToggleButton
              isActive={isProVersion}
              onToggle={(value) => setIsProVersion(value)}
            />
          )}
          <SingleSelect
            options={sortOptions}
            selected={selectedSort}
            setSelected={setSelectedSort}
            buttonLabel="Sort by"
            isColor={false}
          />

          <div className="hidden md:flex justify-center items-center">
            <ViewSwitch
              viewSelected={viewSelected}
              setViewSelected={setViewSelected}
            />
          </div>
        </div>
      </div>

      <div
        className="p-3 md:p-5 overflow-y-scroll flex-1"
        ref={scrollContainerRef}
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          const { scrollTop, clientHeight, scrollHeight } = target;
          setShowFab(scrollTop > 100);

          const remaining = scrollHeight - (scrollTop + clientHeight);
          if (
            remaining <= LOAD_THRESHOLD_PX &&
            !isLoadingMoreRef.current &&
            visibleCount < filteredCards.length
          ) {
            isLoadingMoreRef.current = true;
            setVisibleCount((prev) =>
              Math.min(prev + BATCH_SIZE, filteredCards.length)
            );
          }
        }}
      >
        {showFab && <FAB onClick={handleScrollToTop} />}

        {viewSelected === "list" && (
          <div className="grid gap-2 md:gap-3 grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-[repeat(auto-fit,_minmax(250px,_1fr))] justify-items-center">
            {(() => {
              let globalIndex = 0; // Contador global incluyendo alternativas

              return filteredCards
                ?.slice(0, visibleCount)
                .map((card, index) => {
                  const filteredAlts = getFilteredAlternates(
                    card,
                    selectedSets,
                    selectedAltArts
                  );

                  const isBaseMatch = baseCardMatches(
                    card,
                    selectedSets,
                    selectedAltArts
                  );

                  if (!isBaseMatch && filteredAlts.length === 0) return null;

                  const baseCardIndex = globalIndex;
                  if (isBaseMatch) globalIndex++; // Incrementar si mostramos la base

                  return (
                    <Fragment key={card._id || card.id}>
                      {isBaseMatch && (
                        <div
                          onClick={() => {
                            const cardIndex = filteredCards.findIndex(
                              (c) => (c._id || c.id) === (card._id || card.id)
                            );
                            setCurrentCardIndex(cardIndex);
                            setSelectedCard(card);
                            setBaseCard(card);
                            setAlternatesCards(card.alternates);
                            setIsOpen(true);
                          }}
                          onMouseEnter={() =>
                            card.src && smartPrefetch(card.src, "large", true)
                          }
                          onTouchStart={() =>
                            card.src && smartPrefetch(card.src, "large", true)
                          }
                          className="w-full cursor-pointer max-w-[450px]"
                        >
                          <div className="border rounded-lg shadow pb-3 bg-white justify-center items-center flex flex-col">
                            <LazyImage
                              src={card.src}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={card.name}
                              className="w-full"
                              priority={baseCardIndex < 20}
                              size="small"
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex justify-center items-center w-full flex-col">
                                    <span
                                      className={`${oswald.className} text-[13px] font-bold mt-2`}
                                    >
                                      {card.code
                                        ? highlightText(card?.code, search)
                                        : highlightText(card?.name, search)}
                                    </span>
                                    <span className="text-center text-[13px] line-clamp-1">
                                      {highlightText(
                                        card?.sets?.[0]?.set?.title ?? "",
                                        search
                                      )}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {highlightText(
                                      card?.sets?.[0]?.set?.title ?? "",
                                      search
                                    )}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      )}

                      {filteredAlts.map((alt, altIndex) => {
                        const altGlobalIndex = globalIndex++;
                        return (
                          <div
                            key={alt._id || alt.id}
                            onClick={() => {
                              const cardIndex = filteredCards.findIndex(
                                (c) => (c._id || c.id) === (card._id || card.id)
                              );
                              setCurrentCardIndex(cardIndex);
                              setSelectedCard(alt);
                              setBaseCard(card);
                              setAlternatesCards(card.alternates);
                              setIsOpen(true);
                            }}
                            onMouseEnter={() =>
                              alt.src && smartPrefetch(alt.src, "large", true)
                            }
                            onTouchStart={() =>
                              alt.src && smartPrefetch(alt.src, "large", true)
                            }
                            className="w-full cursor-pointer max-w-[450px]"
                          >
                            <div className="border rounded-lg shadow pb-3 bg-white justify-center items-center flex flex-col">
                              <LazyImage
                                src={alt.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={alt.name}
                                className="w-full"
                                priority={altGlobalIndex < 20}
                                size="small"
                              />
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex justify-center items-center w-full flex-col">
                                      <span
                                        className={`${oswald.className} text-[13px] font-bold mt-2`}
                                      >
                                        {card.code
                                          ? highlightText(card?.code, search)
                                          : alt.alias
                                          ? highlightText(alt?.alias, search)
                                          : highlightText(alt?.name, search)}
                                      </span>
                                      <span className="text-center text-[13px] line-clamp-1">
                                        {highlightText(
                                          alt?.sets?.[0]?.set?.title ?? "",
                                          search
                                        )}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {highlightText(
                                        alt?.sets?.[0]?.set?.title ?? "",
                                        search
                                      )}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        );
                      })}
                    </Fragment>
                  );
                });
            })()}
          </div>
        )}

        {viewSelected === "text" && (
          <div className="grid gap-3 lg:gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-[repeat(auto-fit,_minmax(350px,_1fr))] justify-items-center">
            {filteredCards?.slice(0, visibleCount).map((card, index) => {
              const handleCardClick = () => {
                const cardIndex = filteredCards.findIndex(
                  (c) => (c._id || c.id) === (card._id || card.id)
                );
                setCurrentCardIndex(cardIndex);
                setSelectedCard(card);
                setBaseCard(card);
                setAlternatesCards(card.alternates);
                setIsOpen(true);
              };

              return (
                <div key={card._id || card.id} onClick={handleCardClick}>
                  <StoreCard
                    card={card}
                    searchTerm={search}
                    viewSelected={viewSelected}
                    selectedRarities={selectedAltArts}
                    selectedSets={selectedSets}
                    setSelectedCard={setSelectedCard}
                    setBaseCard={setBaseCard}
                    setAlternatesCards={setAlternatesCards}
                    setIsOpen={setIsOpen}
                  />
                </div>
              );
            })}
          </div>
        )}

        {viewSelected === "alternate" && (
          <div className="flex flex-col lg:px-5 lg:py-5 gap-5">
            {(() => {
              let globalIndex = 0;

              return filteredCards
                ?.slice(0, visibleCount)
                .map((card, cardIndex) => {
                  const filteredAlts = getFilteredAlternates(
                    card,
                    selectedSets,
                    selectedAltArts
                  );
                  const isBaseMatch = baseCardMatches(
                    card,
                    selectedSets,
                    selectedAltArts
                  );

                  if (!isBaseMatch && filteredAlts.length === 0) return null;

                  const baseCardIndex = globalIndex;
                  if (isBaseMatch) globalIndex++;

                  return (
                    <div
                      key={card._id || card.id}
                      className="flex flex-col gap-5"
                    >
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-[repeat(auto-fit,_minmax(250px,250px))] mb-3">
                        <Card>
                          <CardContent className="p-5 h-full bg-black rounded-lg text-white justify-start">
                            <div className="h-full flex flex-col justify-around items-center relative">
                              <div className="flex items-center justify-between flex-col mt-4">
                                <h2 className="text-lg font-black break-normal mb-2 text-center leading-tight line-clamp-2">
                                  {highlightText(card?.name, search)}
                                </h2>
                                <p
                                  className={`${oswald.className} text-md text-white leading-[16px] mb-4 font-[400]`}
                                >
                                  {card.category === "DON"
                                    ? card.sets?.[0]?.set?.title
                                    : highlightText(card?.code, search)}
                                </p>
                                <div className="flex justify-between items-end flex-col gap-1 mb-1 mr-1">
                                  <Badge
                                    variant="secondary"
                                    className="text-sm !bg-white text-black rounded-full min-w-[41px] text-center border border-[#000]"
                                  >
                                    <span className="text-center w-full font-black leading-[16px] mb-[2px]">
                                      {card?.rarity
                                        ? rarityFormatter(card.rarity)
                                        : card.category === "DON"
                                        ? "DON!!"
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

                        {isBaseMatch && (
                          <Card
                            onClick={() => {
                              const cardIndex = filteredCards.findIndex(
                                (c) => (c._id || c.id) === (card._id || card.id)
                              );
                              setCurrentCardIndex(cardIndex);
                              setSelectedCard(card);
                              setBaseCard(card);
                              setAlternatesCards(card.alternates);
                              setIsOpen(true);
                            }}
                            onMouseEnter={() =>
                              card.src && smartPrefetch(card.src, "large", true)
                            }
                            onTouchStart={() =>
                              card.src && smartPrefetch(card.src, "large", true)
                            }
                            className="cursor-pointer"
                          >
                            <CardContent className="flex items-center pb-4 pl-0 pt-0 pr-0 flex-col h-full">
                              <div className="flex justify-center items-center w-full">
                                <LazyImage
                                  src={card?.src}
                                  fallbackSrc="/assets/images/backcard.webp"
                                  alt={card?.name}
                                  className="w-[80%] m-auto"
                                  priority={baseCardIndex < 20}
                                  size="small"
                                />
                              </div>
                              <div>
                                <div className="text-center font-bold mt-2">
                                  Base
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

                        {filteredAlts.map((alt) => {
                          const altGlobalIndex = globalIndex++;
                          return (
                            <Card
                              key={alt._id || alt.id}
                              onClick={() => {
                                const cardIndex = filteredCards.findIndex(
                                  (c) =>
                                    (c._id || c.id) === (card._id || card.id)
                                );
                                setCurrentCardIndex(cardIndex);
                                setSelectedCard(alt);
                                setBaseCard(card);
                                setAlternatesCards(card.alternates);
                                setIsOpen(true);
                              }}
                              onMouseEnter={() =>
                                alt.src && smartPrefetch(alt.src, "large", true)
                              }
                              onTouchStart={() =>
                                alt.src && smartPrefetch(alt.src, "large", true)
                              }
                              className="cursor-pointer"
                            >
                              <CardContent className="flex items-center pb-4 pl-0 pt-0 pr-0 flex-col h-full">
                                <div className="flex justify-center items-center w-full">
                                  <LazyImage
                                    src={alt?.src}
                                    fallbackSrc="/assets/images/backcard.webp"
                                    alt={alt?.name}
                                    className="w-[80%] m-auto"
                                    priority={altGlobalIndex < 20}
                                    size="small"
                                  />
                                </div>
                                <div>
                                  <div className="text-center font-bold mt-2">
                                    {card.category === "DON"
                                      ? alt?.alias
                                      : alt?.alternateArt}
                                  </div>
                                  {alt?.sets?.map((set) => (
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
                          );
                        })}
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        )}
      </div>

      {/* Modales... */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          static
          open={isOpen}
          onClose={() => {
            // No hacer nada aquí - prevenir cierre automático
            // El cierre se maneja manualmente en el onClick del backdrop y botón X
          }}
          ref={modalRef}
        >
          <div
            className="fixed inset-0 flex w-screen items-center justify-center p-4 transition-all duration-500 ease-in-out bg-black/60"
            onClick={(e) => {
              // Solo cerrar si se hace click en el backdrop, no en los botones o el DialogPanel
              if (e.target === e.currentTarget && !showLargeImage) {
                setIsOpen(false);
              }
            }}
          >
            {/* Botones de navegación - Mobile/Tablet (en los bordes de la pantalla) */}
            {hasPreviousCard && (
              <button
                type="button"
                className="flex lg:hidden absolute left-0 top-1/2 -translate-y-1/2 z-[60] p-3 bg-white/95 hover:bg-white text-black rounded-full h-14 w-14 shadow-xl items-center justify-center border-2 border-gray-300 transition-all active:scale-95 focus:outline-none"
                aria-label="Previous card"
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigatePrevious();
                }}
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}

            {hasNextCard && (
              <button
                type="button"
                className="flex lg:hidden absolute right-0 top-1/2 -translate-y-1/2 z-[60] p-3 bg-white/95 hover:bg-white text-black rounded-full h-14 w-14 shadow-xl items-center justify-center border-2 border-gray-300 transition-all active:scale-95 focus:outline-none"
                aria-label="Next card"
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigateNext();
                }}
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            )}

            {/* Contenedor relativo para posicionar botones desktop cerca del modal */}
            <div className="relative w-full max-w-4xl">
              {/* Botones de navegación - Desktop (cerca del modal) */}
              {hasPreviousCard && (
                <button
                  type="button"
                  className="hidden lg:flex absolute -left-20 top-1/2 -translate-y-1/2 z-[60] bg-white hover:bg-gray-100 text-black rounded-full p-0 h-16 w-16 shadow-2xl items-center justify-center border-2 border-gray-200 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Previous card"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigatePrevious();
                  }}
                >
                  <ChevronLeft className="h-9 w-9" />
                </button>
              )}

              {hasNextCard && (
                <button
                  type="button"
                  className="hidden lg:flex absolute -right-20 top-1/2 -translate-y-1/2 z-[60] bg-white hover:bg-gray-100 text-black rounded-full p-0 h-16 w-16 shadow-2xl items-center justify-center border-2 border-gray-200 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Next card"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigateNext();
                  }}
                >
                  <ChevronRight className="h-9 w-9" />
                </button>
              )}

              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave=""
                leaveFrom=""
                leaveTo=""
              >
                <DialogPanel className="w-full space-y-4 bg-white shadow-xl border transform transition-all rounded-lg">
                  {activeBaseCard ? (
                    isDonModal ? (
                      <DonModal
                        key={modalKey}
                        selectedCard={selectedCard}
                        setIsOpen={setIsOpen}
                        alternatesCards={alternatesCards}
                        setSelectedCard={setSelectedCard}
                        baseCard={activeBaseCard}
                        onNavigatePrevious={handleNavigatePrevious}
                        onNavigateNext={handleNavigateNext}
                      />
                    ) : (
                      <CardModal
                        key={modalKey}
                        selectedCard={selectedCard}
                        setIsOpen={setIsOpen}
                        alternatesCards={alternatesCards}
                        setSelectedCard={setSelectedCard}
                        baseCard={activeBaseCard}
                        isCardFetching={false}
                        setShowLargeImage={setShowLargeImage}
                        showLargeImage={showLargeImage}
                        onNavigatePrevious={handleNavigatePrevious}
                        onNavigateNext={handleNavigateNext}
                      />
                    )
                  ) : null}
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {showLargeImage && selectedCard && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto cursor-pointer"
          onClick={() => setShowLargeImage(false)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setShowLargeImage(false);
          }}
        >
          <div className="w-full max-w-3xl pointer-events-none">
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              Tap to close
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={getOptimizedImageUrl(selectedCard.src, "large")}
                className="max-w-full max-h-[calc(100dvh-130px)] object-contain"
                alt={selectedCard.name}
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                <span className={`${oswald.className} font-[500]`}>
                  {selectedCard.code}
                </span>
                <br />
                <span>{selectedCard.set}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardListClient;
