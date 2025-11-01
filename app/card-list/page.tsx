"use client";

import React, {
  useEffect,
  useState,
  Fragment,
  useRef,
  useMemo,
  useCallback,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import StoreCard from "@/components/StoreCard";
import ViewSwitch from "@/components/ViewSwitch";
import SearchResults from "@/components/SearchResults";
import FiltersSidebar from "@/components/FiltersSidebar";
import DropdownSearch from "@/components/DropdownSearch";
import { rarityFormatter } from "@/helpers/formatters";
import AlternatesWhite from "@/public/assets/images/variantsICON_VERTICAL_white.svg";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Oswald } from "next/font/google";
import SingleSelect from "@/components/SingleSelect";
import { Option } from "@/components/MultiSelect";
import FAB from "@/components/Fab";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { highlightText } from "@/helpers/functions";
import { ProToggleButton } from "@/components/shared/ProToggleButton";
import { useCardStore } from "@/store/cardStore";
import {
  useCards,
  useRefreshCards,
  useCardsSyncStatus,
} from "@/hooks/useCards";
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

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const sortOptions: Option[] = [
  { value: "Most variants", label: "Most variants" },
  { value: "Less variants", label: "Less variant" },
  { value: "Ascending code", label: "Ascending code" },
  { value: "Descending code", label: "Descending code" },
];

const Home = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [selectedCard, setSelectedCard] = useState<CardWithCollectionData>();
  const [baseCard, setBaseCard] = useState<CardWithCollectionData>();
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Leer estado desde URL params
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedColors, setSelectedColors] = useState<string[]>(
    searchParams.get("colors")?.split(",").filter(Boolean) || []
  );
  const [selectedSets, setSelectedSets] = useState<string[]>(
    searchParams.get("sets")?.split(",").filter(Boolean) || []
  );
  const [selectedRarities, setSelectedRarities] = useState<string[]>(
    searchParams.get("rarities")?.split(",").filter(Boolean) || []
  );
  const [selectedCosts, setSelectedCosts] = useState<string[]>(
    searchParams.get("costs")?.split(",").filter(Boolean) || []
  );
  const [selectedPower, setSelectedPower] = useState<string[]>(
    searchParams.get("power")?.split(",").filter(Boolean) || []
  );
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(
    searchParams.get("attributes")?.split(",").filter(Boolean) || []
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get("categories")?.split(",").filter(Boolean) || []
  );
  const [selectedEffects, setSelectedEffects] = useState<string[]>(
    searchParams.get("effects")?.split(",").filter(Boolean) || []
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    searchParams.get("types")?.split(",").filter(Boolean) || []
  );
  const [selectedCounter, setSelectedCounter] = useState<string>(
    searchParams.get("counter") || ""
  );
  const [selectedTrigger, setSelectedTrigger] = useState<string>(
    searchParams.get("trigger") || ""
  );
  const [selectedSort, setSelectedSort] = useState<string>(
    searchParams.get("sort") || ""
  );
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    searchParams.get("codes")?.split(",").filter(Boolean) || []
  );
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>(
    searchParams.get("altArts")?.split(",").filter(Boolean) || []
  );
  const [selectedRegion, setSelectedRegion] = useState<string>(
    searchParams.get("region") || ""
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

  // ✅ OPTIMIZADO: Usar TanStack Query para datos de cartas
  const { data: cards, isLoading, error, isFetching } = useCards();
  const refreshCards = useRefreshCards();
  const { isSyncing, lastUpdated } = useCardsSyncStatus();
  const isOnline = useOnlineStatus();

  // ✅ UI state desde Zustand
  const { isFiltersCollapsed, setIsFiltersCollapsed } = useCardStore();

  // Estado local para animación de refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  // Debounce search para evitar filtrados costosos en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Función para actualizar URL params
  const updateURLParams = useCallback(() => {
    const params = new URLSearchParams();

    if (debouncedSearch) params.set("search", debouncedSearch);
    if (selectedColors.length) params.set("colors", selectedColors.join(","));
    if (selectedSets.length) params.set("sets", selectedSets.join(","));
    if (selectedRarities.length)
      params.set("rarities", selectedRarities.join(","));
    if (selectedCosts.length) params.set("costs", selectedCosts.join(","));
    if (selectedPower.length) params.set("power", selectedPower.join(","));
    if (selectedAttributes.length)
      params.set("attributes", selectedAttributes.join(","));
    if (selectedCategories.length)
      params.set("categories", selectedCategories.join(","));
    if (selectedEffects.length)
      params.set("effects", selectedEffects.join(","));
    if (selectedTypes.length) params.set("types", selectedTypes.join(","));
    if (selectedCounter) params.set("counter", selectedCounter);
    if (selectedTrigger) params.set("trigger", selectedTrigger);
    if (selectedSort) params.set("sort", selectedSort);
    if (selectedCodes.length) params.set("codes", selectedCodes.join(","));
    if (selectedAltArts.length)
      params.set("altArts", selectedAltArts.join(","));
    if (selectedRegion) params.set("region", selectedRegion);
    if (viewSelected !== "list") params.set("view", viewSelected);

    const queryString = params.toString();
    router.push(`/card-list${queryString ? `?${queryString}` : ""}`, {
      scroll: false,
    });
  }, [
    router,
    debouncedSearch,
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
    viewSelected,
  ]);

  // ✅ Datos ahora vienen de TanStack Query (arriba)

  // Renderizado progresivo adaptativo según conexión
  const getInitialCount = () => {
    const nav = navigator as any;
    const connection =
      nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    const effectiveType = connection?.effectiveType;

    // Ajustar cantidad inicial según velocidad de conexión
    if (effectiveType === "4g") return 48;
    if (effectiveType === "3g") return 24;
    if (effectiveType === "2g") return 12;
    return 36; // Default más agresivo
  };

  const [visibleCount, setVisibleCount] = useState(getInitialCount());

  const handleScrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setVisibleCount(24);
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
      selectedAttributes?.length,
    [
      selectedColors,
      selectedRarities,
      selectedCategories,
      selectedCounter,
      selectedTrigger,
      selectedEffects,
      selectedTypes,
      selectedSets,
      selectedCosts,
      selectedPower,
      selectedAttributes,
    ]
  );

  // Filtrado client-side completo (todas las cartas en memoria)
  const filteredCards = useMemo(() => {
    if (!cards) return [];

    const searchLower = debouncedSearch.trim().toLowerCase();
    const hasSearch = searchLower.length > 0;

    return cards
      .filter((card) => {
        // Early returns - filtros baratos primero
        if (selectedCodes?.length > 0 && !selectedCodes.includes(card.setCode))
          return false;
        if (
          selectedCosts.length > 0 &&
          !selectedCosts.includes(card.cost ?? "")
        )
          return false;
        if (
          selectedPower.length > 0 &&
          !selectedPower.includes(card.power ?? "")
        )
          return false;
        if (
          selectedCategories.length > 0 &&
          !selectedCategories.includes(card.category ?? "")
        )
          return false;
        if (
          selectedAttributes.length > 0 &&
          !selectedAttributes.includes(card.attribute ?? "")
        )
          return false;
        if (
          selectedRarities?.length > 0 &&
          !selectedRarities.includes(card.rarity ?? "")
        )
          return false;

        if (selectedCounter !== "") {
          if (selectedCounter === "No counter" && card.counter != null)
            return false;
          if (
            selectedCounter !== "No counter" &&
            !card.counter?.includes(selectedCounter)
          )
            return false;
        }

        if (selectedTrigger !== "") {
          if (selectedTrigger === "No trigger" && card.triggerCard !== null)
            return false;
          if (selectedTrigger !== "No trigger" && card.triggerCard === null)
            return false;
        }

        // Búsqueda (en todos los campos)
        if (hasSearch) {
          const matchesSearch =
            card.name.toLowerCase().includes(searchLower) ||
            (card.power ?? "").toLowerCase().includes(searchLower) ||
            (card.cost ?? "").toLowerCase().includes(searchLower) ||
            (card.attribute ?? "").toLowerCase().includes(searchLower) ||
            (card.rarity ?? "").toLowerCase().includes(searchLower) ||
            matchesCardCode(card.code, debouncedSearch) ||
            (card.texts ?? []).some((item) =>
              item.text.toLowerCase().includes(searchLower)
            ) ||
            (card.types ?? []).some((item) =>
              item.type.toLowerCase().includes(searchLower)
            ) ||
            (card.sets ?? []).some((item) =>
              item.set.title.toLowerCase().includes(searchLower)
            );
          if (!matchesSearch) return false;
        }

        // Filtros de arrays
        if (selectedColors?.length > 0) {
          if (
            !card.colors.some((col) =>
              selectedColors.includes(col.color.toLowerCase())
            )
          )
            return false;
        }

        if (selectedTypes?.length > 0) {
          if (!card.types.some((type) => selectedTypes.includes(type.type)))
            return false;
        }

        if (selectedEffects?.length > 0) {
          if (
            !(card.effects ?? []).some((effect) =>
              selectedEffects.includes(effect.effect)
            )
          )
            return false;
        }

        // Filtros costosos (alternates)
        if (selectedSets?.length > 0) {
          const matchesMainSets = card.sets.some((set) =>
            selectedSets.includes(set.set.title)
          );
          const matchesAltSets = (card.alternates ?? []).some((alt) =>
            alt.sets.some((set) => selectedSets.includes(set.set.title))
          );
          if (!matchesMainSets && !matchesAltSets) return false;
        }

        if (selectedAltArts?.length > 0) {
          if (
            !(card.alternates ?? []).some((alt) =>
              selectedAltArts.includes(alt.alternateArt ?? "")
            )
          )
            return false;
        }

        if (selectedRegion !== "") {
          if (!card.alternates?.some((alt) => alt.region === selectedRegion))
            return false;
        }

        return true;
      })
      .map((card) => {
        // Filtrar alternates pro
        if (!isProVersion && card.alternates && card.alternates.length > 0) {
          const filteredAlts = card.alternates.filter(
            (alt) => alt.isPro === false
          );
          if (filteredAlts.length !== card.alternates.length) {
            return { ...card, alternates: filteredAlts };
          }
        }
        return card;
      })
      .sort((a, b) => {
        if (selectedSort === "Most variants") {
          return (b.alternates?.length ?? 0) - (a.alternates?.length ?? 0);
        } else if (selectedSort === "Less variants") {
          return (a.alternates?.length ?? 0) - (b.alternates?.length ?? 0);
        } else if (selectedSort === "Ascending code") {
          return a.code.localeCompare(b.code);
        } else if (selectedSort === "Descending code") {
          return b.code.localeCompare(a.code);
        }
        return 0;
      });
  }, [
    cards,
    isProVersion,
    debouncedSearch,
    selectedColors,
    selectedSets,
    selectedTypes,
    selectedEffects,
    selectedRarities,
    selectedAltArts,
    selectedCosts,
    selectedPower,
    selectedCategories,
    selectedAttributes,
    selectedCounter,
    selectedTrigger,
    selectedCodes,
    selectedRegion,
    selectedSort,
  ]);

  // Actualizar URL cuando cambien los filtros
  useEffect(() => {
    updateURLParams();
  }, [updateURLParams]);

  // IntersectionObserver para infinite scroll (solo aumenta visibleCount)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredCards.length) {
          setVisibleCount((prev) => Math.min(prev + 48, filteredCards.length));
        }
      },
      { rootMargin: "1000px" }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) observer.unobserve(sentinelRef.current);
    };
  }, [visibleCount, filteredCards.length]);

  // Scroll to top y resetear visibleCount cuando cambien filtros
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setVisibleCount(24);
  }, [
    viewSelected,
    debouncedSearch,
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
  ]);

  // ✅ OPTIMIZADO: TanStack Query maneja loading automáticamente
  if (isLoading || !cards) {
    return <CardListPageSkeleton />;
  }

  // Mostrar error si falla la carga
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">
            Error al cargar cartas
          </h2>
          <p className="text-gray-600">{error.message}</p>
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
    <div
      className="bg-[#f2eede] flex-1 overflow-hidden flex flex-col max-h-dvh"
      style={{
        backgroundImage: "url('/assets/images/Map_15.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
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
                  selectedCodes.length > 0
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

        <Transition
          show={isModalOpen}
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
          />
        </Transition>
      </div>

      <div className="py-2 px-4 border-b bg-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <SearchResults count={filteredCards?.length ?? 0} />

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
              await refreshCards();
              setTimeout(() => setIsRefreshing(false), 500);
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
          const scrollTop = (e.target as HTMLDivElement).scrollTop;
          setShowFab(scrollTop > 100);
        }}
      >
        {showFab && <FAB onClick={handleScrollToTop} />}

        {viewSelected === "list" && (
          <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-[repeat(auto-fit,_minmax(250px,_1fr))] justify-items-center">
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
                            smartPrefetch(card.src, "large", true)
                          }
                          onTouchStart={() =>
                            smartPrefetch(card.src, "large", true)
                          }
                          className="w-full cursor-pointer max-w-[450px]"
                        >
                          <div className="border rounded-lg shadow p-3 bg-white justify-center items-center flex flex-col">
                            <LazyImage
                              src={card.src}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={card.name}
                              className="w-full"
                              priority={baseCardIndex < 20}
                              size="thumb"
                              enableBlurPlaceholder={true}
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex justify-center items-center w-full flex-col">
                                    <span
                                      className={`${oswald.className} text-[13px] font-bold mt-2`}
                                    >
                                      {highlightText(card?.code, search)}
                                    </span>
                                    <span className="text-center text-[13px] line-clamp-1">
                                      {highlightText(
                                        card?.sets[0].set?.title,
                                        search
                                      )}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {highlightText(
                                      card?.sets[0].set?.title,
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
                              smartPrefetch(alt.src, "large", true)
                            }
                            onTouchStart={() =>
                              smartPrefetch(alt.src, "large", true)
                            }
                            className="w-full cursor-pointer max-w-[450px]"
                          >
                            <div className="border rounded-lg shadow p-3 bg-white justify-center items-center flex flex-col">
                              <LazyImage
                                src={alt.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={alt.name}
                                className="w-full"
                                priority={altGlobalIndex < 20}
                                size="thumb"
                                enableBlurPlaceholder={true}
                              />
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex justify-center items-center w-full flex-col">
                                      <span
                                        className={`${oswald.className} text-[13px] font-bold mt-2`}
                                      >
                                        {highlightText(alt?.code, search)}
                                      </span>
                                      <span className="text-center text-[13px] line-clamp-1">
                                        {highlightText(
                                          alt?.sets[0].set?.title,
                                          search
                                        )}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {highlightText(
                                        alt?.sets[0].set?.title,
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
                              smartPrefetch(card.src, "large", true)
                            }
                            onTouchStart={() =>
                              smartPrefetch(card.src, "large", true)
                            }
                            className="cursor-pointer"
                          >
                            <CardContent className="flex justify-center items-center p-4 flex-col h-full">
                              <div className="flex justify-center items-center w-full">
                                <LazyImage
                                  src={card?.src}
                                  fallbackSrc="/assets/images/backcard.webp"
                                  alt={card?.name}
                                  className="w-[80%] m-auto"
                                  priority={baseCardIndex < 20}
                                  size="small"
                                  enableBlurPlaceholder={true}
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
                                smartPrefetch(alt.src, "large", true)
                              }
                              onTouchStart={() =>
                                smartPrefetch(alt.src, "large", true)
                              }
                              className="cursor-pointer"
                            >
                              <CardContent className="flex justify-center items-center p-4 flex-col h-full">
                                <div className="flex justify-center items-center w-full">
                                  <LazyImage
                                    src={alt?.src}
                                    fallbackSrc="/assets/images/backcard.webp"
                                    alt={alt?.name}
                                    className="w-[80%] m-auto"
                                    priority={altGlobalIndex < 20}
                                    size="small"
                                    enableBlurPlaceholder={true}
                                  />
                                </div>
                                <div>
                                  <div className="text-center font-bold mt-2">
                                    {alt?.alternateArt}
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

        {viewSelected === "grid" && (
          <div className="grid gap-3 grid-cols-1 justify-items-center">
            {(() => {
              let globalIndex = 0;

              return filteredCards?.slice(0, visibleCount).map((card) => {
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
                  <Fragment key={card._id || card.id}>
                    {isBaseMatch && (
                      <div
                        className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit mb-3"
                        onClick={() => {
                          const cardIndex = filteredCards.findIndex(
                            (c) => c.id === card.id
                          );
                          setCurrentCardIndex(cardIndex);
                          setSelectedCard(card);
                          setBaseCard(card);
                          setAlternatesCards(card.alternates);
                          setIsOpen(true);
                        }}
                        onMouseEnter={() =>
                          smartPrefetch(card.src, "large", true)
                        }
                        onTouchStart={() =>
                          smartPrefetch(card.src, "large", true)
                        }
                      >
                        <LazyImage
                          src={card.src}
                          fallbackSrc="/assets/images/backcard.webp"
                          alt={card?.name}
                          className="w-full"
                          priority={baseCardIndex < 20}
                          size="thumb"
                          enableBlurPlaceholder={true}
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex justify-center items-center w-full flex-col">
                                <span
                                  className={`${oswald.className} text-[13px] font-[500] mt-1`}
                                >
                                  {card.code}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{card.sets?.[0]?.set?.title}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}

                    {filteredAlts.map((alt) => {
                      const altGlobalIndex = globalIndex++;
                      return (
                        <div
                          key={alt._id || alt.id}
                          className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit mb-3"
                          onClick={() => {
                            const cardIndex = filteredCards.findIndex(
                              (c) => c.id === card.id
                            );
                            setCurrentCardIndex(cardIndex);
                            setSelectedCard(alt);
                            setBaseCard(card);
                            setAlternatesCards(card.alternates);
                            setIsOpen(true);
                          }}
                          onMouseEnter={() =>
                            smartPrefetch(alt.src, "large", true)
                          }
                          onTouchStart={() =>
                            smartPrefetch(alt.src, "large", true)
                          }
                        >
                          <LazyImage
                            src={alt.src}
                            fallbackSrc="/assets/images/backcard.webp"
                            alt={alt?.name}
                            className="w-full"
                            priority={altGlobalIndex < 20}
                            size="thumb"
                            enableBlurPlaceholder={true}
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex justify-center items-center w-full flex-col">
                                  <span
                                    className={`${oswald.className} text-[13px] font-[500] mt-1`}
                                  >
                                    {card.code}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{alt.sets?.[0]?.set?.title}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      );
                    })}
                  </Fragment>
                );
              });
            })()}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {visibleCount < filteredCards.length && (
          <div ref={sentinelRef} className="h-1" />
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
                  <CardModal
                    key={baseCard?.id} // Forzar re-render cuando cambia la carta principal
                    selectedCard={selectedCard}
                    setIsOpen={setIsOpen}
                    alternatesCards={alternatesCards}
                    setSelectedCard={setSelectedCard}
                    baseCard={baseCard as CardWithCollectionData}
                    isCardFetching={false}
                    setShowLargeImage={setShowLargeImage}
                    showLargeImage={showLargeImage}
                    onNavigatePrevious={handleNavigatePrevious}
                    onNavigateNext={handleNavigateNext}
                  />
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

function HomeWithSuspense() {
  return (
    <Suspense fallback={<CardListPageSkeleton />}>
      <Home />
    </Suspense>
  );
}

export default HomeWithSuspense;
