"use client";

import {
  Fragment,
  useState,
  useRef,
  MouseEvent,
  useEffect,
  useMemo,
} from "react";
import {
  RotateCcw,
  Layers,
  Minus,
  Plus,
  SlidersHorizontal,
  X,
  Printer,
  Eye,
} from "lucide-react";
import { Oswald } from "next/font/google";
import { CardWithCollectionData } from "@/types";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import LazyImage from "@/components/LazyImage";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import { generateProxySheetPdf } from "@/lib/print/generateProxySheetPdf";
import { DeckCard } from "@/types";
import SortSelect, { SortOption } from "../SortSelect";
import BaseCardsToggle from "../BaseCardsToggle";
import DropdownSearch from "../DropdownSearch";
import {
  Dialog as HeadlessDialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import FiltersSidebar from "@/components/FiltersSidebar";
import CardModal from "@/components/CardModal";
import ProxyCardPreviewDrawer from "./ProxyCardPreviewDrawer";
import ProxiesDrawer from "./ProxiesDrawer";
import type { CardsFilters, CardsPage } from "@/lib/cards/types";
import {
  usePaginatedCards,
  useCardsCount,
  serializeFiltersForKey,
} from "@/hooks/useCards";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useRegion } from "@/components/region/RegionProvider";
import { DEFAULT_REGION } from "@/lib/regions";
import { usePrintQueueStore } from "@/store/printQueueStore";
import PrintLanguageToggle from "@/components/print-queue/PrintLanguageToggle";

const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "700"] });

const PAGE_SIZE = 60;


interface ProxiesBuilderProps {
  initialData: CardsPage;
  initialFilters: CardsFilters;
}

const ProxiesBuilder = ({
  initialData,
  initialFilters,
}: ProxiesBuilderProps) => {
  const { t } = useI18n();
  const { region } = useRegion();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const printLanguage = usePrintQueueStore((state) => state.printLanguage);
  const setPrintLanguage = usePrintQueueStore(
    (state) => state.setPrintLanguage
  );

  const [proxies, setProxies] = useState<DeckCard[]>([]);
  const [search, setSearch] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<string>("");
  const [selectedTrigger, setSelectedTrigger] = useState<string>("");

  const normalizedSelectedSets = useMemo(
    () => selectedSets.map((value) => value.toLowerCase()),
    [selectedSets]
  );

  const [selectedSort, setSelectedSort] = useState<string>("");
  const [showOnlyBaseCards, setShowOnlyBaseCards] = useState(false);

  const sortOptions = useMemo<SortOption[]>(
    () => [
      {
        value: "code_asc",
        label: t("sort.codeAsc"),
        description: t("sort.codeAscDesc"),
      },
      {
        value: "code_desc",
        label: t("sort.codeDesc"),
        description: t("sort.codeDescDesc"),
      },
      {
        value: "name_asc",
        label: t("sort.nameAsc"),
        description: t("sort.nameAscDesc"),
      },
      {
        value: "name_desc",
        label: t("sort.nameDesc"),
        description: t("sort.nameDescDesc"),
      },
    ],
    [t]
  );

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Build filters for the paginated API
  const filters = useMemo<CardsFilters>(() => {
    // Map selectedSort to backend sortBy format
    const sortBy = selectedSort
      ? (selectedSort as CardsFilters["sortBy"])
      : undefined;

    // Exclude DON cards when sorting is applied (unless user explicitly filters by DON category)
    const shouldExcludeDON = sortBy && selectedCategories.length === 0;

    return {
      search: search.trim() || undefined,
      sets: selectedSets.length > 0 ? selectedSets : undefined,
      setCodes: selectedCodes.length > 0 ? selectedCodes : undefined,
      colors: selectedColors.length > 0 ? selectedColors : undefined,
      rarities: selectedRarities.length > 0 ? selectedRarities : undefined,
      categories:
        selectedCategories.length > 0 ? selectedCategories : undefined,
      excludeCategories: shouldExcludeDON ? ["DON"] : undefined,
      costs: selectedCosts.length > 0 ? selectedCosts : undefined,
      power: selectedPower.length > 0 ? selectedPower : undefined,
      attributes:
        selectedAttributes.length > 0 ? selectedAttributes : undefined,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      effects: selectedEffects.length > 0 ? selectedEffects : undefined,
      altArts: selectedAltArts.length > 0 ? selectedAltArts : undefined,
      counter:
        selectedCounter && selectedCounter !== "No counter"
          ? selectedCounter
          : undefined,
      trigger:
        selectedTrigger && selectedTrigger !== "No trigger"
          ? selectedTrigger
          : undefined,
      region,
      sortBy,
      // When showOnlyBaseCards is active, filter bases on server
      baseOnly: showOnlyBaseCards ? true : undefined,
    };
  }, [
    search,
    selectedSets,
    selectedCodes,
    selectedColors,
    selectedRarities,
    selectedCategories,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedTypes,
    selectedEffects,
    selectedAltArts,
    selectedCounter,
    selectedTrigger,
    selectedSort,
    showOnlyBaseCards,
    region,
  ]);

  // Check if current filters match initial filters for using SSR data
  const filtersSignature = useMemo(
    () => serializeFiltersForKey(filters),
    [filters]
  );
  const initialFiltersSignatureRef = useRef<string | null>(null);
  if (initialFiltersSignatureRef.current === null) {
    initialFiltersSignatureRef.current = filtersSignature;
  }
  const matchesInitialFilters =
    initialFiltersSignatureRef.current === filtersSignature;

  // Prepare initial data for the hook
  const initialQueryData = useMemo(() => {
    if (!initialData || !matchesInitialFilters) return undefined;
    if (region !== DEFAULT_REGION) return undefined;
    return {
      pages: [initialData],
      pageParams: [null],
    };
  }, [initialData, matchesInitialFilters, region]);

  // Use paginated cards hook
  const {
    cards: paginatedCards,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isLoading,
    totalCount,
  } = usePaginatedCards(filters, {
    limit: PAGE_SIZE,
    initialData: initialQueryData,
  });

  // Get total count from database with filters
  const { data: countData, isFetching: isCounting } = useCardsCount(filters);

  // Get cards from paginated data or initial data
  const allCards = useMemo(() => {
    if (paginatedCards?.length) {
      return paginatedCards;
    }
    if (matchesInitialFilters) {
      return initialData?.items ?? [];
    }
    return [];
  }, [paginatedCards, initialData, matchesInitialFilters]);

  // Drawer states
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [selectedFullCard, setSelectedFullCard] =
    useState<CardWithCollectionData | null>(null);
  const [selectedBaseCard, setSelectedBaseCard] =
    useState<CardWithCollectionData | null>(null);
  const [isCardDrawerOpen, setIsCardDrawerOpen] = useState(false);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isProxiesDrawerOpen, setIsProxiesDrawerOpen] = useState(false);

  const getNumericPrice = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === "") return null;
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const getCardPriceValue = (card: CardWithCollectionData) => {
    return (
      getNumericPrice(card.marketPrice) ??
      getNumericPrice(card.alternates?.[0]?.marketPrice) ??
      null
    );
  };

  const formatCurrency = (value: number, currency?: string | null) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(value);

  const totalFilters =
    selectedColors.length +
    selectedRarities.length +
    selectedCategories.length +
    (selectedCounter !== "" ? 1 : 0) +
    (selectedTrigger !== "" ? 1 : 0) +
    selectedEffects.length +
    selectedTypes.length +
    selectedSets.length +
    selectedCosts.length +
    selectedPower.length +
    selectedAttributes.length +
    selectedCodes.length +
    selectedAltArts.length;

  const clearFilters = () => {
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
  };

  // Handle card click - add to proxies
  const handleCardClick = (
    e: MouseEvent<HTMLDivElement>,
    card: CardWithCollectionData,
    alternate: CardWithCollectionData
  ) => {
    const existingCardIndex = proxies.findIndex(
      (proxy) => proxy.cardId === Number(alternate.id)
    );

    if (existingCardIndex !== -1) {
      setProxies((prev) =>
        prev.map((proxy, index) =>
          index === existingCardIndex
            ? { ...proxy, quantity: proxy.quantity + 1 }
            : proxy
        )
      );
    } else {
      setProxies((prev) => [
        ...prev,
        {
          cardId: Number(alternate.id),
          id: Number(alternate.id),
          name: card.name,
          rarity: card.rarity ?? "",
          src: alternate.src,
          quantity: 1,
          code: card.code,
          color: card.colors.length ? card.colors[0].color : "gray",
          colors: card.colors,
          cost: card.cost ?? "",
          category: card.category,
          set: card.sets[0]?.set?.title ?? "",
          power: card.power ?? "",
          counter: card.counter ?? "",
          attribute: card.attribute ?? "",
        },
      ]);
    }

    // Scroll to added group
    setTimeout(() => {
      const groupElement = groupRefs.current[card.code];
      if (groupElement) {
        groupElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);
  };

  // Open card preview drawer
  const handleProxyCardClick = (
    proxy: DeckCard,
    fullCard?: CardWithCollectionData,
    baseCard?: CardWithCollectionData
  ) => {
    setSelectedCard(proxy);
    // Find the full card data from allCards or alternates
    if (fullCard) {
      setSelectedFullCard(fullCard);
      // If baseCard is provided, use it; otherwise fullCard is the base
      setSelectedBaseCard(baseCard || fullCard);
    } else {
      const foundCard = allCards.find(
        (c) =>
          Number(c.id) === proxy.cardId ||
          c.alternates?.some((alt) => Number(alt.id) === proxy.cardId)
      );
      if (foundCard) {
        // foundCard is always the base card
        setSelectedBaseCard(foundCard);

        if (Number(foundCard.id) === proxy.cardId) {
          setSelectedFullCard(foundCard);
        } else {
          const altCard = foundCard.alternates?.find(
            (alt) => Number(alt.id) === proxy.cardId
          );
          setSelectedFullCard(altCard || foundCard);
        }
      } else {
        setSelectedFullCard(null);
        setSelectedBaseCard(null);
      }
    }
    setIsCardDrawerOpen(true);
  };

  // Open preview for a card from the left panel (card selection list)
  const handleLeftPanelPreview = (
    baseCard: CardWithCollectionData,
    displayCard: CardWithCollectionData
  ) => {
    // Create a temporary DeckCard for the preview
    const tempDeckCard: DeckCard = {
      cardId: Number(displayCard.id),
      id: Number(displayCard.id),
      name: baseCard.name,
      rarity: baseCard.rarity ?? "",
      src: displayCard.src,
      quantity:
        proxies.find((p) => p.cardId === Number(displayCard.id))?.quantity ?? 0,
      code: baseCard.code,
      color: baseCard.colors.length ? baseCard.colors[0].color : "gray",
      colors: baseCard.colors,
      cost: baseCard.cost ?? "",
      category: baseCard.category,
      set: baseCard.sets[0]?.set?.title ?? "",
      power: baseCard.power ?? "",
      counter: baseCard.counter ?? "",
      attribute: baseCard.attribute ?? "",
    };
    setSelectedCard(tempDeckCard);
    setSelectedFullCard(displayCard);
    // Always use baseCard for rulings and card info
    setSelectedBaseCard(baseCard);
    setIsCardDrawerOpen(true);
  };

  // Quantity handlers for drawer
  const handleQuantityChange = (cardId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      setProxies((prev) => prev.filter((p) => p.cardId !== cardId));
    } else {
      setProxies((prev) =>
        prev.map((p) =>
          p.cardId === cardId ? { ...p, quantity: newQuantity } : p
        )
      );
    }
    // Update selected card if it's open
    if (selectedCard && selectedCard.cardId === cardId) {
      setSelectedCard((prev) =>
        prev ? { ...prev, quantity: newQuantity } : null
      );
    }
  };

  const removeCard = (cardId: number) => {
    setProxies((prev) => prev.filter((card) => card.cardId !== cardId));
  };

  const handleSelectedCardChange = (card: CardWithCollectionData) => {
    setSelectedFullCard(card);
  };

  const handleLargeImagePreview = (
    baseCard: CardWithCollectionData,
    displayCard: CardWithCollectionData
  ) => {
    setSelectedFullCard(displayCard);
    setSelectedBaseCard(baseCard);
    setShowLargeImage(true);
  };

  // Generate PDF handler
  const handleProxies = () => {
    generateProxySheetPdf(proxies, { language: printLanguage });
  };

  // Filtered cards - server handles filtering AND sorting via sortBy parameter
  const filteredCards = useMemo(() => {
    if (!allCards || allCards.length === 0) return [];
    return allCards;
  }, [allCards]);

  // Total results - prefer count from API, fallback to pagination count, then initial data
  const totalResults =
    countData ??
    totalCount ??
    (matchesInitialFilters ? initialData?.totalCount : undefined) ??
    filteredCards.length;

  const gridRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);
  const queuedVisibleCountRef = useRef<number | null>(null);

  const LOAD_THRESHOLD_PX = 10000;

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    isLoadingMoreRef.current = false;
    queuedVisibleCountRef.current = null;
    gridRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [filtersSignature]);

  // Sync visibleCount when new data arrives (from CardListClient pattern)
  useEffect(() => {
    if (filteredCards.length === 0) {
      if (!isLoading && !isFetching) {
        setVisibleCount(0);
      }
      isLoadingMoreRef.current = false;
      queuedVisibleCountRef.current = null;
      return;
    }

    if (visibleCount === 0) {
      setVisibleCount(Math.min(PAGE_SIZE, filteredCards.length));
      isLoadingMoreRef.current = false;
      queuedVisibleCountRef.current = null;
      return;
    }

    if (visibleCount > filteredCards.length) {
      setVisibleCount(filteredCards.length);
      queuedVisibleCountRef.current = null;
      isLoadingMoreRef.current = false;
      return;
    }

    // Check if we have a queued target and data has arrived
    const queuedTarget = queuedVisibleCountRef.current;
    if (
      queuedTarget !== null &&
      (filteredCards.length >= queuedTarget ||
        (!hasNextPage && !isFetchingNextPage))
    ) {
      queuedVisibleCountRef.current = null;
      setVisibleCount(Math.min(queuedTarget, filteredCards.length));
      isLoadingMoreRef.current = false;
      return;
    }

    isLoadingMoreRef.current = false;
  }, [
    filteredCards.length,
    visibleCount,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
  ]);

  // Handle scroll for infinite loading
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, clientHeight, scrollHeight } = target;
    const remaining = scrollHeight - (scrollTop + clientHeight);

    if (remaining <= LOAD_THRESHOLD_PX && !isLoadingMoreRef.current) {
      // First, show more of already fetched cards
      if (visibleCount < filteredCards.length) {
        isLoadingMoreRef.current = true;
        setVisibleCount((prev) =>
          Math.min(prev + PAGE_SIZE, filteredCards.length)
        );
        requestAnimationFrame(() => {
          isLoadingMoreRef.current = false;
        });
      }
      // Then fetch more from server if needed - queue the next visible count
      else if (hasNextPage && !isFetchingNextPage) {
        isLoadingMoreRef.current = true;
        queuedVisibleCountRef.current = visibleCount + PAGE_SIZE;
        fetchNextPage()
          .catch(() => {
            queuedVisibleCountRef.current = null;
          })
          .finally(() => {
            isLoadingMoreRef.current = false;
          });
      }
    }
  };

  const totalCards = proxies.reduce((total, card) => total + card.quantity, 0);

  return (
    <div className="flex flex-1 bg-slate-100 w-full h-full overflow-hidden">
      {/* FAB for Proxies (Mobile only) */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsProxiesDrawerOpen(true)}
          className="relative flex items-center justify-center h-16 w-16 rounded-full bg-purple-600 text-white shadow-xl hover:bg-purple-700 active:scale-95 transition-all"
        >
          <Layers className="h-7 w-7" />
          {totalCards > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold border-2 border-white">
              {totalCards}
            </div>
          )}
        </button>
      </div>

      {/* Cards Panel */}
      <div className="bg-white flex w-full md:w-[320px] lg:w-[400px] xl:w-[450px] flex-shrink-0 border-r border-slate-200 min-h-0 flex-col h-full">
        {/* Search + Filters Header */}
        <div className="p-3 border-b border-slate-100 space-y-3 flex flex-col gap-3">
          {/* Search Input */}
          <DropdownSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search..."
          />

          {/* Filter Button + Sort Select */}
          <div className="flex items-center gap-2 !mt-0">
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-[42px] text-sm font-medium transition-all active:scale-95 ${
                totalFilters > 0
                  ? "border-purple-300 bg-purple-50 text-purple-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {totalFilters > 0 && (
                <>
                  <span className="bg-purple-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {totalFilters}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFilters();
                    }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-purple-200 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              )}
            </button>

            <BaseCardsToggle
              isActive={showOnlyBaseCards}
              onToggle={() => setShowOnlyBaseCards(!showOnlyBaseCards)}
            />

            <div className="ml-auto">
              <SortSelect
                options={sortOptions}
                selected={selectedSort}
                setSelected={setSelectedSort}
                buttonLabel={t("common.sort")}
              />
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-slate-500 !mt-0">
            {t("proxies.cardsFound", {
              count: totalResults?.toLocaleString() ?? "0",
            })}
            {(isFetching || isFetchingNextPage || isCounting) && (
              <span className="ml-2 text-purple-600">
                {t("proxies.loading")}
              </span>
            )}
          </p>
        </div>

        {/* Cards Grid */}
        <div
          className="p-3 pb-24 md:pb-3 overflow-y-auto flex-1 min-h-0"
          ref={gridRef}
          onScroll={handleScroll}
        >
          {/* Initial loading state - Skeleton grid */}
          {isLoading && filteredCards.length === 0 && (
            <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="rounded-lg overflow-hidden">
                    <div className="aspect-[63/88] bg-slate-200 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filteredCards.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-slate-500">
                No cards match your filters.
              </p>
            </div>
          )}

          {filteredCards.length > 0 && (
            <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-3">
              {filteredCards?.slice(0, visibleCount).map((card, index) => {
                const baseCardMatches = (): boolean => {
                  if (!card) return false;
                  if (normalizedSelectedSets.length > 0) {
                    const baseSetCodes = (card.setCode ?? "")
                      .split(",")
                      .map((code: string) => code.trim().toLowerCase())
                      .filter(Boolean);
                    if (
                      !baseSetCodes.some((code: string) =>
                        normalizedSelectedSets.includes(code)
                      )
                    ) {
                      return false;
                    }
                  }
                  if (selectedAltArts.length > 0) {
                    return selectedAltArts.includes(card?.alternateArt ?? "");
                  }
                  return true;
                };

                const getFilteredAlternates = () => {
                  // If showOnlyBaseCards is active, hide all alternates
                  if (showOnlyBaseCards) return [];
                  if (!card?.alternates) return [];
                  return card.alternates.filter((alt) => {
                    if (normalizedSelectedSets.length > 0) {
                      const altSetCodes = (alt.setCode ?? "")
                        .split(",")
                        .map((code) => code.trim().toLowerCase())
                        .filter(Boolean);
                      if (
                        !altSetCodes.some((code) =>
                          normalizedSelectedSets.includes(code)
                        )
                      ) {
                        return false;
                      }
                    }
                    if (selectedAltArts.length > 0) {
                      return selectedAltArts.includes(alt.alternateArt ?? "");
                    }
                    return true;
                  });
                };

                const filteredAlts = getFilteredAlternates();

                if (!baseCardMatches() && filteredAlts.length === 0)
                  return null;

                return (
                  <React.Fragment key={card.id}>
                    {baseCardMatches() && (
                      <div
                        onClick={(e) => handleCardClick(e, card, card)}
                        className="cursor-pointer transition-all duration-200 active:scale-95"
                      >
                        <div className="rounded-lg shadow-sm overflow-hidden">
                          <div className="relative">
                            <LazyImage
                              src={card.src}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={card.name}
                              priority={index < 20}
                              size="small"
                              className="w-full rounded-md"
                            />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isDesktop) {
                                    handleLargeImagePreview(card, card);
                                    return;
                                  }
                                  handleLeftPanelPreview(card, card);
                                }}
                                className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-100 transition-opacity duration-200 z-10"
                                aria-label="View card details"
                                title="Ver carta en grande"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                          </div>
                          {(() => {
                            const baseCardInProxies = proxies.find(
                              (proxyCard) =>
                                proxyCard.cardId === Number(card.id)
                            );
                            if (!baseCardInProxies) return null;
                            return (
                              <div className="mt-1.5">
                                <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-1.5 py-0.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(
                                        baseCardInProxies.cardId,
                                        baseCardInProxies.quantity - 1
                                      );
                                    }}
                                    className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="text-white font-bold text-sm">
                                    {baseCardInProxies.quantity}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(
                                        baseCardInProxies.cardId,
                                        baseCardInProxies.quantity + 1
                                      );
                                    }}
                                    className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {filteredAlts.map((alt) => {
                      const alternateInProxies = proxies.find(
                        (proxyCard) => proxyCard.cardId === Number(alt.id)
                      );

                      return (
                        <div
                          key={alt.id}
                          onClick={(e) => handleCardClick(e, card, alt)}
                          className="cursor-pointer transition-all duration-200 active:scale-95"
                        >
                          <div className="rounded-lg shadow-sm overflow-hidden">
                            <div className="relative">
                              <LazyImage
                                src={alt.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={alt.name}
                                priority={index < 20}
                                size="small"
                                className="w-full rounded-md"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isDesktop) {
                                    handleLargeImagePreview(card, alt);
                                    return;
                                  }
                                  handleLeftPanelPreview(card, alt);
                                }}
                                className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-100 transition-opacity duration-200 z-10"
                                aria-label="View card details"
                                title="Ver carta en grande"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {alternateInProxies && (
                              <div className="mt-1.5">
                                <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-1.5 py-0.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(
                                        alternateInProxies.cardId,
                                        alternateInProxies.quantity - 1
                                      );
                                    }}
                                    className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="text-white font-bold text-sm">
                                    {alternateInProxies.quantity}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(
                                        alternateInProxies.cardId,
                                        alternateInProxies.quantity + 1
                                      );
                                    }}
                                    className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Proxies Panel (Desktop only - on mobile use ProxiesDrawer via FAB) */}
      <div className="hidden md:flex flex-col flex-1 min-h-0 bg-slate-100">
        {/* Proxies Header */}
        <div className="bg-white border-b border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  Proxy Builder
                </h1>
                <p className="text-xs text-slate-500">
                  {totalCards} {totalCards === 1 ? "card" : "cards"} selected
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <PrintLanguageToggle
                value={printLanguage}
                onChange={setPrintLanguage}
              />
              <button
                onClick={() => setProxies([])}
                disabled={proxies.length === 0}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
              <button
                onClick={handleProxies}
                disabled={proxies.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                <span>Generate PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Proxies Content */}
        <div className="flex-1 p-4 overflow-auto">
          {proxies.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="max-w-sm mx-auto text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-100 flex items-center justify-center">
                  <Layers className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Build Your Proxies
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Select cards from the left panel to add them to your proxy
                  list for printing.
                </p>
                <div className="mt-4 p-3 rounded-xl bg-purple-50 text-purple-700 text-xs font-medium">
                  Tip: Click on any card to add it to your collection
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {proxies.map((proxy, index) => (
                <div
                  key={`${proxy.cardId}-${index}`}
                  onClick={() => handleProxyCardClick(proxy)}
                  className="cursor-pointer"
                >
                  <div className="rounded-xl shadow-sm bg-white p-2 relative transition-all hover:shadow-md active:scale-[0.98]">
                    <div className="aspect-[3/4] relative overflow-hidden rounded-lg">
                      <img
                        src={getOptimizedImageUrl(proxy.src, "small")}
                        alt={proxy.name}
                        className="w-full h-full object-cover"
                        loading={index < 20 ? "eager" : "lazy"}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isDesktop) {
                            const foundCard = allCards.find(
                              (c) =>
                                Number(c.id) === proxy.cardId ||
                                c.alternates?.some(
                                  (alt) => Number(alt.id) === proxy.cardId
                                )
                            );

                            if (foundCard) {
                              const displayCard =
                                Number(foundCard.id) === proxy.cardId
                                  ? foundCard
                                  : foundCard.alternates?.find(
                                      (alt) =>
                                        Number(alt.id) === proxy.cardId
                                    ) || foundCard;
                              handleLargeImagePreview(foundCard, displayCard);
                              return;
                            }
                          }
                          handleProxyCardClick(proxy);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-100 transition-opacity duration-200 z-10"
                        aria-label="View card details"
                        title="Ver carta en grande"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="mt-2 text-center">
                            <span
                              className={`${oswald.className} text-xs font-medium text-slate-700`}
                            >
                              {proxy.code}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{proxy.set}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {/* Quantity Control Bar - CardWithBadges style */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-2 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuantityChange(
                              proxy.cardId,
                              Math.max(0, proxy.quantity - 1)
                            );
                          }}
                          className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <div className="flex items-center justify-center">
                          <span className="text-white font-bold text-base">
                            {proxy.quantity}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuantityChange(
                              proxy.cardId,
                              proxy.quantity + 1
                            );
                          }}
                          className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Preview - Mobile drawer, Desktop card modal */}
      {!isDesktop ? (
        <ProxyCardPreviewDrawer
          isOpen={isCardDrawerOpen}
          onClose={() => setIsCardDrawerOpen(false)}
          card={selectedCard}
          fullCard={selectedFullCard}
          baseCard={selectedBaseCard}
          onQuantityChange={handleQuantityChange}
          onRemove={removeCard}
        />
      ) : null}

      {isDesktop && selectedFullCard && selectedBaseCard && (
        <Transition appear show={isCardDrawerOpen} as={Fragment}>
          <HeadlessDialog
            as="div"
            className="relative z-[9999]"
            onClose={() => setIsCardDrawerOpen(false)}
          >
            <div
              className="fixed inset-0 flex w-screen items-center justify-center p-4 transition-all duration-500 ease-in-out bg-black/60"
            >
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-4xl space-y-4 rounded-lg border bg-white shadow-xl transform transition-all">
                  <CardModal
                    selectedCard={selectedFullCard}
                    setIsOpen={setIsCardDrawerOpen}
                    alternatesCards={selectedBaseCard.alternates}
                    setSelectedCard={handleSelectedCardChange}
                    baseCard={selectedBaseCard}
                    setShowLargeImage={setShowLargeImage}
                    showLargeImage={showLargeImage}
                  />
                </DialogPanel>
              </TransitionChild>
            </div>
          </HeadlessDialog>
        </Transition>
      )}

      {isDesktop && showLargeImage && selectedFullCard && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
          onClick={() => setShowLargeImage(false)}
          onTouchEnd={() => setShowLargeImage(false)}
        >
          <div className="w-full max-w-3xl">
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              Tap to close
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={selectedFullCard.src}
                className="max-w-full max-h-[calc(100dvh-200px)] object-contain rounded-lg shadow-2xl"
                alt={selectedFullCard.name}
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                <span className={`${oswald.className} font-[500]`}>
                  {selectedFullCard.code}
                </span>
                <br />
                <span>{selectedFullCard.sets?.[0]?.set?.title || ""}</span>
                {(() => {
                  const priceValue = getCardPriceValue(selectedFullCard);
                  if (priceValue !== null) {
                    return (
                      <>
                        <br />
                        <span className="inline-block mt-3 px-6 py-3 bg-emerald-600 text-white text-xl font-bold rounded-lg shadow-lg">
                          {formatCurrency(
                            priceValue,
                            selectedFullCard.priceCurrency
                          )}
                        </span>
                      </>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Drawer */}
      {isFilterDrawerOpen && (
        <FiltersSidebar
          isOpen={isFilterDrawerOpen}
          setIsOpen={setIsFilterDrawerOpen}
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
      )}

      {/* Proxies Drawer (Mobile) */}
      <ProxiesDrawer
        isOpen={isProxiesDrawerOpen}
        onClose={() => setIsProxiesDrawerOpen(false)}
        proxies={proxies}
        setProxies={setProxies}
        onGeneratePDF={handleProxies}
        allCards={allCards}
      />
    </div>
  );
};

export default ProxiesBuilder;
