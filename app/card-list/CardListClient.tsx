"use client";

import React, {
  useEffect,
  useState,
  Fragment,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useSearchParams } from "next/navigation";
import { CardWithCollectionData } from "@/types";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import SearchFilters from "@/components/home/SearchFilters";
import CardModal from "@/components/CardModal";
import DonModal from "@/components/DonModal";
import FiltersSidebar from "@/components/FiltersSidebar";
import MobileFiltersDrawer from "@/components/deckbuilder/MobileFiltersDrawer";

// Componentes críticos - carga inmediata
import StoreCard from "@/components/StoreCard";
import ViewSwitch from "@/components/ViewSwitch";
import SortSelect, { SortOption } from "@/components/SortSelect";
import MultiSelect from "@/components/MultiSelect";
import DropdownSearch from "@/components/DropdownSearch";
import { rarityFormatter } from "@/helpers/formatters";
import AlternatesWhite from "@/public/assets/images/variantsICON_VERTICAL_white.svg";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { Oswald } from "next/font/google";
import BaseCardsToggle from "@/components/BaseCardsToggle";
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
import {
  useCardsSyncStatus,
  usePaginatedCards,
  useCardsCount,
  serializeFiltersForKey,
} from "@/hooks/useCards";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  RefreshCw,
  WifiOff,
  SlidersHorizontal,
  X,
  HelpCircle,
} from "lucide-react";
import ClearFiltersButton from "@/components/ClearFiltersButton";
import { useSession } from "next-auth/react";
import { getOptimizedImageUrl, smartPrefetch } from "@/lib/imageOptimization";
import {
  matchesCardCode,
  baseCardMatches,
  getFilteredAlternates,
} from "@/lib/cardFilters";
import LazyImage from "@/components/LazyImage";
import CardPreviewDialog from "@/components/deckbuilder/CardPreviewDialog";
import VirtualizedCardGrid from "@/components/VirtualizedCardGrid";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { sortByCollectionOrder } from "@/lib/cards/sort";
import { DON_CATEGORY } from "@/helpers/constants";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useRegion } from "@/components/region/RegionProvider";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const PAGE_SIZE = 60;

const NO_COUNTER_LABEL = "No counter";
const NO_TRIGGER_LABEL = "No trigger";
const SEARCH_TIP_STORAGE_KEY = "card-search-tips-v1";
const SEARCH_MODAL_STORAGE_KEY = "card-search-modal-v1";

// Helper functions para precio - fuera del componente para evitar recreación
const getNumericPriceStatic = (value: any) => {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const getCardPriceValueStatic = (card: CardWithCollectionData) => {
  return (
    getNumericPriceStatic(card.marketPrice) ??
    getNumericPriceStatic(card.alternates?.[0]?.marketPrice) ??
    null
  );
};

const formatCurrencyStatic = (value: number, currency?: string | null) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(value);

// Componente PriceTag memoizado - fuera del componente principal
const PriceTag = React.memo(
  ({
    card,
    className = "",
  }: {
    card: CardWithCollectionData;
    className?: string;
  }) => {
    const priceValue = getCardPriceValueStatic(card);
    if (priceValue === null) {
      return (
        <div
          className={`mt-1 text-xs font-medium uppercase tracking-wide text-amber-600 ${className}`}
        >
          Precio no disponible
        </div>
      );
    }

    const currency =
      card.priceCurrency ?? card.alternates?.[0]?.priceCurrency ?? "USD";

    return (
      <div
        className={`mt-1 text-sm font-semibold text-emerald-600 ${className}`}
      >
        {formatCurrencyStatic(priceValue, currency)}
      </div>
    );
  }
);
PriceTag.displayName = "PriceTag";

type CardListClientProps = {
  initialData: CardsPage;
  initialFilters: CardsFilters;
};

const CardListClient = ({
  initialData,
  initialFilters,
}: CardListClientProps) => {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { region, setRegion } = useRegion();
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
      {
        value: "price_high",
        label: t("sort.priceHigh"),
        description: t("sort.priceHighDesc"),
      },
      {
        value: "price_low",
        label: t("sort.priceLow"),
        description: t("sort.priceLowDesc"),
      },
      {
        value: "most_variants",
        label: t("sort.mostVariants"),
        description: t("sort.mostVariantsDesc"),
      },
      {
        value: "less_variants",
        label: t("sort.lessVariants"),
        description: t("sort.lessVariantsDesc"),
      },
    ],
    [t]
  );
  const sortOptionsForSelect = useMemo(
    () =>
      sortOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [sortOptions]
  );
  const searchExamples = useMemo(
    () => [
      {
        label: t("cardList.search.example.don.label"),
        description: t("cardList.search.example.don.desc"),
      },
      {
        label: t("cardList.search.example.secret.label"),
        description: t("cardList.search.example.secret.desc"),
      },
      {
        label: t("cardList.search.example.luffyRed.label"),
        description: t("cardList.search.example.luffyRed.desc"),
      },
      {
        label: t("cardList.search.example.namiOp12.label"),
        description: t("cardList.search.example.namiOp12.desc"),
      },
      {
        label: t("cardList.search.example.power3000.label"),
        description: t("cardList.search.example.power3000.desc"),
      },
      {
        label: t("cardList.search.example.cost7.label"),
        description: t("cardList.search.example.cost7.desc"),
      },
      {
        label: t("cardList.search.example.code120.label"),
        description: t("cardList.search.example.code120.desc"),
      },
    ],
    [t]
  );
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

  const [previewCard, setPreviewCard] = useState<CardWithCollectionData | null>(
    null
  );
  const [previewBaseCard, setPreviewBaseCard] =
    useState<CardWithCollectionData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [skeletonLayout, setSkeletonLayout] = useState({
    columns: 3,
    count: 12,
  });

  const openCardPreview = useCallback(
    (card: CardWithCollectionData, base?: CardWithCollectionData) => {
      setPreviewCard(card);
      setPreviewBaseCard(base || card);
      setIsPreviewOpen(true);
    },
    []
  );

  const closeCardPreview = useCallback(() => {
    setIsPreviewOpen(false);
    setTimeout(() => {
      setPreviewCard(null);
      setPreviewBaseCard(null);
    }, 300);
  }, []);

  const getSkeletonLayout = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return { columns: 3, count: 12 };
    }

    const width = container.clientWidth || 0;
    const height = container.clientHeight || 0;
    const columns =
      width >= 1536
        ? 8
        : width >= 1280
        ? 7
        : width >= 1024
        ? 6
        : width >= 768
        ? 5
        : width >= 640
        ? 4
        : 3;
    const gap = width >= 640 ? 12 : 8;
    const cardWidth = Math.max(1, (width - gap * (columns - 1)) / columns);
    const imageHeight = cardWidth * 1.4;
    const cardHeight = imageHeight + 36;
    const rows = Math.max(
      2,
      Math.ceil(height > 0 ? height / (cardHeight + gap) : 3)
    );

    return { columns, count: rows * columns };
  }, []);

  // Leer estado desde URL params
  const [search, setSearch] = useState(
    searchParams.get("search") ?? initialFilters.search ?? ""
  );
  const [showSearchTips, setShowSearchTips] = useState(false);
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSearchChips, setShowSearchChips] = useState(true);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const showSearchChipsRef = useRef(true);
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
  const normalizeSortValue = (value: string | null) => {
    switch (value) {
      case "Price high":
        return "price_high";
      case "Price low":
        return "price_low";
      case "Ascending code":
        return "code_asc";
      case "Descending code":
        return "code_desc";
      case "Most variants":
        return "most_variants";
      case "Less variants":
        return "less_variants";
      default:
        return value ?? "";
    }
  };

  const [selectedSort, setSelectedSort] = useState<string>(
    normalizeSortValue(searchParams.get("sort"))
  );
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    getArrayParam("codes", [])
  );
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>(
    getArrayParam("altArts", initialFilters.altArts ?? [])
  );
  const selectedRegion = region;
  const [viewSelected, setViewSelected] = useState<
    "grid" | "list" | "alternate" | "text"
  >((searchParams.get("view") as any) || "list");

  const [showOnlyBaseCards, setShowOnlyBaseCards] = useState(false);
  const isPriceSort =
    selectedSort === "price_high" || selectedSort === "price_low";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [isProVersion, setIsProVersion] = useState(false);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [alternatesCards, setAlternatesCards] = useState<
    CardWithCollectionData[]
  >([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(-1);

  const { data: session } = useSession();

  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSeenModal = window.localStorage.getItem(SEARCH_MODAL_STORAGE_KEY);
    const hasSeenTips = window.localStorage.getItem(SEARCH_TIP_STORAGE_KEY);
    if (!hasSeenModal) {
      window.localStorage.setItem(SEARCH_MODAL_STORAGE_KEY, "1");
    }
    if (!hasSeenTips) {
      setShowSearchTips(true);
    }
  }, []);

  useEffect(() => {
    const paramRegion = searchParams.get("region");
    if (paramRegion && paramRegion !== region) {
      setRegion(paramRegion);
    }
  }, [region, searchParams, setRegion]);


  const markSearchTipsSeen = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SEARCH_TIP_STORAGE_KEY, "1");
  }, []);

  const markSearchModalSeen = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SEARCH_MODAL_STORAGE_KEY, "1");
  }, []);

  const handleSearchExample = useCallback(
    (value: string) => {
      setSearch(value);
      setShowSearchHelp(false);
      setShowSearchTips(false);
      markSearchTipsSeen();
    },
    [markSearchTipsSeen, setSearch]
  );

  const handleCloseSearchModal = useCallback(
    (showTips: boolean) => {
      setShowSearchModal(false);
      markSearchModalSeen();
      if (showTips) {
        setShowSearchTips(true);
      }
    },
    [markSearchModalSeen]
  );

  useEffect(() => {
    showSearchChipsRef.current = showSearchChips;
  }, [showSearchChips]);

  useEffect(() => {
    if (searchExamples.length === 0) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % searchExamples.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [searchExamples.length]);

  const dynamicPlaceholder =
    searchExamples[placeholderIndex]?.label || t("common.searchPlaceholder");

  // Estado para trackear qué carta está siendo tocada (para mostrar badge en mobile)
  const [touchedCardId, setTouchedCardId] = useState<number | string | null>(
    null
  );

  // Función para calcular priority limit según ancho
  const calculatePriorityLimit = (width: number) => {
    if (width >= 1536) return 24; // 2xl: 8 cols × 3 rows
    if (width >= 1280) return 21; // xl: 7 cols × 3 rows
    if (width >= 1024) return 18; // lg: 6 cols × 3 rows
    if (width >= 768) return 15; // md: 5 cols × 3 rows
    return 6; // mobile: 3-4 cols × 2 rows
  };

  // Función para determinar tamaño de imagen según viewport
  const getImageSize = (width: number): "thumb" | "small" => {
    // Mobile usa "thumb" (200x280) para reducir ~40% de bytes vs "small" (300x420)
    // Desktop usa "small" para mejor calidad
    return width < 768 ? "thumb" : "small";
  };

  // Detectar viewport para optimizaciones - inicializar con valor correcto
  const [priorityLimit, setPriorityLimit] = useState(() => {
    if (typeof window !== "undefined") {
      return calculatePriorityLimit(window.innerWidth);
    }
    return 6; // SSR fallback
  });

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return false; // SSR fallback
  });

  const [imageSize, setImageSize] = useState<"thumb" | "small">(() => {
    if (typeof window !== "undefined") {
      return getImageSize(window.innerWidth);
    }
    return "thumb"; // SSR fallback - mobile-first
  });

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const desktop = width >= 768;
      setIsDesktop(desktop);
      setPriorityLimit(calculatePriorityLimit(width));
      setImageSize(getImageSize(width));
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  // ✅ OPTIMIZADO: filtros memorizados para llamadas al endpoint paginado
  const filters = useMemo<CardsFilters>(() => {
    const sortBy =
      selectedSort === "price_high" ||
      selectedSort === "price_low" ||
      selectedSort === "code_asc" ||
      selectedSort === "code_desc" ||
      selectedSort === "name_asc" ||
      selectedSort === "name_desc"
        ? (selectedSort as CardsFilters["sortBy"])
        : undefined;

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
        selectedCounter && selectedCounter !== NO_COUNTER_LABEL
          ? selectedCounter
          : undefined,
      trigger:
        selectedTrigger && selectedTrigger !== NO_TRIGGER_LABEL
          ? selectedTrigger
          : undefined,
      sortBy,
      baseOnly: showOnlyBaseCards ? true : undefined,
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
    selectedSort,
    showOnlyBaseCards,
  ]);

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
  const prefetchedInitialNextPageRef = useRef(false);

  useEffect(() => {
    prefetchedInitialNextPageRef.current = false;
  }, [filtersSignature]);

  const fullQueryFilters = useMemo<CardsFilters>(() => ({}), []);

  const initialQueryData = useMemo(() => {
    if (!initialData || !matchesInitialFilters) return undefined;
    return {
      pages: [initialData],
      pageParams: [null],
    };
  }, [initialData, matchesInitialFilters]);

  const {
    cards,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isLoading,
    error: cardsError,
    refetch,
    queryKey: paginatedQueryKey,
    totalCount,
  } = usePaginatedCards(filters, {
    limit: PAGE_SIZE,
    initialData: initialQueryData,
  });

  useEffect(() => {
    if (cardsError) {
      console.error("Error al cargar cartas paginadas:", cardsError);
    }
  }, [cardsError]);

  const { data: countData, isFetching: isCounting } = useCardsCount(filters);

  useEffect(() => {
    if (
      isDesktop &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isFetching &&
      !prefetchedInitialNextPageRef.current &&
      cards?.length &&
      cards.length <= PAGE_SIZE
    ) {
      prefetchedInitialNextPageRef.current = true;
      fetchNextPage().catch(() => {
        prefetchedInitialNextPageRef.current = false;
      });
    }
  }, [
    isDesktop,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    fetchNextPage,
    cards?.length,
  ]);

  const { isSyncing, lastUpdated } = useCardsSyncStatus(paginatedQueryKey);
  const isOnline = useOnlineStatus();

  // ✅ Datos ahora vienen de TanStack Query (arriba)

  const BATCH_SIZE = PAGE_SIZE;
  const LOAD_THRESHOLD_PX = 3000; // Reducido de 10000 para mejor performance
  const DEFAULT_VISIBLE_COUNT = BATCH_SIZE;
  const SCROLL_RESET_COUNT = BATCH_SIZE;
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const isLoadingMoreRef = useRef(false);
  const queuedVisibleCountRef = useRef<number | null>(null);

  // Refs para throttle del scroll
  const showFabRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  const handleScrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setVisibleCount(SCROLL_RESET_COUNT);
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
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
      selectedAltArts?.length,
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
    ]
  );

  const dataSource = useMemo(() => {
    if (cards?.length) {
      return cards;
    }
    if (matchesInitialFilters) {
      return initialData?.items ?? [];
    }
    return [];
  }, [cards, initialData, matchesInitialFilters]);

  // Usar las funciones estáticas definidas fuera del componente
  const getCardPriceValue = getCardPriceValueStatic;
  const formatCurrency = formatCurrencyStatic;

  const filteredCards = useMemo(() => {
    if (!dataSource?.length) return [];

    const normalizedCards = dataSource.map((card) => {
      // Filtrar alternates pro (client-side porque es específico del usuario)
      if (!isProVersion && card.alternates && card.alternates.length > 0) {
        const filteredAlts = card.alternates.filter(
          (alt) => alt.isPro === false
        );
        if (filteredAlts.length !== card.alternates.length) {
          return { ...card, alternates: filteredAlts };
        }
      }
      if (showOnlyBaseCards && card.alternates?.length) {
        return { ...card, alternates: [] };
      }
      return card;
    });

    // Para ordenamiento por precio, el backend ya devuelve las cartas ordenadas
    if (isPriceSort) {
      return normalizedCards;
    }

    // Para otros ordenamientos, usar la lógica original
    const sortedCards = [...normalizedCards];

    if (selectedSort === "most_variants") {
      sortedCards.sort(
        (a, b) => (b.alternates?.length ?? 0) - (a.alternates?.length ?? 0)
      );
    } else if (selectedSort === "less_variants") {
      sortedCards.sort(
        (a, b) => (a.alternates?.length ?? 0) - (b.alternates?.length ?? 0)
      );
    } else if (selectedSort === "code_asc") {
      sortedCards.sort((a, b) => a.code.localeCompare(b.code));
    } else if (selectedSort === "code_desc") {
      sortedCards.sort((a, b) => b.code.localeCompare(a.code));
    } else if (selectedSort === "name_asc") {
      sortedCards.sort((a, b) => a.name.localeCompare(b.name));
    } else if (selectedSort === "name_desc") {
      sortedCards.sort((a, b) => b.name.localeCompare(a.name));
    } else {
      sortedCards.sort(sortByCollectionOrder);
    }

    return sortedCards;
  }, [dataSource, isProVersion, selectedSort, isPriceSort, showOnlyBaseCards]);

  const handleOpenCard = useCallback(
    (card: CardWithCollectionData, base: CardWithCollectionData) => {
      if (isDesktop) {
        const cardIndex = filteredCards.findIndex(
          (c) => (c._id || c.id) === (base._id || base.id)
        );
        setCurrentCardIndex(cardIndex);
        setSelectedCard(card);
        setBaseCard(base);
        setAlternatesCards(base.alternates);
        setIsOpen(true);
        return;
      }
      openCardPreview(card, base);
    },
    [
      isDesktop,
      filteredCards,
      openCardPreview,
      setCurrentCardIndex,
      setSelectedCard,
      setBaseCard,
      setAlternatesCards,
      setIsOpen,
    ]
  );

  // Scroll handler optimizado con throttle via requestAnimationFrame
  // Definido después de filteredCards para evitar referencia antes de declaración
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const { scrollTop, clientHeight, scrollHeight } = target;

      if (scrollTop > 120 && showSearchChipsRef.current) {
        showSearchChipsRef.current = false;
        setShowSearchChips(false);
      }

      // Actualizar FAB solo si cambió el estado (sin setState innecesario)
      const shouldShowFab = scrollTop > 100;
      if (showFabRef.current !== shouldShowFab) {
        showFabRef.current = shouldShowFab;
        // Usar RAF para el setState del FAB
        if (scrollRafRef.current) {
          cancelAnimationFrame(scrollRafRef.current);
        }
        scrollRafRef.current = requestAnimationFrame(() => {
          setShowFab(shouldShowFab);
        });
      }

      // Lógica de carga infinita (no necesita throttle, ya tiene guards)
      const remaining = scrollHeight - (scrollTop + clientHeight);
      if (remaining <= LOAD_THRESHOLD_PX && !isLoadingMoreRef.current) {
        if (visibleCount < filteredCards.length) {
          isLoadingMoreRef.current = true;
          setVisibleCount((prev) =>
            Math.min(prev + BATCH_SIZE, filteredCards.length)
          );
          requestAnimationFrame(() => {
            isLoadingMoreRef.current = false;
          });
        } else if (hasNextPage && !isFetchingNextPage) {
          isLoadingMoreRef.current = true;
          queuedVisibleCountRef.current = visibleCount + BATCH_SIZE;
          fetchNextPage()
            .catch(() => {
              queuedVisibleCountRef.current = null;
            })
            .finally(() => {
              isLoadingMoreRef.current = false;
            });
        }
      }
    },
    [
      visibleCount,
      filteredCards.length,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage,
      BATCH_SIZE,
      LOAD_THRESHOLD_PX,
    ]
  );

  // Pre-calcular datos de cartas visibles para evitar IIFE en render
  const visibleCardsData = useMemo(() => {
    const result: Array<{
      card: CardWithCollectionData;
      filteredAlts: CardWithCollectionData[];
      isBaseMatch: boolean;
      baseCardIndex: number;
      cardIndex: number;
    }> = [];

    let globalIndex = 0;
    const cardsToProcess = filteredCards.slice(0, visibleCount);

    cardsToProcess.forEach((card, index) => {
      const filteredAlts = showOnlyBaseCards
        ? []
        : getFilteredAlternates(card, selectedSets, selectedAltArts);

      const isBaseMatch = baseCardMatches(card, selectedSets, selectedAltArts);

      if (!isBaseMatch && filteredAlts.length === 0) return;

      const baseCardIndex = globalIndex;
      if (isBaseMatch) globalIndex++;

      // Asignar índices a alternates
      const altsWithIndex = filteredAlts.map((alt) => {
        const altIdx = globalIndex++;
        return { ...alt, _globalIndex: altIdx };
      });

      result.push({
        card,
        filteredAlts: altsWithIndex,
        isBaseMatch,
        baseCardIndex,
        cardIndex: index,
      });
    });

    return result;
  }, [
    filteredCards,
    visibleCount,
    showOnlyBaseCards,
    selectedSets,
    selectedAltArts,
  ]);

  // Resetear ordenamiento por precio cuando cambien de vista
  useEffect(() => {
    if (viewSelected !== "list" && isPriceSort) {
      setSelectedSort("");
    }
  }, [viewSelected, isPriceSort]);

  // Scroll to top y resetear visibleCount cuando cambien filtros
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setVisibleCount(SCROLL_RESET_COUNT);
    isLoadingMoreRef.current = false;
    queuedVisibleCountRef.current = null;
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
      if (!isLoading && !isFetching) {
        setVisibleCount(0);
      }
      isLoadingMoreRef.current = false;
      queuedVisibleCountRef.current = null;
      return;
    }

    if (visibleCount === 0) {
      setVisibleCount(Math.min(BATCH_SIZE, filteredCards.length));
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

  const totalResults =
    countData ??
    totalCount ??
    (matchesInitialFilters ? initialData?.totalCount : undefined) ??
    filteredCards.length;
  const showInitialOverlay =
    dataSource.length === 0 && (isLoading || isFetching);

  useEffect(() => {
    if (!showInitialOverlay) return;
    const update = () => setSkeletonLayout(getSkeletonLayout());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [showInitialOverlay, getSkeletonLayout]);

  // Mostrar error si falla la carga
  if (cardsError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">
            Error al cargar cartas
          </h2>
          <p className="text-gray-600">
            {cardsError instanceof Error
              ? cardsError.message
              : "Unexpected error"}
          </p>
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
    <div className="bg-[#f2eede] flex-1 min-h-0 overflow-hidden flex flex-col">
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
            isProVersion={isProVersion}
          />
        </div>

        <div className="flex md:hidden p-3 flex-col gap-3 border-b border-[#f5f5f5]">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <DropdownSearch
                search={search}
                setSearch={setSearch}
                placeholder={`${t(
                  "cardList.search.placeholderPrefix"
                )} ${dynamicPlaceholder}`}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowSearchHelp(true)}
              className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm active:scale-95"
            >
              <HelpCircle className="h-5 w-5 mx-auto" />
              <span className="sr-only">{t("cardList.search.helpButton")}</span>
            </button>
          </div>

          {showSearchTips && !showSearchModal && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <p className="font-semibold text-slate-900">
                    {t("cardList.search.bannerTitle")}
                  </p>
                  <p className="text-xs text-slate-600">
                    {t("cardList.search.bannerDescription")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSearchTips(false);
                    markSearchTipsSeen();
                  }}
                  className="h-7 w-7 rounded-full border border-blue-100 bg-white text-slate-500 hover:text-slate-700"
                >
                  <X className="h-4 w-4 mx-auto" />
                  <span className="sr-only">{t("cardList.search.close")}</span>
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSearchHelp(true);
                  setShowSearchTips(false);
                  markSearchTipsSeen();
                }}
                className="mt-3 w-full"
              >
                {t("cardList.search.examplesCta")}
              </Button>
            </div>
          )}

          {showSearchChips ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {t("cardList.search.chipsTitle")}
                </p>
                <button
                  type="button"
                  onClick={() => setShowSearchChips(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                >
                  {t("cardList.search.chipsHide")}
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {searchExamples.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => handleSearchExample(example.label)}
                    className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm active:scale-95"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSearchChips(true)}
              className="self-start text-xs font-semibold text-slate-500"
            >
              {t("cardList.search.chipsShow")}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-[42px] text-sm font-medium transition-all active:scale-95 ${
                  totalFilters > 0
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>{t("common.filters")}</span>
                {totalFilters > 0 && (
                  <span className="bg-blue-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {totalFilters}
                  </span>
                )}
              </button>

              <BaseCardsToggle
                isActive={showOnlyBaseCards}
                onToggle={() => setShowOnlyBaseCards(!showOnlyBaseCards)}
              />
            </div>

            <div className="flex-1 flex justify-end">
              <ViewSwitch
                viewSelected={viewSelected}
                setViewSelected={setViewSelected}
              />
            </div>
          </div>
        </div>

        <div className="md:hidden">
          <MobileFiltersDrawer
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
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
        </div>

        <BaseDrawer
          isOpen={showSearchModal}
          onClose={() => handleCloseSearchModal(true)}
          maxHeight="85vh"
          desktopModal
          desktopMaxWidth="max-w-lg"
          showHandle={false}
        >
          <div className="bg-white rounded-t-2xl lg:rounded-2xl border border-slate-200">
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {t("cardList.search.modalTitle")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t("cardList.search.modalDescription")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCloseSearchModal(true)}
                  className="h-8 w-8 rounded-full border border-slate-200 text-slate-500"
                >
                  <X className="h-4 w-4 mx-auto" />
                  <span className="sr-only">{t("cardList.search.close")}</span>
                </button>
              </div>

              <div className="grid gap-2">
                {searchExamples.slice(0, 4).map((example) => (
                  <div
                    key={`modal-${example.label}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {example.label}
                    </div>
                    <div className="text-xs text-slate-500">
                      {example.description}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => {
                    setShowSearchHelp(true);
                    handleCloseSearchModal(false);
                  }}
                  className="w-full"
                >
                  {t("cardList.search.examplesCta")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    markSearchTipsSeen();
                    handleCloseSearchModal(false);
                  }}
                  className="w-full"
                >
                  {t("cardList.search.modalDismiss")}
                </Button>
              </div>
            </div>
          </div>
        </BaseDrawer>

        <BaseDrawer
          isOpen={showSearchHelp}
          onClose={() => setShowSearchHelp(false)}
          maxHeight="85vh"
        >
          <div className="bg-white rounded-t-2xl lg:rounded-2xl border border-slate-200">
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {t("cardList.search.helpTitle")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t("cardList.search.helpSubtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSearchHelp(false)}
                  className="h-8 w-8 rounded-full border border-slate-200 text-slate-500"
                >
                  <X className="h-4 w-4 mx-auto" />
                  <span className="sr-only">{t("cardList.search.close")}</span>
                </button>
              </div>

              <p className="text-xs text-slate-500">
                {t("cardList.search.helpHint")}
              </p>

              <div className="space-y-3">
                {searchExamples.map((example) => (
                  <button
                    key={`help-${example.label}`}
                    type="button"
                    onClick={() => handleSearchExample(example.label)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-slate-50"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {example.label}
                    </div>
                    <div className="text-xs text-slate-500">
                      {example.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </BaseDrawer>

        <div className="hidden md:block">
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
      </div>

      <div className="py-2 px-4 border-b bg-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">
            {t("cardList.cardsFound", {
              count: totalResults?.toLocaleString() ?? "0",
            })}
            {(isFetching || isFetchingNextPage || isCounting) && (
              <span className="ml-2 text-blue-600">{t("common.loading")}</span>
            )}
          </p>

          {/* Botón para colapsar/expandir filtros - Solo visible en desktop */}
          <button
            onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all text-gray-700 font-medium text-sm group border border-gray-200"
            aria-label={
              isFiltersCollapsed ? t("filters.show") : t("filters.hide")
            }
          >
            {isFiltersCollapsed ? (
              <>
                <ChevronDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                <span className="hidden lg:inline">{t("common.filters")}</span>
                {totalFilters > 0 && (
                  <Badge className="!bg-[#2463eb] !text-white font-bold text-xs min-w-[20px] h-5 flex items-center justify-center">
                    {totalFilters}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
                <span className="hidden lg:inline">{t("common.filters")}</span>
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
              try {
                await refetch();
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
                : t("cardList.refresh")
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
          {/* {session?.user?.role === "ADMIN" && (
            <ProToggleButton
              isActive={isProVersion}
              onToggle={(value) => setIsProVersion(value)}
            />
          )} */}
          {/* <BaseCardsToggle
            isActive={showOnlyBaseCards}
            onToggle={() => setShowOnlyBaseCards(!showOnlyBaseCards)}
          /> */}
          {isDesktop ? (
            <MultiSelect
              options={sortOptionsForSelect}
              selected={selectedSort ? [selectedSort] : []}
              setSelected={(values) => {
                const lastValue = values[values.length - 1];
                setSelectedSort(lastValue ?? "");
              }}
              buttonLabel={t("common.sort")}
              displaySelectedAs={(values) => {
                const current = sortOptionsForSelect.find(
                  (option) => option.value === values[0]
                );
                return current?.label || t("common.sort");
              }}
            />
          ) : (
            <SortSelect
              options={sortOptions}
              selected={selectedSort}
              setSelected={setSelectedSort}
              buttonLabel={t("common.sort")}
            />
          )}

          <div className="hidden md:flex justify-center items-center">
            <ViewSwitch
              viewSelected={viewSelected}
              setViewSelected={setViewSelected}
            />
          </div>
        </div>
      </div>

      <div
        className="p-3 md:p-5 overflow-y-auto flex-1 min-h-0 relative touch-pan-y overscroll-y-contain"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {showInitialOverlay && (
          <div className="absolute inset-0 z-10 bg-[#f2eede] p-5">
            <div
              className="grid gap-2 sm:gap-3"
              style={{
                gridTemplateColumns: `repeat(${skeletonLayout.columns}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: skeletonLayout.count }).map((_, index) => (
                <div
                  key={`skeleton-card-${index}`}
                  className="w-full border rounded-lg shadow p-3 bg-white animate-pulse"
                >
                  <div className="w-full aspect-[2.5/3.5] rounded bg-gray-200 mb-3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className={
            showInitialOverlay
              ? "opacity-0 pointer-events-none select-none"
              : ""
          }
        >
          {showFab && <FAB onClick={handleScrollToTop} />}

          {!showInitialOverlay && filteredCards.length === 0 ? (
            <div className="flex items-center justify-center text-center text-muted-foreground h-full">
              {t("cardList.noResults")}
            </div>
          ) : (
            <>
              {viewSelected === "list" && (
                <>
                  {/* Mobile: Virtualized Grid */}
                  {!isDesktop && (
                    <VirtualizedCardGrid
                      cards={visibleCardsData}
                      onCardClick={handleOpenCard}
                      imageSize={imageSize}
                      priorityLimit={priorityLimit}
                      formatCurrency={formatCurrency}
                      getCardPriceValue={getCardPriceValue}
                      scrollContainerRef={
                        scrollContainerRef as React.RefObject<HTMLDivElement>
                      }
                      touchedCardId={touchedCardId}
                      setTouchedCardId={setTouchedCardId}
                      isDesktop={isDesktop}
                      hasNextPage={hasNextPage}
                      isFetchingNextPage={isFetchingNextPage}
                      fetchNextPage={fetchNextPage}
                    />
                  )}

                  {/* Desktop: Regular Grid */}
                  {isDesktop && (
                    <div className="grid gap-2 md:gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-[repeat(auto-fit,_minmax(250px,_1fr))] justify-items-center">
                      {visibleCardsData.map(
                        ({
                          card,
                          filteredAlts,
                          isBaseMatch,
                          baseCardIndex,
                          cardIndex,
                        }) => (
                          <Fragment key={card._id || card.id}>
                            {isBaseMatch && (
                              <div
                                onClick={() => {
                                  handleOpenCard(card, card);
                                }}
                                onMouseEnter={() =>
                                  card.src &&
                                  smartPrefetch(card.src, "large", true)
                                }
                                onTouchStart={() => {
                                  card.src &&
                                    smartPrefetch(card.src, "large", true);
                                  setTouchedCardId(card.id);
                                }}
                                onTouchEnd={() => setTouchedCardId(null)}
                                onTouchCancel={() => setTouchedCardId(null)}
                                onContextMenu={(e) => e.preventDefault()}
                                className="w-full cursor-pointer max-w-[450px]"
                              >
                                <div className="border rounded-lg shadow bg-white justify-center items-center flex flex-col">
                                  <LazyImage
                                    src={card.src}
                                    fallbackSrc="/assets/images/backcard.webp"
                                    alt={card.name}
                                    className="w-full"
                                    priority={baseCardIndex < priorityLimit}
                                    size={imageSize}
                                  />

                                  {/* Info section - Code and Price */}
                                  <div className="w-full px-2 py-1.5 flex items-center justify-between gap-1">
                                    {card.code && (
                                      <span className="text-xs font-bold text-gray-800 truncate">
                                        {card.code}
                                      </span>
                                    )}
                                    {getCardPriceValue(card) !== null && (
                                      <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">
                                        {formatCurrency(
                                          getCardPriceValue(card)!,
                                          card.priceCurrency
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {filteredAlts.map((alt: any) => (
                              <div
                                key={alt._id || alt.id}
                                onClick={() => {
                                  handleOpenCard(alt, card);
                                }}
                                onMouseEnter={() =>
                                  alt.src &&
                                  smartPrefetch(alt.src, "large", true)
                                }
                                onTouchStart={() => {
                                  alt.src &&
                                    smartPrefetch(alt.src, "large", true);
                                  setTouchedCardId(alt.id);
                                }}
                                onTouchEnd={() => setTouchedCardId(null)}
                                onTouchCancel={() => setTouchedCardId(null)}
                                onContextMenu={(e) => e.preventDefault()}
                                className="w-full cursor-pointer max-w-[450px]"
                              >
                                <div className="border rounded-lg shadow bg-white justify-center items-center flex flex-col">
                                  <LazyImage
                                    src={alt.src}
                                    fallbackSrc="/assets/images/backcard.webp"
                                    alt={alt.name}
                                    className="w-full"
                                    priority={alt._globalIndex < priorityLimit}
                                    size={imageSize}
                                  />

                                  {/* Info section - Code and Price */}
                                  <div className="w-full px-2 py-1.5 flex items-center justify-between gap-1">
                                    {card.code && (
                                      <span className="text-xs font-bold text-gray-800 truncate">
                                        {card.code}
                                      </span>
                                    )}
                                    {getCardPriceValue(alt) !== null && (
                                      <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">
                                        {formatCurrency(
                                          getCardPriceValue(alt)!,
                                          alt.priceCurrency
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </Fragment>
                        )
                      )}
                    </div>
                  )}
                </>
              )}

              {viewSelected === "text" && (
                <div className="grid gap-3 lg:gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-[repeat(auto-fit,_minmax(350px,_1fr))] justify-items-center">
                  {filteredCards?.slice(0, visibleCount).map((card, index) => {
                    const handleCardClick = () => {
                      handleOpenCard(card, card);
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
                  {visibleCardsData.map(
                    ({
                      card,
                      filteredAlts,
                      isBaseMatch,
                      baseCardIndex,
                      cardIndex,
                    }) => (
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
                                handleOpenCard(card, card);
                              }}
                              onMouseEnter={() =>
                                card.src &&
                                smartPrefetch(card.src, "large", true)
                              }
                              onTouchStart={() =>
                                card.src &&
                                smartPrefetch(card.src, "large", true)
                              }
                              className="cursor-pointer"
                            >
                              <CardContent className="flex items-center pb-4 pl-0 pt-0 pr-0 flex-col h-full">
                                <div className="relative flex justify-center items-center w-full">
                                  <LazyImage
                                    src={card?.src}
                                    fallbackSrc="/assets/images/backcard.webp"
                                    alt={card?.name}
                                    className="w-[80%] m-auto"
                                    priority={baseCardIndex < priorityLimit}
                                    size={imageSize}
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
                                <PriceTag card={card} className="mt-2" />
                              </CardContent>
                            </Card>
                          )}

                          {filteredAlts.map((alt: any) => (
                            <Card
                              key={alt._id || alt.id}
                              onClick={() => {
                                handleOpenCard(alt, card);
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
                                <div className="relative flex justify-center items-center w-full">
                                  <LazyImage
                                    src={alt?.src}
                                    fallbackSrc="/assets/images/backcard.webp"
                                    alt={alt?.name}
                                    className="w-[80%] m-auto"
                                    priority={alt._globalIndex < priorityLimit}
                                    size={imageSize}
                                  />
                                </div>
                                <div>
                                  <div className="text-center font-bold mt-2">
                                    {card.category === "DON"
                                      ? alt?.alias
                                      : alt?.alternateArt}
                                  </div>
                                  {alt?.sets?.map((set: any) => (
                                    <p
                                      key={set.set.title}
                                      className="text-[13px] leading-[15px] font-[200] text-center line-clamp-2"
                                    >
                                      {highlightText(set.set.title, search)}
                                    </p>
                                  ))}
                                </div>
                                <PriceTag card={alt} className="mt-2" />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CardPreviewDialog
        isOpen={isPreviewOpen}
        onClose={closeCardPreview}
        card={previewCard}
        baseCard={previewBaseCard}
        currentQuantity={0}
        maxQuantity={4}
        canAdd={false}
        canRemove={false}
        isLeaderSelection={false}
      />

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
