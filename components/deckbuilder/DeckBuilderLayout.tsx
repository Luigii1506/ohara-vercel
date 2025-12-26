// CompleteDeckBuilderLayout.tsx
"use client";

import {
  useState,
  useRef,
  MouseEvent,
  useEffect,
  useMemo,
  useCallback,
  Fragment,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  ChartColumnBigIcon,
  Eye,
  Grid,
  RotateCcw,
  X,
  Layers,
  Users,
  Save,
  Minus,
  Plus,
  Download,
  SlidersHorizontal,
} from "lucide-react";
import { Oswald } from "next/font/google";
import DropdownSearch from "@/components/DropdownSearch";
import FiltersSidebar from "@/components/FiltersSidebar";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { CardWithCollectionData } from "@/types";
import { useDeckBuilder } from "@/hooks/useDeckBuilder";
import { getColors } from "@/helpers/functions";
import { showWarningToast } from "@/lib/toastify";
import { TransitionGroup, CSSTransition } from "react-transition-group";
import React from "react";
import GroupedCardPreview from "./GroupedCardPreview";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { allColors, categoryOptions } from "@/helpers/constants";
import { sortByCollectionOrder } from "@/lib/cards/sort";
import { Badge } from "@/components/ui/badge";
import SearchFilters from "@/components/home/SearchFilters";
import type { CardsFilters } from "@/lib/cards/types";
import { usePaginatedCards, useCardsCount } from "@/hooks/useCards";

import DeckStats from "../../components/deckbuilder/DeckStatsPreview";
import DeckBuilderDrawer from "./DeckBuilderDrawer";
import MobileFiltersDrawer from "./MobileFiltersDrawer";
import CardPreviewDialog from "./CardPreviewDialog";

const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "700"] });

import LazyImage from "@/components/LazyImage";
import CardWithBadges from "@/components/CardWithBadges";
import { getOptimizedImageUrl, smartPrefetch } from "@/lib/imageOptimization";

import { DeckCard } from "@/types";
import ViewSwitch from "../ViewSwitch";
import StoreCard from "../StoreCard";
import BaseCardsToggle from "../BaseCardsToggle";
import SortSelect, { SortOption } from "../SortSelect";

// AlternateArt types que NO deben mostrarse en el deckbuilder
const EXCLUDED_ALTERNATE_ARTS = [
  "Demo Version",
  "Pre-Errata",
  "Pre-Release",
  "1st Anniversary",
  "2nd Anniversary",
  "3rd Anniversary",
  "Not for sale",
];

const SORT_OPTIONS: SortOption[] = [
  {
    value: "code_asc",
    label: "Code A-Z",
    description: "Ascending by card code",
  },
  {
    value: "code_desc",
    label: "Code Z-A",
    description: "Descending by card code",
  },
  { value: "name_asc", label: "Name A-Z", description: "Alphabetical order" },
  {
    value: "name_desc",
    label: "Name Z-A",
    description: "Reverse alphabetical",
  },
  {
    value: "price_high",
    label: "Price: High to Low",
    description: "Most expensive first",
  },
  {
    value: "price_low",
    label: "Price: Low to High",
    description: "Cheapest first",
  },
];

interface CompleteDeckBuilderLayoutProps {
  onSave: () => void;
  onRestart: () => void;
  deckBuilder: ReturnType<typeof useDeckBuilder>;
  initialCards?: CardWithCollectionData[];
  useServerCards?: boolean;
  isFork?: boolean;
  deckName?: string;
  setDeckName?: (name: string) => void;
  onProxies?: () => void;
  isShopMode?: boolean;
  shopSlug?: string;
  setShopSlug?: (slug: string) => void;
  shopUrl?: string;
  setShopUrl?: (url: string) => void;
  isPublished?: boolean;
  setIsPublished?: (value: boolean) => void;
  initialQueryData?: {
    pages: any[];
    pageParams: (number | null)[];
  };
}

const CompleteDeckBuilderLayout = ({
  onSave,
  onRestart,
  deckBuilder,
  initialCards = [],
  useServerCards = true,
  isFork = false,
  deckName,
  setDeckName,
  onProxies,
  isShopMode = false,
  shopSlug,
  setShopSlug,
  shopUrl,
  setShopUrl,
  isPublished,
  setIsPublished,
  initialQueryData,
}: CompleteDeckBuilderLayoutProps) => {
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Helper functions for price handling
  const getNumericPrice = (value: any) => {
    if (value === null || value === undefined || value === "") return null;
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const getCardPriceValue = useCallback(
    (card: CardWithCollectionData | DeckCard) => {
      if ("marketPrice" in card) {
        // For DeckCard, just return the marketPrice directly
        // For CardWithCollectionData, also check alternates
        const directPrice = getNumericPrice(card.marketPrice);
        if (directPrice !== null) return directPrice;

        // Only check alternates if the card has them (CardWithCollectionData)
        if ("alternates" in card && card.alternates) {
          const validAlternates = filterValidAlternates(card.alternates);
          return getNumericPrice(validAlternates[0]?.marketPrice) ?? null;
        }
        return null;
      }
      return null;
    },
    []
  );

  const formatCurrency = (value: number, currency?: string | null) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(value);

  // Helper function para filtrar alternativas excluidas
  // Cuando showOnlyBaseCards está activo, retorna array vacío para ocultar todas las alternas
  const filterValidAlternates = (
    alternates: CardWithCollectionData[] | undefined,
    hideAlternates: boolean = false
  ) => {
    if (!alternates || hideAlternates) return [];
    return alternates.filter(
      (alt) => !EXCLUDED_ALTERNATE_ARTS.includes(alt.alternateArt ?? "")
    );
  };

  const PriceTag = ({
    card,
    className = "",
  }: {
    card: CardWithCollectionData;
    className?: string;
  }) => {
    const priceValue = getCardPriceValue(card);
    if (priceValue === null) {
      return (
        <div className={`text-xs font-medium text-gray-400 ${className}`}>
          N/A
        </div>
      );
    }

    const validAlternates = filterValidAlternates(card.alternates);
    const currency =
      card.priceCurrency ?? validAlternates[0]?.priceCurrency ?? "USD";

    return (
      <div className={`text-xs font-semibold text-emerald-600 ${className}`}>
        {formatCurrency(priceValue, currency)}
      </div>
    );
  };

  const [showLargeImage, setShowLargeImage] = useState<boolean>(false);

  const [showFab, setShowFab] = useState(false);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);

  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);

  const normalizedSelectedSets = useMemo(
    () => selectedSets.map((value) => value.toLowerCase()),
    [selectedSets]
  );

  const [isGrid, setIsGrid] = useState(false);

  const [isTouchable, setIsTouchable] = useState(true);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<string>("");
  const [selectedTrigger, setSelectedTrigger] = useState<string>("");
  const [selectedSort, setSelectedSort] = useState<string>("");
  const [viewSelected, setViewSelected] = useState<
    "grid" | "list" | "alternate" | "text"
  >("list");
  const isPriceSort =
    selectedSort === "price_high" || selectedSort === "price_low";

  const nonLeaderCategories = useMemo(
    () =>
      categoryOptions
        .map((option) => option.value)
        .filter((value) => value.toLowerCase() !== "leader"),
    []
  );

  // Toggle para mostrar solo cartas base (isFirstEdition = true) u ocultar alternas
  const [showOnlyBaseCards, setShowOnlyBaseCards] = useState(false);

  // Estado para trackear qué carta está siendo tocada (para mostrar badge en mobile)
  const [touchedCardId, setTouchedCardId] = useState<number | string | null>(
    null
  );

  // Detectar si es desktop para mostrar badges de código
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return false;
  });

  useEffect(() => {
    const updateViewport = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  // Card preview dialog state
  const [previewCard, setPreviewCard] = useState<CardWithCollectionData | null>(
    null
  );
  const [previewBaseCard, setPreviewBaseCard] =
    useState<CardWithCollectionData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Open card preview
  const openCardPreview = useCallback(
    (card: CardWithCollectionData, baseCard?: CardWithCollectionData) => {
      setPreviewCard(card);
      setPreviewBaseCard(baseCard || card);
      setIsPreviewOpen(true);
    },
    []
  );

  // Close card preview
  const closeCardPreview = useCallback(() => {
    setIsPreviewOpen(false);
    setTimeout(() => {
      setPreviewCard(null);
      setPreviewBaseCard(null);
    }, 300);
  }, []);

  // Get quantity of a specific card in the deck
  const getCardQuantityInDeck = useCallback(
    (cardId: number | string) => {
      const card = deckBuilder.deckCards.find(
        (c) => c.cardId === Number(cardId)
      );
      return card?.quantity || 0;
    },
    [deckBuilder.deckCards]
  );

  // Get total quantity by code in deck
  const getTotalQuantityByCode = useCallback(
    (code: string) => {
      return deckBuilder.deckCards
        .filter((c) => c.code === code)
        .reduce((sum, c) => sum + c.quantity, 0);
    },
    [deckBuilder.deckCards]
  );

  const getMaxQuantityForCode = useCallback((code?: string) => {
    return code === "OP08-072" || code === "OP01-075" ? 50 : 4;
  }, []);

  const isLeaderCategory = (category?: string | null) =>
    (category ?? "").toLowerCase().trim() === "leader";

  const getCardColorTokens = useCallback((card: CardWithCollectionData) => {
    const rawColors = Array.isArray(card.colors) ? card.colors : [];
    const tokens = rawColors
      .flatMap((c: { color?: string } | string) =>
        String(typeof c === "string" ? c : c?.color || "").split(/[\\/,+]/)
      )
      .map((color) => color.toLowerCase().trim())
      .filter(Boolean);
    if (tokens.length > 0) return tokens;
    const fallback = (card as any).color;
    const normalizedFallback = String(fallback || "")
      .toLowerCase()
      .trim();
    return normalizedFallback ? [normalizedFallback] : [];
  }, []);

  // Si hay un Leader seleccionado, obtenemos sus colores
  const leaderColors = useMemo(() => {
    if (!deckBuilder.selectedLeader) return [];
    const rawColors = Array.isArray(deckBuilder.selectedLeader.colors)
      ? deckBuilder.selectedLeader.colors
      : [];
    const normalizedColors = rawColors
      .map((c: { color?: string } | string) =>
        typeof c === "string" ? c : c?.color
      )
      .map((color: string | undefined) => (color ?? "").toLowerCase().trim())
      .filter(Boolean);
    if (normalizedColors.length > 0) return normalizedColors;
    const fallback = (deckBuilder.selectedLeader.color ?? "")
      .toString()
      .toLowerCase()
      .trim();
    return fallback ? [fallback] : [];
  }, [deckBuilder.selectedLeader]);

  const cardsFilters = useMemo<CardsFilters>(() => {
    // Map selectedSort to backend sortBy format
    const sortBy = selectedSort
      ? (selectedSort as CardsFilters["sortBy"])
      : undefined;

    // Exclude DON cards when sorting is applied (unless user explicitly filters by DON category)
    const shouldExcludeDON = sortBy && selectedCategories.length === 0;

    return {
      sortBy,
      search: search.trim() || undefined,
      colors:
        selectedColors.length > 0
          ? selectedColors
          : deckBuilder.selectedLeader && leaderColors.length > 0
          ? leaderColors
          : undefined,
      sets: selectedSets.length ? selectedSets : undefined,
      setCodes: selectedCodes.length ? selectedCodes : undefined,
      rarities: selectedRarities.length ? selectedRarities : undefined,
      costs: selectedCosts.length ? selectedCosts : undefined,
      power: selectedPower.length ? selectedPower : undefined,
      attributes: selectedAttributes.length ? selectedAttributes : undefined,
      categories: deckBuilder.selectedLeader
        ? selectedCategories.length
          ? selectedCategories
          : nonLeaderCategories
        : ["Leader"],
      excludeCategories: shouldExcludeDON ? ["DON"] : undefined,
      effects: selectedEffects.length ? selectedEffects : undefined,
      types: selectedTypes.length ? selectedTypes : undefined,
      altArts: selectedAltArts.length ? selectedAltArts : undefined,
      counter: selectedCounter || undefined,
      trigger: selectedTrigger || undefined,
      // When sorting by price and showOnlyBaseCards is active, filter on server
      baseOnly: sortBy && showOnlyBaseCards ? true : undefined,
    };
  }, [
    search,
    selectedColors,
    selectedSets,
    selectedCodes,
    selectedRarities,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedCategories,
    selectedEffects,
    selectedTypes,
    selectedAltArts,
    selectedCounter,
    selectedTrigger,
    selectedSort,
    showOnlyBaseCards,
    deckBuilder.selectedLeader,
    leaderColors,
    nonLeaderCategories,
  ]);

  const isBackendSort = Boolean(cardsFilters.sortBy);

  // When editing/forking a deck, wait for the deck AND leader to load before fetching cards
  // This ensures selectedLeader is set and filters are correct (categories will be non-Leader)
  const shouldFetchCards =
    useServerCards &&
    (isFork
      ? deckBuilder.isDeckLoaded && deckBuilder.selectedLeader !== null
      : true);

  const {
    cards: serverCards,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingCards,
    isFetching: isFetchingCards,
    totalCount,
  } = usePaginatedCards(cardsFilters, {
    limit: 60,
    enabled: shouldFetchCards,
    initialData: initialQueryData,
  });

  // Get total count from database with filters
  const { data: countData, isFetching: isCounting } = useCardsCount(
    cardsFilters,
    {
      enabled: shouldFetchCards,
    }
  );

  const cardsSource = useServerCards ? serverCards : initialCards;

  // Total results - prefer count from API, fallback to pagination count
  const totalResults = countData ?? totalCount ?? cardsSource.length;

  const [visibleCount, setVisibleCount] = useState(50);
  const [selectedCard, setSelectedCard] = useState<DeckCard | undefined>();

  const [showLargeImageCard, setShowLargeImageCard] = useState<boolean>(false);

  // Estados adicionales para StoreCard
  const [baseCard, setBaseCard] = useState<any>(null);
  const [alternatesCards, setAlternatesCards] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Estado para controlar el drawer del deck en mobile
  const [isDeckDrawerOpen, setIsDeckDrawerOpen] = useState(false);
  const isShopView = Boolean(isShopMode);
  const showShopFields =
    isShopView && Boolean(setShopSlug) && Boolean(setShopUrl);
  const shopSlugValue = shopSlug ?? "";
  const shopUrlValue = shopUrl ?? "";
  const shopFieldsMissing =
    isShopView && (!shopSlugValue.trim() || !shopUrlValue.trim());

  const handleSlugInputChange = (value: string) => {
    if (!setShopSlug) return;
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setShopSlug(normalized);
  };

  const handleShopUrlChange = (value: string) => {
    if (!setShopUrl) return;
    setShopUrl(value);
  };

  // Función para resaltar texto en búsquedas
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  };

  // Función para manejar click en cards desde StoreCard
  const handleStoreCardClick = (card: CardWithCollectionData) => {
    const totalQuantityBase = deckBuilder.deckCards
      ?.filter((card_alt) => card_alt.code === card.code)
      .reduce((sum, card_alt) => sum + card_alt.quantity, 0);

    if (totalQuantityBase >= 4) {
      showWarningToast(
        "You can't add more than 4 cards of the same code to the deck."
      );
      return;
    }

    handleCardClick(null, card, card);
  };

  // Función wrapper para setSelectedCard compatible con StoreCard
  const handleSetSelectedCard = (card: CardWithCollectionData) => {
    // Conversión de CardWithCollectionData a DeckCard
    const deckCard: DeckCard = {
      cardId: Number(card.id),
      id: Number(card.id),
      name: card.name,
      rarity: card.rarity ?? "",
      src: card.src,
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
    };
    setSelectedCard(deckCard);
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
    selectedAttributes?.length +
    selectedCodes?.length +
    selectedAltArts?.length;

  const matchesCardCode = (code: string, search: string) => {
    const query = search.toLowerCase().trim();
    const fullCode = code.toLowerCase();

    // Si el query incluye un guión, se busca de forma literal.
    if (query.includes("-")) {
      return fullCode.includes(query);
    }

    // Separamos el código en partes usando el guión.
    const parts = code.split("-");

    // Si el query es numérico.
    if (/^\d+$/.test(query)) {
      if (query[0] === "0") {
        // Si inicia con cero, se compara la cadena exacta.
        return parts.some((part) => {
          const matchDigits = part.match(/\d+/);
          return matchDigits ? matchDigits[0] === query : false;
        });
      } else {
        // Si no inicia con cero, se compara numéricamente.
        const queryNumber = parseInt(query, 10);
        return parts.some((part) => {
          const matchDigits = part.match(/\d+/);
          return matchDigits
            ? parseInt(matchDigits[0], 10) === queryNumber
            : false;
        });
      }
    }

    // Si el query no es numérico, se busca por subcadena en cada parte.
    return parts.some((part) => part.toLowerCase().includes(query));
  };

  const filteredCards = useMemo(() => {
    if (!cardsSource || cardsSource.length === 0) return [];

    const mapped = cardsSource
      .filter((card) => {
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
          selectedColors.length === 0 ||
          getCardColorTokens(card).some((color) =>
            selectedColors.includes(color)
          );

        // Dividir setCode por comas y verificar si alguno coincide
        const baseSetCodes = (card.setCode ?? "")
          .split(",")
          .map((code) => code.trim().toLowerCase())
          .filter(Boolean);
        const matchesBaseSet = baseSetCodes.some((code) =>
          normalizedSelectedSets.includes(code)
        );

        const matchesAlternateSet =
          card.alternates?.some((alt) => {
            const altSetCodes = (alt.setCode ?? "")
              .split(",")
              .map((code) => code.trim().toLowerCase())
              .filter(Boolean);
            return altSetCodes.some((code) =>
              normalizedSelectedSets.includes(code)
            );
          }) ?? false;

        const matchesSets =
          normalizedSelectedSets.length === 0 ||
          matchesBaseSet ||
          matchesAlternateSet;

        const matchesTypes =
          selectedTypes.length === 0 ||
          card.types.some((type) => selectedTypes.includes(type.type));

        const matchesEffects =
          selectedEffects.length === 0 ||
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
          ) ||
          selectedAltArts.includes(card.alternateArt ?? "");

        const matchesCosts =
          selectedCosts.length === 0 || selectedCosts.includes(card.cost ?? "");

        const matchesPower =
          selectedPower.length === 0 ||
          selectedPower.includes(card.power ?? "");

        const matchesCategories =
          selectedCategories.length === 0 ||
          selectedCategories.includes(card.category ?? "");

        const matchesAttributes =
          selectedAttributes.length === 0 ||
          selectedAttributes.includes(card.attribute ?? "");

        const matchesCounter =
          selectedCounter === ""
            ? true
            : selectedCounter === "No counter"
            ? card.counter == null
            : card.counter?.includes(selectedCounter);

        const matchedTrigger =
          selectedTrigger === ""
            ? true
            : selectedTrigger === "No trigger"
            ? card.triggerCard === null
            : card.triggerCard !== null;

        const matchedCode =
          selectedCodes?.length === 0 ||
          (card.setCode ?? "")
            .split(",")
            .some((code) => selectedCodes.includes(code.trim()));

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
      })
      .map((card) => ({
        ...card,
        // Filtrar alternativas excluidas (ocultar todas si showOnlyBaseCards está activo)
        alternates: filterValidAlternates(card.alternates, showOnlyBaseCards),
      }));

    if (isBackendSort) {
      return mapped;
    }

    return mapped.sort((a, b) => {
      // Primero ordenar por el sort seleccionado si existe
      if (selectedSort === "Most variants") {
        const variantDiff =
          (b.alternates?.length ?? 0) - (a.alternates?.length ?? 0);
        if (variantDiff !== 0) return variantDiff;
      } else if (selectedSort === "Less variants") {
        const variantDiff =
          (a.alternates?.length ?? 0) - (b.alternates?.length ?? 0);
        if (variantDiff !== 0) return variantDiff;
      }

      // Luego aplicar orden estándar de colección (OP → EB → ST → P → otros)
      return sortByCollectionOrder(a, b);
    });
  }, [
    cardsSource,
    search,
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
    selectedSort,
    selectedAltArts,
    selectedCodes,
    showOnlyBaseCards,
    isBackendSort,
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isInputClear, setIsInputClear] = useState(false);

  // Ref para la lista de cartas (grid)
  const gridRef = useRef<HTMLDivElement>(null);

  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Estado para controlar el sidebar de filtros
  const [isModalOpen, setIsModalOpen] = useState(false);

  const disabledColors = leaderColors.length
    ? allColors?.filter((color) => !leaderColors.includes(color))
    : [];

  // Filtrado adicional:
  // - Si NO hay un Leader seleccionado: mostramos solo cartas de la categoría "Leader".
  // - Si hay un Leader seleccionado: mostramos solo cartas que no sean de la categoría "Leader"
  //   y que tengan al menos un color en común con el Leader.
  const filteredByLeader = useMemo(() => {
    if (!filteredCards) return []; // ⚡ Retornar array vacío en vez de null

    const filtered = deckBuilder.selectedLeader
      ? filteredCards.filter((card) => {
          const matchesLeaderColors =
            leaderColors.length === 0
              ? true
              : getCardColorTokens(card).some((color) =>
                  leaderColors.includes(color)
                );
          return !isLeaderCategory(card.category) && matchesLeaderColors;
        })
      : filteredCards.filter((card) => isLeaderCategory(card.category));

    if (isBackendSort) {
      return filtered;
    }

    // Las cartas ya vienen ordenadas de filteredCards, pero aseguramos el orden
    return filtered.sort(sortByCollectionOrder);
  }, [filteredCards, deckBuilder.selectedLeader, leaderColors, isBackendSort]);

  // Calcula el total de cartas agregadas en el deck
  const totalCards = deckBuilder.deckCards.reduce(
    (total, card) => total + card.quantity,
    0
  );

  // Calcular el precio total del deck
  const { totalDeckPrice, cardsWithPrice, cardsWithoutPrice } = useMemo(() => {
    let total = 0;
    let withPrice = 0;
    let withoutPrice = 0;

    // Incluir el precio del leader si existe
    if (deckBuilder.selectedLeader) {
      // Buscar el leader en cardsSource (puede ser base o alternativa)
      let foundLeader: CardWithCollectionData | undefined;

      // Primero buscar en las cartas base
      foundLeader = cardsSource.find(
        (card) => Number(card.id) === Number(deckBuilder.selectedLeader?.id)
      );

      // Si no se encuentra en las bases, buscar en las alternativas
      if (!foundLeader) {
        for (const card of cardsSource) {
          const alternate = card.alternates?.find(
            (alt) => Number(alt.id) === Number(deckBuilder.selectedLeader?.id)
          );
          if (alternate) {
            foundLeader = alternate;
            break;
          }
        }
      }

      if (foundLeader) {
        const leaderPrice = getCardPriceValue(foundLeader);
        if (leaderPrice !== null) {
          total += leaderPrice;
          withPrice++;
        } else {
          withoutPrice++;
        }
      } else {
        withoutPrice++;
      }
    }

    // Calcular precio de todas las cartas del deck
    deckBuilder.deckCards.forEach((deckCard) => {
      // Buscar la carta original en cardsSource (puede ser base o alternativa)
      let foundCard: CardWithCollectionData | undefined;

      // Primero buscar en las cartas base
      foundCard = cardsSource.find(
        (card) => Number(card.id) === deckCard.cardId
      );

      // Si no se encuentra en las bases, buscar en las alternativas
      if (!foundCard) {
        for (const card of cardsSource) {
          const alternate = card.alternates?.find(
            (alt) => Number(alt.id) === deckCard.cardId
          );
          if (alternate) {
            foundCard = alternate;
            break;
          }
        }
      }

      if (foundCard) {
        const cardPrice = getCardPriceValue(foundCard);
        if (cardPrice !== null) {
          total += cardPrice * deckCard.quantity;
          withPrice += deckCard.quantity;
        } else {
          withoutPrice += deckCard.quantity;
        }
      } else {
        withoutPrice += deckCard.quantity;
      }
    });

    return {
      totalDeckPrice: total,
      cardsWithPrice: withPrice,
      cardsWithoutPrice: withoutPrice,
    };
  }, [
    deckBuilder.deckCards,
    deckBuilder.selectedLeader,
    cardsSource,
    getCardPriceValue,
  ]);

  const handleScrollToTop = () => {
    gridRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    if (!useServerCards) {
      setVisibleCount(50);
    }
  };

  const resetVisibleCount = () => {
    if (!useServerCards) {
      setVisibleCount(50);
    }
  };

  // Handler para el click en cada carta
  const handleCardClick = (
    _e: MouseEvent<HTMLDivElement> | null,
    card: CardWithCollectionData,
    alternate: CardWithCollectionData
  ) => {
    // Si no hay leader seleccionado, asignamos este card como leader y
    // hacemos scroll hasta el principio de la lista.
    if (!deckBuilder.selectedLeader) {
      deckBuilder.setSelectedLeader({
        ...card,
        src: alternate.src,
        id: Number(alternate.id),
        marketPrice: alternate.marketPrice,
        priceCurrency: alternate.priceCurrency,
      });
      setSearch("");
      setIsInputClear(true);
      setTimeout(() => {
        gridRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, 100); // Puedes ajustar el tiempo si es necesario
    } else {
      if (totalCards >= 50) {
        showWarningToast("You can't add more than 50 cards to the deck.");
        return;
      }

      // Si ya hay leader, agregamos la carta y luego hacemos scroll al contenedor del card.
      deckBuilder.handleAddCard({
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
        set: alternate.sets[0].set.title,
        power: card.power ?? "",
        counter: card.counter ?? "",
        attribute: card.attribute ?? "",
        marketPrice: alternate.marketPrice,
        priceCurrency: alternate.priceCurrency,
      } as any);

      // Scroll para que el card clickeado quede centrado
      // Scroll para que el card clickeado quede centrado solo si no se ve completamente
      if (_e) {
        const containerRect = gridRef.current?.getBoundingClientRect();
        const cardRect = _e.currentTarget.getBoundingClientRect();

        if (containerRect) {
          if (
            cardRect.top < containerRect.top ||
            cardRect.bottom > containerRect.bottom
          ) {
            _e.currentTarget.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        } else {
          // Si no se puede obtener el contenedor, se hace scroll como fallback.
          _e.currentTarget.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }

      // Esperamos un momento para que se actualice el array de cartas y luego scroll al grupo de la carta agregada.
      setTimeout(() => {
        const groupElement = groupRefs.current[card.code];
        if (groupElement) {
          groupElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300); // Ajusta el delay si es necesario.
    }
  };

  // Función para eliminar la carta al hacer swipe
  const removeCard = (cardId: number) => {
    deckBuilder.setDeckCards((prev) =>
      prev?.filter((card) => card.cardId !== cardId)
    );
    containerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };
  // Agrupamos las cartas por código sin modificar sus cantidades:
  const groupedCards = Object.values(
    deckBuilder.deckCards.reduce((groups, card) => {
      if (!groups[card.code]) {
        groups[card.code] = [];
      }
      groups[card.code].push(card);
      return groups;
    }, {} as Record<string, typeof deckBuilder.deckCards>)
  );

  // Ordenamos las cartas según el criterio:
  // 1. Las cartas que no son "Event" se ordenan por costo de menor a mayor.
  // 2. Las cartas de tipo "Event" se ubican siempre al final, sin importar el costo.
  groupedCards.sort((groupA, groupB) => {
    const cardA = groupA[0];
    const cardB = groupB[0];

    const isSpecialA = cardA.category === "Event" || cardA.category === "Stage";
    const isSpecialB = cardB.category === "Event" || cardB.category === "Stage";

    // Si uno es Event/Stage y el otro no, el Event/Stage va al final:
    if (isSpecialA !== isSpecialB) {
      return isSpecialA ? 1 : -1;
    }

    // Si ambos son Event/Stage o ninguno lo es, ordenar por costo ascendente.
    const costA = parseInt(cardA.cost ?? "0", 10);
    const costB = parseInt(cardB.cost ?? "0", 10);
    return costA - costB;
  });

  // Infinite scroll usando scroll event (como en card-list)
  useEffect(() => {
    const container = gridRef.current;
    if (!container) return;

    const BATCH_SIZE = 50;
    const LOAD_THRESHOLD_PX = 800;
    const isLoadingMoreRef = { current: false };

    const handleScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = container;
      const remaining = scrollHeight - (scrollTop + clientHeight);

      if (remaining > LOAD_THRESHOLD_PX || isLoadingMoreRef.current) {
        return;
      }

      isLoadingMoreRef.current = true;

      if (useServerCards) {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage().finally(() => {
            isLoadingMoreRef.current = false;
          });
        } else {
          isLoadingMoreRef.current = false;
        }
        return;
      }

      if (visibleCount < (filteredByLeader?.length ?? 0)) {
        setVisibleCount((prev) =>
          Math.min(prev + BATCH_SIZE, filteredByLeader?.length ?? 0)
        );
      }

      setTimeout(() => {
        isLoadingMoreRef.current = false;
      }, 100);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [
    visibleCount,
    filteredByLeader?.length,
    useServerCards,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  useEffect(() => {
    if (useServerCards) {
      setVisibleCount(filteredByLeader?.length ?? 0);
    }
  }, [useServerCards, filteredByLeader?.length]);

  useEffect(() => {
    if (deckBuilder.deckCards.length > 0 || !isFork) {
      setLoading(false);
    }
  }, [deckBuilder.deckCards, isFork]);

  useEffect(() => {
    if (!showLargeImageCard) {
      setTimeout(() => {
        setIsTouchable(true);
      }, 300);
    } else {
      setIsTouchable(false);
    }
  }, [showLargeImageCard]);

  return (
    <div className="flex flex-1 bg-[#f2eede] w-full h-full overflow-hidden">
      {/* Mobile FAB - Open Deck Drawer */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsDeckDrawerOpen(true)}
          className="relative flex items-center justify-center h-16 w-16 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Layers className="h-7 w-7" />
          {totalCards > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold border-2 border-white">
              {totalCards}
            </div>
          )}
        </button>
      </div>

      {/* Mobile Deck Drawer */}
      <div className="md:hidden">
        <DeckBuilderDrawer
          isOpen={isDeckDrawerOpen}
          onClose={() => setIsDeckDrawerOpen(false)}
          deckBuilder={deckBuilder}
          deckName={deckName}
          setDeckName={setDeckName}
          onSave={onSave}
          onRestart={onRestart}
          onProxies={onProxies}
          isShopMode={isShopMode}
          shopSlug={shopSlug}
          setShopSlug={setShopSlug}
          shopUrl={shopUrl}
          setShopUrl={setShopUrl}
          isPublished={isPublished}
          setIsPublished={setIsPublished}
          formatCurrency={formatCurrency}
          getCardPriceValue={getCardPriceValue}
        />
      </div>

      {/* Sidebar izquierdo: Lista de cartas disponibles con filtros */}
      <div className="bg-white flex w-full md:w-[300px] lg:w-[400px] xl:w-[450px] flex-shrink-0 border-r border-slate-200 min-h-0 flex-col">
        {/* Controles móviles */}
        <div className="flex p-3 flex-col gap-3 border-b border-[#f5f5f5]">
          <DropdownSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search..."
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-[42px] text-sm font-medium transition-all active:scale-95 ${
                totalFilters > 0
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {totalFilters > 0 && (
                <>
                  <span className="bg-blue-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {totalFilters}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
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
                    }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 transition-colors"
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

            <div className="ml-auto flex items-center gap-2">
              <SortSelect
                options={SORT_OPTIONS}
                selected={selectedSort}
                setSelected={setSelectedSort}
                buttonLabel="Sort"
              />
              {/* <ViewSwitch
                viewSelected={viewSelected}
                setViewSelected={setViewSelected}
              /> */}
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-slate-500">
            {totalResults?.toLocaleString()} cards found
            {(isFetchingCards || isFetchingNextPage || isCounting) && (
              <span className="ml-2 text-blue-600">Loading...</span>
            )}
          </p>
        </div>

        {/* Lista de cartas disponibles */}
        <div
          className="p-3 pb-28 md:pb-3 overflow-y-auto flex-1 min-h-0"
          ref={gridRef}
        >
          {/* Banner para seleccionar Leader - Solo visible cuando no hay leader and not loading deck
              In fork mode, never show this banner since we always expect a leader from the deck */}
          {!deckBuilder.selectedLeader && !isLoadingCards && !isFork && (
            <div className="mb-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 shadow-lg border border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-base leading-tight">
                    Select your Leader
                  </h3>
                  <p className="text-slate-400 text-sm mt-0.5 leading-snug">
                    Tap on a Leader card to start
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Skeleton de carga - Mobile first (matching DeckDetailView style) */}
          {(isLoadingCards ||
            (isFork &&
              (!deckBuilder.isDeckLoaded || !deckBuilder.selectedLeader)) ||
            (isFetchingCards && cardsSource.length === 0)) && (
            <div className="grid gap-1.5 sm:gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="aspect-[3/4.2] bg-gray-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
          )}

          {!isLoadingCards &&
            (!isFork ||
              (deckBuilder.isDeckLoaded && deckBuilder.selectedLeader)) &&
            !(isFetchingCards && cardsSource.length === 0) &&
            viewSelected === "alternate" && (
              <div className="flex flex-col gap-5">
                {filteredByLeader?.slice(0, visibleCount).map((card, index) => {
                  // Función que verifica si la carta base cumple con los filtros de display
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

                  const totalQuantityBase = deckBuilder.deckCards
                    ?.filter((card_alt) => card_alt.code === card.code)
                    .reduce((sum, card_alt) => sum + card_alt.quantity, 0);

                  return (
                    <div className="flex flex-col gap-5" key={card.id}>
                      <div className="grid gap-3 grid-cols-2 mb-3">
                        {/* Info Card */}
                        <div className="bg-black border rounded-lg shadow p-5 h-full text-white">
                          <div className="h-full flex flex-col justify-around items-center relative">
                            <div className="flex items-center justify-between flex-col mt-4">
                              <h2 className="text-lg font-black break-normal mb-2 text-center leading-tight line-clamp-2">
                                {card?.name}
                              </h2>
                              <p
                                className={`${oswald.className} text-md text-white leading-[16px] mb-4 font-[400]`}
                              >
                                {card?.code}
                              </p>
                              <div className="flex justify-between items-end flex-col gap-1 mb-1 mr-1">
                                <Badge
                                  variant="secondary"
                                  className="text-sm !bg-white text-black rounded-full min-w-[41px] text-center border border-[#000]"
                                >
                                  <span className="text-center w-full font-black leading-[16px] mb-[2px]">
                                    {card?.rarity}
                                  </span>
                                </Badge>
                              </div>
                              <div className="flex flex-col mt-2">
                                {card?.types.map((type) => (
                                  <span
                                    key={type.type}
                                    className="text-[13px] leading-[15px] font-[200] text-center"
                                  >
                                    {type.type}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 mt-3">
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
                        </div>

                        {/* Base Card */}
                        {baseCardMatches() &&
                          (() => {
                            const baseCardInDeck = deckBuilder.deckCards.find(
                              (deckCard) => deckCard.cardId === Number(card.id)
                            );
                            const baseCardQuantity =
                              baseCardInDeck?.quantity || 0;
                            const baseMaxQuantity = getMaxQuantityForCode(
                              card.code
                            );
                            const baseTotalByCode = getTotalQuantityByCode(
                              card.code
                            );
                            const canAddMore =
                              baseTotalByCode < baseMaxQuantity;
                            const showQuantityControls = true;

                            return (
                              <div
                                onClick={() => {
                                  if (totalQuantityBase < baseMaxQuantity) {
                                    handleCardClick(null, card, card);
                                  }
                                }}
                                onMouseEnter={() =>
                                  card.src &&
                                  smartPrefetch(card.src, "large", true)
                                }
                                onTouchStart={() => {
                                  if (card.src)
                                    smartPrefetch(card.src, "large", true);
                                  setTouchedCardId(card.id);
                                }}
                                onTouchEnd={() => setTouchedCardId(null)}
                                onTouchCancel={() => setTouchedCardId(null)}
                                onContextMenu={(e) => e.preventDefault()}
                                className={`cursor-pointer border rounded-lg shadow bg-white flex justify-center items-center p-4 flex-col h-full ${
                                  totalQuantityBase >= baseMaxQuantity
                                    ? "opacity-70 grayscale"
                                    : "hover:shadow-md"
                                }`}
                              >
                                <div className="flex justify-center items-center w-full relative">
                                  <LazyImage
                                    src={card?.src}
                                    fallbackSrc="/assets/images/backcard.webp"
                                    alt={card?.name}
                                    priority={index < 20}
                                    size="small"
                                    className="w-[80%] m-auto"
                                  />
                                  {/* Code Badge */}
                                  {card.code && (
                                    <div
                                      className={`absolute top-0 left-0 bg-black text-white rounded-tl-md px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-10 transition-all duration-300 ease-in-out ${
                                        isDesktop || touchedCardId === card.id
                                          ? "opacity-100 translate-y-0"
                                          : "opacity-0 -translate-y-2 pointer-events-none"
                                      }`}
                                    >
                                      {card.code}
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCardPreview(card, card);
                                    }}
                                    onTouchEnd={(e) => {
                                      e.stopPropagation();
                                      openCardPreview(card, card);
                                    }}
                                    className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-gray-600 rounded-tr-md rounded-bl-lg p-1.5 z-10 border-l border-b border-gray-200 hover:bg-white hover:text-gray-900 active:scale-95 transition-all"
                                    aria-label="View card details"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  {/* Price Badge */}
                                  {(() => {
                                    const priceValue = getCardPriceValue(card);
                                    if (priceValue !== null) {
                                      return (
                                        <div className="absolute bottom-0 left-0 bg-emerald-600 text-white rounded-bl-md px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-10">
                                          {formatCurrency(
                                            priceValue,
                                            card.priceCurrency
                                          )}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                                {showQuantityControls && (
                                  <div className="w-full mt-2 px-1">
                                    <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-2 py-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (baseCardQuantity > 0) {
                                            deckBuilder.updateDeckCardQuantity(
                                              Number(card.id),
                                              baseCardQuantity - 1
                                            );
                                          }
                                        }}
                                        onTouchEnd={(e) => {
                                          e.stopPropagation();
                                          if (baseCardQuantity > 0) {
                                            deckBuilder.updateDeckCardQuantity(
                                              Number(card.id),
                                              baseCardQuantity - 1
                                            );
                                          }
                                        }}
                                        disabled={baseCardQuantity <= 0}
                                        className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all disabled:opacity-40"
                                        aria-label="Remove one"
                                      >
                                        <Minus className="h-4 w-4" />
                                      </button>
                                      <div className="flex items-center justify-center">
                                        <span className="text-white font-bold text-base">
                                          {baseCardQuantity}
                                        </span>
                                        <span className="text-white/60 text-xs ml-1">
                                          /{baseMaxQuantity}
                                        </span>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (canAddMore) {
                                            deckBuilder.updateDeckCardQuantity(
                                              Number(card.id),
                                              baseCardQuantity + 1
                                            );
                                          } else {
                                            showWarningToast(
                                              `Max ${baseMaxQuantity} cards reached.`
                                            );
                                          }
                                        }}
                                        onTouchEnd={(e) => {
                                          e.stopPropagation();
                                          if (canAddMore) {
                                            deckBuilder.updateDeckCardQuantity(
                                              Number(card.id),
                                              baseCardQuantity + 1
                                            );
                                          } else {
                                            showWarningToast(
                                              `Max ${baseMaxQuantity} cards reached.`
                                            );
                                          }
                                        }}
                                        disabled={!canAddMore}
                                        className={`h-7 w-7 rounded-md flex items-center justify-center active:scale-95 transition-all ${
                                          canAddMore
                                            ? "bg-white/15 text-white hover:bg-white/25"
                                            : "bg-white/5 text-white/30 cursor-not-allowed"
                                        }`}
                                        aria-label="Add one"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <div className="text-center font-bold mt-2">
                                    Base
                                  </div>
                                  {card.sets?.map((set) => (
                                    <p
                                      key={set.set.title}
                                      className="text-[13px] leading-[15px] font-[200] text-center line-clamp-2"
                                    >
                                      {set.set.title}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                        {/* Alternate Cards */}
                        {filteredAlts.map((alt) => {
                          const alternateInDeck = deckBuilder.deckCards.find(
                            (deckCard) => deckCard.cardId === Number(alt.id)
                          );
                          const alternateQuantity =
                            alternateInDeck?.quantity || 0;
                          const alternateMaxQuantity = getMaxQuantityForCode(
                            card.code
                          );
                          const alternateTotalByCode = getTotalQuantityByCode(
                            card.code
                          );
                          const canAddMore =
                            alternateTotalByCode < alternateMaxQuantity;
                          const showQuantityControls = true;
                          const totalQuantity = deckBuilder.deckCards
                            ?.filter((card_alt) => card_alt.code === card.code)
                            .reduce(
                              (sum, card_alt) => sum + card_alt.quantity,
                              0
                            );

                          return (
                            <div
                              key={alt.id}
                              onClick={() => {
                                if (totalQuantity < 4) {
                                  handleCardClick(null, card, alt);
                                }
                              }}
                              onMouseEnter={() =>
                                alt.src && smartPrefetch(alt.src, "large", true)
                              }
                              onTouchStart={() => {
                                if (alt.src)
                                  smartPrefetch(alt.src, "large", true);
                                setTouchedCardId(alt.id);
                              }}
                              onTouchEnd={() => setTouchedCardId(null)}
                              onTouchCancel={() => setTouchedCardId(null)}
                              onContextMenu={(e) => e.preventDefault()}
                              className={`cursor-pointer border rounded-lg shadow bg-white flex justify-center items-center p-4 flex-col h-full ${
                                totalQuantity >= alternateMaxQuantity
                                  ? "opacity-70 grayscale"
                                  : "hover:shadow-md"
                              }`}
                            >
                              <div className="flex justify-center items-center w-full relative">
                                <LazyImage
                                  src={alt?.src}
                                  fallbackSrc="/assets/images/backcard.webp"
                                  alt={alt?.name}
                                  priority={index < 20}
                                  size="small"
                                  className="w-[80%] m-auto"
                                />
                                {/* Code Badge */}
                                {card.code && (
                                  <div
                                    className={`absolute top-0 left-0 bg-black text-white rounded-tl-md px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-10 transition-all duration-300 ease-in-out ${
                                      isDesktop || touchedCardId === alt.id
                                        ? "opacity-100 translate-y-0"
                                        : "opacity-0 -translate-y-2 pointer-events-none"
                                    }`}
                                  >
                                    {card.code}
                                  </div>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCardPreview(alt, card);
                                  }}
                                  onTouchEnd={(e) => {
                                    e.stopPropagation();
                                    openCardPreview(alt, card);
                                  }}
                                  className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-gray-600 rounded-tr-md rounded-bl-lg p-1.5 z-10 border-l border-b border-gray-200 hover:bg-white hover:text-gray-900 active:scale-95 transition-all"
                                  aria-label="View card details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                {/* Price Badge */}
                                {(() => {
                                  const priceValue = getCardPriceValue(alt);
                                  if (priceValue !== null) {
                                    return (
                                      <div className="absolute bottom-0 left-0 bg-emerald-600 text-white rounded-bl-md px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-10">
                                        {formatCurrency(
                                          priceValue,
                                          alt.priceCurrency
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              {showQuantityControls && (
                                <div className="w-full mt-2 px-1">
                                  <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-2 py-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (alternateQuantity > 0) {
                                          deckBuilder.updateDeckCardQuantity(
                                            Number(alt.id),
                                            alternateQuantity - 1
                                          );
                                        }
                                      }}
                                      onTouchEnd={(e) => {
                                        e.stopPropagation();
                                        if (alternateQuantity > 0) {
                                          deckBuilder.updateDeckCardQuantity(
                                            Number(alt.id),
                                            alternateQuantity - 1
                                          );
                                        }
                                      }}
                                      disabled={alternateQuantity <= 0}
                                      className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all disabled:opacity-40"
                                      aria-label="Remove one"
                                    >
                                      <Minus className="h-4 w-4" />
                                    </button>
                                    <div className="flex items-center justify-center">
                                      <span className="text-white font-bold text-base">
                                        {alternateQuantity}
                                      </span>
                                      <span className="text-white/60 text-xs ml-1">
                                        /{alternateMaxQuantity}
                                      </span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (canAddMore) {
                                          deckBuilder.updateDeckCardQuantity(
                                            Number(alt.id),
                                            alternateQuantity + 1
                                          );
                                        } else {
                                          showWarningToast(
                                            `Max ${alternateMaxQuantity} cards reached.`
                                          );
                                        }
                                      }}
                                      onTouchEnd={(e) => {
                                        e.stopPropagation();
                                        if (canAddMore) {
                                          deckBuilder.updateDeckCardQuantity(
                                            Number(alt.id),
                                            alternateQuantity + 1
                                          );
                                        } else {
                                          showWarningToast(
                                            `Max ${alternateMaxQuantity} cards reached.`
                                          );
                                        }
                                      }}
                                      disabled={!canAddMore}
                                      className={`h-7 w-7 rounded-md flex items-center justify-center active:scale-95 transition-all ${
                                        canAddMore
                                          ? "bg-white/15 text-white hover:bg-white/25"
                                          : "bg-white/5 text-white/30 cursor-not-allowed"
                                      }`}
                                      aria-label="Add one"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div>
                                <div className="text-center font-bold mt-2">
                                  {alt?.alternateArt}
                                </div>
                                {alt?.sets?.map((set) => (
                                  <p
                                    key={set.set.title}
                                    className="text-[13px] leading-[15px] font-[200] text-center line-clamp-2"
                                  >
                                    {set.set.title}
                                  </p>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {!isLoadingCards &&
            (!isFork ||
              (deckBuilder.isDeckLoaded && deckBuilder.selectedLeader)) &&
            !(isFetchingCards && cardsSource.length === 0) &&
            viewSelected === "text" && (
              <div className="grid gap-3 grid-cols-1 justify-items-center">
                {filteredByLeader?.slice(0, visibleCount).map((card, index) => {
                  const totalQuantityBase = deckBuilder.deckCards
                    ?.filter((card_alt) => card_alt.code === card.code)
                    .reduce((sum, card_alt) => sum + card_alt.quantity, 0);

                  return (
                    <React.Fragment key={card.id}>
                      <div
                        className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg ${
                          totalQuantityBase >= 4 ? "opacity-70 grayscale" : ""
                        }`}
                        onClick={() => handleStoreCardClick(card)}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <StoreCard
                            card={card}
                            searchTerm={search}
                            viewSelected={viewSelected}
                            selectedRarities={selectedAltArts}
                            selectedSets={selectedSets}
                            setSelectedCard={handleSetSelectedCard}
                            setBaseCard={setBaseCard}
                            setAlternatesCards={setAlternatesCards}
                            setIsOpen={setIsOpen}
                          />
                        </div>
                      </div>

                      {card?.alternates?.length > 0 &&
                        viewSelected !== "text" &&
                        card.alternates
                          ?.filter((alt) => {
                            if (normalizedSelectedSets.length === 0) {
                              return true;
                            }
                            const altSetCodes = (alt.setCode ?? "")
                              .split(",")
                              .map((code) => code.trim().toLowerCase())
                              .filter(Boolean);
                            return altSetCodes.some((code) =>
                              normalizedSelectedSets.includes(code)
                            );
                          })
                          .map((alt) => {
                            const totalQuantity = deckBuilder.deckCards
                              ?.filter(
                                (card_alt) => card_alt.code === card.code
                              )
                              .reduce(
                                (sum, card_alt) => sum + card_alt.quantity,
                                0
                              );

                            return (
                              <div
                                key={alt.id}
                                onClick={() => handleStoreCardClick(alt)}
                                className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg ${
                                  totalQuantity >= 4
                                    ? "opacity-70 grayscale"
                                    : ""
                                }`}
                              >
                                <div className="border rounded-lg shadow p-3 bg-white justify-center items-center flex flex-col">
                                  <LazyImage
                                    src={alt?.src}
                                    fallbackSrc="/assets/images/backcard.webp"
                                    alt={alt?.name}
                                    priority={index < 20}
                                    size="small"
                                    className="w-full"
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
                                              alt?.sets[0]?.set?.title,
                                              search
                                            )}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{alt?.sets[0]?.set?.title}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            );
                          })}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

          {!isLoadingCards &&
            (!isFork ||
              (deckBuilder.isDeckLoaded && deckBuilder.selectedLeader)) &&
            !(isFetchingCards && cardsSource.length === 0) &&
            viewSelected === "list" && (
              <div className="grid gap-1.5 grid-cols-3 justify-items-center">
                {filteredByLeader?.slice(0, visibleCount).map((card, index) => {
                  // Función que determina si la carta base coincide con los filtros
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

                  // Función que filtra las alternates según set y rareza
                  const getFilteredAlternates = () => {
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
                  const totalQuantityBase = deckBuilder.deckCards
                    ?.filter((card_alt) => card_alt.code === card.code)
                    .reduce((sum, card_alt) => sum + card_alt.quantity, 0);

                  // Si ni la carta base ni alguna alterna coinciden, no renderizamos nada
                  if (!baseCardMatches() && filteredAlts.length === 0)
                    return null;

                  const baseCardInDeck = deckBuilder.deckCards.find(
                    (deckCard) => deckCard.cardId === Number(card.id)
                  );

                  return (
                    <React.Fragment key={card.id}>
                      {baseCardMatches() && (
                        <CardWithBadges
                          id={card.id}
                          src={card.src}
                          alt={card.name}
                          code={card.code}
                          price={getCardPriceValue(card)}
                          priceCurrency={card.priceCurrency}
                          onClick={() => {
                            if (totalQuantityBase < 4) {
                              handleCardClick(null, card, card);
                            }
                          }}
                          onInfoClick={() => openCardPreview(card, card)}
                          onAdd={() => handleCardClick(null, card, card)}
                          onRemove={() => {
                            const qty = baseCardInDeck?.quantity || 0;
                            if (qty > 0) {
                              deckBuilder.updateDeckCardQuantity(
                                Number(card.id),
                                qty - 1
                              );
                            }
                          }}
                          priority={index < 20}
                          size="small"
                          disabled={totalQuantityBase >= 4}
                          quantityInDeck={baseCardInDeck?.quantity || 0}
                          maxQuantity={
                            card.code === "OP08-072" || card.code === "OP01-075"
                              ? 50
                              : 4
                          }
                          touchedCardId={touchedCardId}
                          onTouchStart={(id) => setTouchedCardId(id)}
                          onTouchEnd={() => setTouchedCardId(null)}
                          showControls
                        />
                      )}

                      {filteredAlts.length > 0 &&
                        filteredAlts.map((alt) => {
                          const alternateInDeck = deckBuilder.deckCards.find(
                            (deckCard) => deckCard.cardId === Number(alt.id)
                          );
                          const alternateMaxQuantity = getMaxQuantityForCode(
                            card.code
                          );
                          const totalQuantity = deckBuilder.deckCards
                            ?.filter((card_alt) => card_alt.code === card.code)
                            .reduce(
                              (sum, card_alt) => sum + card_alt.quantity,
                              0
                            );

                          return (
                            <CardWithBadges
                              key={alt.id}
                              id={alt.id}
                              src={alt.src}
                              alt={alt.name}
                              code={card.code}
                              price={getCardPriceValue(alt)}
                              priceCurrency={alt.priceCurrency}
                              onClick={() => {
                                if (totalQuantity < alternateMaxQuantity) {
                                  handleCardClick(null, card, alt);
                                }
                              }}
                              onInfoClick={() => openCardPreview(alt, card)}
                              onAdd={() => handleCardClick(null, card, alt)}
                              onRemove={() => {
                                const qty = alternateInDeck?.quantity || 0;
                                if (qty > 0) {
                                  deckBuilder.updateDeckCardQuantity(
                                    Number(alt.id),
                                    qty - 1
                                  );
                                }
                              }}
                              priority={index < 20}
                              size="small"
                              disabled={totalQuantity >= 4}
                              quantityInDeck={alternateInDeck?.quantity || 0}
                              maxQuantity={
                                card.code === "OP08-072" ||
                                card.code === "OP01-075"
                                  ? 50
                                  : 4
                              }
                              touchedCardId={touchedCardId}
                              onTouchStart={(id) => setTouchedCardId(id)}
                              onTouchEnd={() => setTouchedCardId(null)}
                              showControls
                            />
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

          {!isLoadingCards &&
            (!isFork ||
              (deckBuilder.isDeckLoaded && deckBuilder.selectedLeader)) &&
            !(isFetchingCards && cardsSource.length === 0) &&
            viewSelected === "grid" && (
              <div className="grid gap-3 grid-cols-1 justify-items-center">
                {filteredByLeader?.slice(0, visibleCount).map((card, index) => {
                  // Función que determina si la carta base cumple con los filtros
                  const baseCardMatches = (card: any): boolean => {
                    if (!card) return false;

                    if (
                      [
                        "Demo Version",
                        "Not for Sale",
                        "Pre-Errata",
                        "Pre-Release",
                      ].includes(card.alternateArt ?? "")
                    ) {
                      return false;
                    }

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

                  // Función que determina si una alterna cumple los filtros
                  const alternateMatches = (alt: any): boolean => {
                    if (
                      [
                        "Demo Version",
                        "Not for Sale",
                        "Pre-Errata",
                        "Pre-Release",
                      ].includes(alt.alternateArt ?? "")
                    ) {
                      return false;
                    }

                    if (normalizedSelectedSets.length > 0) {
                      const altSetCodes = (alt.setCode ?? "")
                        .split(",")
                        .map((code: string) => code.trim().toLowerCase())
                        .filter(Boolean);
                      if (
                        !altSetCodes.some((code: string) =>
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
                  };

                  // Filtrar las alternates que cumplen los criterios
                  const filteredAlternates =
                    card.alternates?.filter((alt) => alternateMatches(alt)) ||
                    [];

                  // Si ni la carta base ni ninguna alterna cumplen, no renderizamos nada para esta carta
                  if (!baseCardMatches(card) && filteredAlternates.length === 0)
                    return null;

                  // Obtener cantidad en deck para carta base
                  const totalQuantityBase = deckBuilder.deckCards
                    ?.filter((card_alt) => card_alt.code === card.code)
                    .reduce((sum, card_alt) => sum + card_alt.quantity, 0);
                  const maxQuantityByCode = getMaxQuantityForCode(card.code);
                  const canAddMoreByCode =
                    totalQuantityBase < maxQuantityByCode;
                  const baseCardInDeck = deckBuilder.deckCards.find(
                    (deckCard) => deckCard.cardId === Number(card.id)
                  );
                  const baseCardQuantity = baseCardInDeck?.quantity || 0;
                  const showBaseControls = true;

                  return (
                    <React.Fragment key={card.id}>
                      {/* Render the base card only if it matches the filters */}
                      {baseCardMatches(card) && (
                        <div
                          className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit mb-3"
                          onClick={(e) => {
                            if (totalQuantityBase >= maxQuantityByCode) {
                              // Optional: Add logic if the limit is reached.
                            } else {
                              handleCardClick(e, card, card);
                            }
                          }}
                        >
                          <LazyImage
                            src={card.src ?? "/assets/images/backcard.webp"}
                            fallbackSrc="/assets/images/backcard.webp"
                            alt={card?.name}
                            priority={index < 20}
                            size="small"
                            className={`
                        w-full
                        ${
                          totalQuantityBase >= maxQuantityByCode
                            ? "filter grayscale opacity-70"
                            : ""
                        }
                      `}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCardPreview(card, card);
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                              openCardPreview(card, card);
                            }}
                            className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-gray-600 rounded-tr-md rounded-bl-lg p-1.5 z-10 border-l border-b border-gray-200 hover:bg-white hover:text-gray-900 active:scale-95 transition-all"
                            aria-label="View card details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
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
                          {showBaseControls && (
                            <div className="w-full mt-2 px-1">
                              <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-2 py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (baseCardQuantity > 0) {
                                      deckBuilder.updateDeckCardQuantity(
                                        Number(card.id),
                                        baseCardQuantity - 1
                                      );
                                    }
                                  }}
                                  onTouchEnd={(e) => {
                                    e.stopPropagation();
                                    if (baseCardQuantity > 0) {
                                      deckBuilder.updateDeckCardQuantity(
                                        Number(card.id),
                                        baseCardQuantity - 1
                                      );
                                    }
                                  }}
                                  disabled={baseCardQuantity <= 0}
                                  className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all disabled:opacity-40"
                                  aria-label="Remove one"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <div className="flex items-center justify-center">
                                  <span className="text-white font-bold text-base">
                                    {baseCardQuantity}
                                  </span>
                                  <span className="text-white/60 text-xs ml-1">
                                    /{maxQuantityByCode}
                                  </span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (canAddMoreByCode) {
                                      deckBuilder.updateDeckCardQuantity(
                                        Number(card.id),
                                        baseCardQuantity + 1
                                      );
                                    } else {
                                      showWarningToast(
                                        `Max ${maxQuantityByCode} cards reached.`
                                      );
                                    }
                                  }}
                                  onTouchEnd={(e) => {
                                    e.stopPropagation();
                                    if (canAddMoreByCode) {
                                      deckBuilder.updateDeckCardQuantity(
                                        Number(card.id),
                                        baseCardQuantity + 1
                                      );
                                    } else {
                                      showWarningToast(
                                        `Max ${maxQuantityByCode} cards reached.`
                                      );
                                    }
                                  }}
                                  disabled={!canAddMoreByCode}
                                  className={`h-7 w-7 rounded-md flex items-center justify-center active:scale-95 transition-all ${
                                    canAddMoreByCode
                                      ? "bg-white/15 text-white hover:bg-white/25"
                                      : "bg-white/5 text-white/30 cursor-not-allowed"
                                  }`}
                                  aria-label="Add one"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Render filtered alternates */}
                      {filteredAlternates.map((alt, altIndex) => {
                        const alternateInDeck = deckBuilder.deckCards.find(
                          (deckCard) => deckCard.cardId === Number(alt.id)
                        );
                        const alternateQuantity =
                          alternateInDeck?.quantity || 0;
                        const showAltControls = true;

                        return (
                          <div
                            key={alt.id}
                            className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit mb-3"
                            onClick={(e) => {
                              const totalQuantity = deckBuilder.deckCards
                                ?.filter(
                                  (card_alt) => card_alt.code === card.code
                                )
                                .reduce(
                                  (sum, card_alt) => sum + card_alt.quantity,
                                  0
                                );

                              if (totalQuantity >= maxQuantityByCode) {
                                // Optional: Add logic if the limit is reached.
                              } else {
                                handleCardClick(e, card, alt);
                              }
                            }}
                          >
                            <LazyImage
                              src={alt.src ?? "/assets/images/backcard.webp"}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={alt?.name}
                              priority={index < 20}
                              size="small"
                              className={`
                              w-full
                              ${
                                (deckBuilder.deckCards
                                  ?.filter(
                                    (card_alt) => card_alt.code === card.code
                                  )
                                  .reduce(
                                    (sum, card_alt) => sum + card_alt.quantity,
                                    0
                                  ) ?? 0) >= 4
                                  ? "filter grayscale opacity-70"
                                  : ""
                              }
                            `}
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openCardPreview(alt, card);
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                openCardPreview(alt, card);
                              }}
                              className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-gray-600 rounded-tr-md rounded-bl-lg p-1.5 z-10 border-l border-b border-gray-200 hover:bg-white hover:text-gray-900 active:scale-95 transition-all"
                              aria-label="View card details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {showAltControls && (
                              <div className="w-full mt-2 px-1">
                                <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-2 py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (alternateQuantity > 0) {
                                        deckBuilder.updateDeckCardQuantity(
                                          Number(alt.id),
                                          alternateQuantity - 1
                                        );
                                      }
                                    }}
                                    onTouchEnd={(e) => {
                                      e.stopPropagation();
                                      if (alternateQuantity > 0) {
                                        deckBuilder.updateDeckCardQuantity(
                                          Number(alt.id),
                                          alternateQuantity - 1
                                        );
                                      }
                                    }}
                                    disabled={alternateQuantity <= 0}
                                    className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all disabled:opacity-40"
                                    aria-label="Remove one"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <div className="flex items-center justify-center">
                                    <span className="text-white font-bold text-base">
                                      {alternateQuantity}
                                    </span>
                                    <span className="text-white/60 text-xs ml-1">
                                      /{maxQuantityByCode}
                                    </span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canAddMoreByCode) {
                                        deckBuilder.updateDeckCardQuantity(
                                          Number(alt.id),
                                          alternateQuantity + 1
                                        );
                                      } else {
                                        showWarningToast(
                                          `Max ${maxQuantityByCode} cards reached.`
                                        );
                                      }
                                    }}
                                    onTouchEnd={(e) => {
                                      e.stopPropagation();
                                      if (canAddMoreByCode) {
                                        deckBuilder.updateDeckCardQuantity(
                                          Number(alt.id),
                                          alternateQuantity + 1
                                        );
                                      } else {
                                        showWarningToast(
                                          `Max ${maxQuantityByCode} cards reached.`
                                        );
                                      }
                                    }}
                                    disabled={!canAddMoreByCode}
                                    className={`h-7 w-7 rounded-md flex items-center justify-center active:scale-95 transition-all ${
                                      canAddMoreByCode
                                        ? "bg-white/15 text-white hover:bg-white/25"
                                        : "bg-white/5 text-white/30 cursor-not-allowed"
                                    }`}
                                    aria-label="Add one"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            )}
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

      {/* Área principal: Construcción del deck - Solo visible en desktop */}
      <div className="hidden md:flex flex-col flex-1 min-h-0 bg-[#f2eede]">
        {/* Header del deck - Diseño Profesional y Minimalista */}
        <div className="bg-white border-b border-gray-200 px-3 py-3 sm:px-4 sm:py-3.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            {/* Left Section - Leader Info */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full sm:w-auto bg-white rounded-lg border border-gray-200 p-2 sm:p-2.5 shadow-sm hover:shadow-md transition-shadow">
              {deckBuilder.selectedLeader ? (
                <>
                  <div
                    className="relative w-11 h-11 sm:w-10 sm:h-10 rounded-lg cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                    onClick={() => setShowLargeImage(true)}
                  >
                    {deckBuilder.selectedLeader.colors.length === 2 ? (
                      <div
                        className="absolute inset-0 rounded-lg"
                        style={{
                          background: `linear-gradient(
                          135deg,
                          ${getColors(
                            deckBuilder.selectedLeader.colors[0].color
                          )} 0%,
                          ${getColors(
                            deckBuilder.selectedLeader.colors[0].color
                          )} 40%,
                          ${getColors(
                            deckBuilder.selectedLeader.colors[1].color
                          )} 60%,
                          ${getColors(
                            deckBuilder.selectedLeader.colors[1].color
                          )} 100%
                        )`,
                        }}
                      />
                    ) : (
                      <div
                        className="absolute inset-0 rounded-lg"
                        style={{
                          backgroundColor: getColors(
                            deckBuilder.selectedLeader.colors[0].color
                          ),
                        }}
                      />
                    )}
                    <div
                      className="absolute inset-0.5 rounded-md bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${deckBuilder.selectedLeader.src})`,
                        backgroundSize: "150%",
                        backgroundPosition: "-80px -5px",
                      }}
                    />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 justify-center">
                    <span className="font-semibold text-sm sm:text-sm text-gray-900 truncate leading-tight">
                      {deckBuilder.selectedLeader.name}
                    </span>
                    <span className="text-[11px] text-gray-500 leading-tight font-medium">
                      {deckBuilder.selectedLeader.code}
                    </span>
                    {(() => {
                      const priceValue = getCardPriceValue(
                        deckBuilder.selectedLeader
                      );
                      if (priceValue !== null) {
                        return (
                          <span className="text-xs font-semibold text-emerald-600 leading-tight mt-0.5">
                            {formatCurrency(priceValue)}
                          </span>
                        );
                      }
                      return (
                        <span className="text-[10px] font-medium text-gray-400 leading-tight mt-0.5">
                          No price
                        </span>
                      );
                    })()}
                  </div>

                  {/* Clear Leader/Deck Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          type="button"
                          className="h-8 w-8 sm:h-7 sm:w-7 [&_svg]:size-4 sm:[&_svg]:size-3.5 flex-shrink-0 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors rounded-md"
                          onClick={() => {
                            onRestart();
                            setSearch("");
                            setIsInputClear(true);
                            resetVisibleCount();
                            setTimeout(() => {
                              gridRef.current?.scrollTo({
                                top: 0,
                                behavior: "smooth",
                              });
                            }, 100);
                          }}
                        >
                          <X />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Clear Deck</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              ) : (
                <div className="flex items-center gap-2.5 text-gray-500">
                  <div className="w-11 h-11 sm:w-10 sm:h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex flex-col justify-center">
                    <span className="font-semibold text-sm text-gray-700 leading-tight">
                      Select Leader
                    </span>
                    <p className="text-xs text-gray-500 leading-tight">
                      Choose your leader
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Center Section - Deck Name Input */}
            {deckName !== undefined && setDeckName && (
              <div className="flex-1 w-full sm:max-w-xs lg:max-w-md flex flex-col gap-2">
                <Input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="Deck name..."
                  className="w-full h-9 sm:h-9 text-sm font-medium bg-white border border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 rounded-lg transition-colors"
                  maxLength={50}
                />
                {showShopFields && (
                  <>
                    <Input
                      type="text"
                      value={shopSlugValue}
                      onChange={(e) => handleSlugInputChange(e.target.value)}
                      placeholder="Slug para la tienda (ej. super-deck)"
                      className="w-full h-9 text-sm font-medium bg-white border border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 rounded-lg transition-colors"
                      maxLength={60}
                    />
                    <Input
                      type="url"
                      value={shopUrlValue}
                      onChange={(e) => handleShopUrlChange(e.target.value)}
                      placeholder="URL de la tienda (https://...)"
                      className="w-full h-9 text-sm font-medium bg-white border border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 rounded-lg transition-colors"
                    />
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <Switch
                        checked={Boolean(isPublished)}
                        onCheckedChange={(checked) => setIsPublished?.(checked)}
                      />
                      <span className="text-xs font-medium text-gray-600">
                        {isPublished ? "Publicado" : "Sin publicar"}
                      </span>
                    </div>
                    {shopSlugValue && (
                      <p className="text-[11px] text-gray-500 text-center">
                        /shop/{shopSlugValue}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Right Section - Stats & Controls */}
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
              {/* Deck Stats - Inline */}
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="text-center">
                  <div className="text-lg sm:text-xl font-bold text-gray-900 leading-none">
                    {totalCards}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5 uppercase tracking-wider">
                    Total
                  </div>
                </div>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="text-center">
                  <div
                    className={`text-lg sm:text-xl font-bold leading-none ${
                      50 - totalCards <= 10
                        ? "text-amber-600"
                        : 50 - totalCards === 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {50 - totalCards}
                  </div>
                  <div
                    className={`text-[10px] font-medium leading-tight mt-0.5 uppercase tracking-wider ${
                      50 - totalCards <= 10
                        ? "text-amber-600"
                        : 50 - totalCards === 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    Left
                  </div>
                </div>

                {/* Deck Price - Inline */}
                {totalDeckPrice > 0 && (
                  <>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-center cursor-help">
                            <div className="text-lg sm:text-xl font-bold text-emerald-600 leading-none">
                              {formatCurrency(totalDeckPrice)}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-medium leading-tight mt-0.5 uppercase tracking-wider">
                              Price
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white border border-gray-200 shadow-lg">
                          <div className="text-sm">
                            <p className="font-semibold text-gray-900 mb-2 text-sm">
                              Price Breakdown
                            </p>
                            <div className="space-y-1">
                              <p className="flex justify-between gap-3">
                                <span className="text-gray-600">
                                  Cards with price:
                                </span>
                                <span className="font-medium text-gray-900">
                                  {cardsWithPrice}
                                </span>
                              </p>
                              {cardsWithoutPrice > 0 && (
                                <p className="flex justify-between gap-3">
                                  <span className="text-gray-600">
                                    Cards without price:
                                  </span>
                                  <span className="font-medium text-amber-600">
                                    {cardsWithoutPrice}
                                  </span>
                                </p>
                              )}
                              <div className="pt-2 mt-2 border-t border-gray-200">
                                <p className="flex justify-between gap-3">
                                  <span className="text-gray-600">
                                    Average per card:
                                  </span>
                                  <span className="font-medium text-emerald-600">
                                    {formatCurrency(
                                      totalDeckPrice / (cardsWithPrice || 1)
                                    )}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </div>

              {/* View Controls */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className={`h-9 w-9 sm:h-8 sm:w-8 [&_svg]:size-4 transition-colors rounded-lg ${
                        isStatsOpen
                          ? "bg-gray-900 text-white hover:bg-gray-800"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                      onClick={() => setIsStatsOpen(!isStatsOpen)}
                    >
                      <ChartColumnBigIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-white border border-gray-200">
                    <p className="font-medium text-sm">
                      {isStatsOpen ? "Hide" : "View"} Statistics
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Contenido del deck */}
        <div className={`flex-1 p-5 overflow-auto`}>
          <div className=" rounded-lg h-full" ref={containerRef}>
            {deckBuilder.deckCards.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                {!deckBuilder.selectedLeader ? (
                  <Card className="max-w-md mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg !h-max">
                    <CardContent className="p-8 text-center">
                      <div className="mb-6">
                        <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                          <Users className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                          Choose Your Leader
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          Start building your deck by selecting a leader from
                          the available cards on the left.
                        </p>
                      </div>
                      <div className="bg-blue-100 rounded-lg p-3">
                        <p className="text-blue-700 text-xs font-medium">
                          💡 Tip: Your leader determines which colors you can
                          use in your deck
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="max-w-md mx-auto bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 shadow-lg !h-max">
                    <CardContent className="p-8 text-center">
                      <div className="mb-6">
                        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                          <Layers className="h-8 w-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                          Build Your Deck
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          Great! Now add cards to your deck from the available
                          selection on the left.
                        </p>
                      </div>
                      <div className="bg-green-100 rounded-lg p-3">
                        <p className="text-green-700 text-xs font-medium">
                          🎯 Goal: Build a deck with exactly 50 cards
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="grid gap-2 grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8">
                {groupedCards.flatMap((group) =>
                  group.map((card, cardIndex) => {
                    // Calcular cuántas cartas del mismo código hay en total en el deck
                    const totalQuantityByCode =
                      deckBuilder.deckCards
                        ?.filter((deckCard) => deckCard.code === card.code)
                        .reduce(
                          (sum, deckCard) => sum + deckCard.quantity,
                          0
                        ) || 0;

                    return (
                      <div
                        key={`${card.cardId}-${cardIndex}`}
                        ref={(el) => {
                          groupRefs.current[card.code] = el;
                        }}
                        className="flex flex-col items-center"
                      >
                        {/* Card Display */}
                        <div className="cursor-pointer border rounded-lg shadow  bg-white justify-center items-center flex flex-col relative h-fit hover:shadow-xl transition-all duration-200 w-full mb-2">
                          <div
                            onClick={() => {
                              setSelectedCard(card);
                              setShowLargeImageCard(true);
                            }}
                            className="w-full aspect-[3/4] relative overflow-hidden rounded"
                          >
                            <img
                              src={getOptimizedImageUrl(card.src, "small")}
                              alt={card.name}
                              className="w-full h-full object-cover"
                              loading={cardIndex < 20 ? "eager" : "lazy"}
                            />
                          </div>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex justify-center items-center w-full flex-col">
                                  <span
                                    className={`${oswald.className} text-[13px] font-[500] mt-2`}
                                  >
                                    {card.code}
                                  </span>
                                  {(() => {
                                    const priceValue = getCardPriceValue(card);
                                    if (priceValue !== null) {
                                      return (
                                        <span className="text-xs font-semibold text-emerald-600 mt-0.5">
                                          {formatCurrency(priceValue)}
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="text-[10px] font-medium text-gray-400 mt-0.5">
                                        No price
                                      </span>
                                    );
                                  })()}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{card.set}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {card.quantity > 0 && (
                            <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white shadow-lg z-10">
                              <span className="mb-[2px]">{card.quantity}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 w-full mt-2 px-2 pb-2">
                            <Button
                              onClick={() => {
                                const newQuantity = Math.max(
                                  0,
                                  card.quantity - 1
                                );
                                if (newQuantity === 0) {
                                  removeCard(card.cardId);
                                } else {
                                  deckBuilder.updateDeckCardQuantity(
                                    card.cardId,
                                    newQuantity
                                  );
                                }
                              }}
                              disabled={card.quantity <= 0}
                              size="sm"
                              variant="outline"
                              className="flex-1 h-10 bg-white border-2 border-red-200 text-red-700 font-semibold hover:bg-red-50 hover:border-red-400 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 transition-all rounded-lg shadow-sm hover:shadow disabled:shadow-none"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>

                            <Button
                              onClick={() => {
                                if (totalQuantityByCode < 4) {
                                  deckBuilder.updateDeckCardQuantity(
                                    card.cardId,
                                    card.quantity + 1
                                  );
                                } else {
                                  showWarningToast(
                                    "You can't add more than 4 cards of the same code to the deck."
                                  );
                                }
                              }}
                              disabled={totalQuantityByCode >= 4}
                              size="sm"
                              variant="outline"
                              className="flex-1 h-10 bg-white border-2 border-emerald-200 text-emerald-700 font-semibold hover:bg-emerald-50 hover:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 transition-all rounded-lg shadow-sm hover:shadow disabled:shadow-none"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer con botones principales */}
        {deckName !== undefined && setDeckName && (
          <div className="bg-white border-t border-gray-200 p-4 pb-20 md:pb-4 shadow-lg">
            <div className="flex gap-3 max-w-2xl mx-auto">
              {/* Clear Deck Button */}
              <Button
                variant="outline"
                size="lg"
                type="button"
                className="flex-1 h-14 text-red-600 border-2 border-red-300 hover:bg-red-50 hover:border-red-400 transition-all duration-200 font-semibold"
                onClick={() => {
                  onRestart();
                  setSearch("");
                  setIsInputClear(true);
                  resetVisibleCount();
                  setTimeout(() => {
                    gridRef.current?.scrollTo({
                      top: 0,
                      behavior: "smooth",
                    });
                  }, 100);
                }}
              >
                <RotateCcw className="h-5 w-5 mr-2" />
                Clear Deck
              </Button>
              {/* Proxies Button - Only show if onProxies is provided */}
              {onProxies && (
                <Button
                  onClick={onProxies}
                  disabled={totalCards === 0}
                  variant="outline"
                  size="lg"
                  type="button"
                  className="flex-1 h-14 border-2 border-violet-300 text-violet-600 hover:bg-violet-50 hover:border-violet-400 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Proxies
                </Button>
              )}
              {/* Save Deck Button */}
              <Button
                onClick={onSave}
                disabled={
                  totalCards < 50 ||
                  deckBuilder.isSaving ||
                  !deckName?.trim() ||
                  shopFieldsMissing
                }
                size="lg"
                className={`flex-1 h-14 font-semibold transition-all duration-200 ${
                  totalCards < 50 ||
                  deckBuilder.isSaving ||
                  !deckName?.trim() ||
                  shopFieldsMissing
                    ? "bg-gray-400 cursor-not-allowed hover:bg-gray-400"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white shadow-lg`}
              >
                {deckBuilder.isSaving ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Saving Deck...
                  </>
                ) : (
                  <div className="flex flex-col gap-0">
                    <div className="flex items-center justify-center">
                      <Save className="h-5 w-5 mr-2" />
                      <span className="hidden md:block">
                        Save Deck ({totalCards}/50)
                      </span>
                      <span className="block md:hidden">Save Deck</span>
                    </div>
                    {totalCards >= 50 && deckName === "" && (
                      <span className="text-xs text-white">Name your deck</span>
                    )}
                    {shopFieldsMissing && (
                      <span className="text-xs text-white">
                        Completa slug y URL de la tienda
                      </span>
                    )}
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Filters Drawer - Bottom sheet for mobile */}
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
          disabledColors={deckBuilder.selectedLeader ? disabledColors : []}
          disabledTypes={
            deckBuilder.selectedLeader
              ? ["Leader"]
              : ["Character", "Event", "Stage"]
          }
        />
      </div>

      {/* Desktop Filters Sidebar - Left panel for desktop */}
      <div className="hidden md:block">
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
            disabledColors={deckBuilder.selectedLeader ? disabledColors : []}
            selectedAltArts={selectedAltArts}
            setSelectedAltArts={setSelectedAltArts}
            selectedCodes={selectedCodes}
            setSelectedCodes={setSelectedCodes}
            disabledTypes={
              deckBuilder.selectedLeader
                ? ["Leader"]
                : ["Character", "Event", "Stage"]
            }
          />
        </Transition>
      </div>

      <Transition appear show={isStatsOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[999]"
          onClose={() => {
            setIsStatsOpen(false);
          }}
        >
          <div
            className={`fixed inset-0 flex w-screen items-center justify-center p-4 transition-all duration-500 ease-in-out bg-black/60`}
          >
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave=""
              leaveFrom=""
              leaveTo=""
            >
              <DialogPanel
                className={`w-full max-w-[900px] space-y-4 bg-white shadow-xl border transform transition-all rounded-lg`}
              >
                <div className="w-full max-w-[900px] h-screen md:h-fit max-h-[96dvh] bg-white rounded-lg shadow-2xl flex flex-col transition-shadow duration-300 overflow-auto">
                  <div className="sticky top-0 bg-[#000] text-white p-4 flex flex-row justify-center items-center rounded-t-lg z-10 min-h-[80px] lg:min-h-[80px]">
                    <DialogTitle className="text-lg lg:text-2xl font-bold">
                      Stats
                    </DialogTitle>
                    <div className="absolute right-5 top-0 bottom-0 m-auto h-fit">
                      <button
                        onClick={() => setIsStatsOpen(false)}
                        aria-label="Close"
                      >
                        <X className="h-[20px] w-[20px] md:h-[60px] md:w-[60px] text-white cursor-pointer" />
                      </button>
                    </div>
                  </div>

                  <DeckStats deck={deckBuilder?.deckCards} />
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isGrid} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[999]"
          onClose={() => {
            if (isTouchable) {
              setIsGrid(false);
            }
          }}
        >
          <div
            className={`fixed inset-0 flex w-screen items-center justify-center p-4 transition-all duration-500 ease-in-out bg-black/60`}
          >
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave=""
              leaveFrom=""
              leaveTo=""
            >
              <DialogPanel
                className={`w-full max-w-[900px] space-y-4 bg-white shadow-xl border transform transition-all rounded-lg`}
              >
                <div className="w-full max-w-[900px] md:h-fit bg-white rounded-lg shadow-2xl flex flex-col transition-shadow duration-300 overflow-auto">
                  <div className="sticky top-0 bg-[#000] text-white p-4 flex flex-row justify-center items-center rounded-t-lg z-10 min-h-[80px] lg:min-h-[80px]">
                    <DialogTitle className="text-xl lg:text-2xl font-bold">
                      Deck preview
                    </DialogTitle>
                    <div className="absolute right-5 top-0 bottom-0 m-auto h-fit">
                      <button
                        onClick={() => setIsGrid(false)}
                        aria-label="Close"
                      >
                        <X className="h-[40px] w-[40px] md:h-[60px] md:w-[60px] text-white cursor-pointer" />
                      </button>
                    </div>
                  </div>

                  {groupedCards.length > 0 ? (
                    <div className="grid grid-cols-4 sm-grid-cols-5 md:grid-cols-6 lg:grid-cols-7 m-auto gap-2 max-w-unset h-fit p-4 max-h-[80dvh] min-h-[200px]">
                      {groupedCards.map((group, index) => {
                        return (
                          <div
                            key={index}
                            onClick={() => {
                              setShowLargeImageCard(true);
                              setSelectedCard(group[0]);
                            }}
                            className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit"
                          >
                            <LazyImage
                              src={
                                group[0].src ?? "/assets/images/backcard.webp"
                              }
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={group[0].name}
                              priority={index < 20}
                              size="small"
                              className="w-full"
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex justify-center items-center w-full flex-col">
                                    <span
                                      className={`${oswald.className} text-[13px] font-[500] mt-1`}
                                    >
                                      {group[0].code}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{group[0].set}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                              <span className="mb-[2px]">
                                {group.reduce(
                                  (sum, card) => sum + card.quantity,
                                  0
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full min-h-[100px]">
                      <p className="text-center text-2xl">No cards added</p>
                    </div>
                  )}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      {showLargeImage && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
          onClick={() => setShowLargeImage(false)}
        >
          <div className="w-full max-w-3xl">
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              Tap to close
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                key={deckBuilder?.selectedLeader?.id}
                src={getOptimizedImageUrl(
                  deckBuilder?.selectedLeader?.src ??
                    "/assets/images/backcard.webp",
                  "large"
                )}
                className="max-w-full max-h-[calc(100dvh-130px)] object-contain"
                alt=""
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                <span className={`${oswald.className} font-[500]`}>
                  {deckBuilder?.selectedLeader?.code}
                </span>
                <br />
                <span>{deckBuilder?.selectedLeader?.sets[0]?.set?.title}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLargeImageCard && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
          onClick={() => {
            setShowLargeImageCard(false);
          }}
          onTouchEnd={() => {
            setIsTouchable(false);
            setShowLargeImageCard(false);
          }}
        >
          <div className="w-full max-w-3xl">
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              Tap to close
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={getOptimizedImageUrl(
                  selectedCard?.src ?? "/assets/images/backcard.webp",
                  "large"
                )}
                className="max-w-full max-h-[calc(100dvh-130px)] object-contain"
                alt=""
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                <span className={`${oswald.className} font-[500]`}>
                  {selectedCard?.code}
                </span>
                <br />
                <span>{selectedCard?.set}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Preview Dialog */}
      <CardPreviewDialog
        isOpen={isPreviewOpen}
        onClose={closeCardPreview}
        card={previewCard}
        baseCard={previewBaseCard}
        currentQuantity={
          previewCard ? getCardQuantityInDeck(previewCard.id) : 0
        }
        maxQuantity={
          previewCard?.code === "OP08-072" || previewCard?.code === "OP01-075"
            ? 50
            : 4
        }
        canAdd={
          deckBuilder.selectedLeader !== null &&
          totalCards < 50 &&
          (previewCard
            ? getTotalQuantityByCode(previewCard.code || "") <
              (previewCard.code === "OP08-072" ||
              previewCard.code === "OP01-075"
                ? 50
                : 4)
            : false)
        }
        canRemove={
          previewCard ? getCardQuantityInDeck(previewCard.id) > 0 : false
        }
        isLeaderSelection={
          !deckBuilder.selectedLeader && previewCard?.category === "Leader"
        }
        onAddCard={() => {
          if (previewCard && previewBaseCard) {
            if (
              !deckBuilder.selectedLeader &&
              previewCard.category === "Leader"
            ) {
              // Select as leader
              deckBuilder.setSelectedLeader({
                ...previewBaseCard,
                src: previewCard.src,
                id: Number(previewCard.id),
                marketPrice: previewCard.marketPrice,
                priceCurrency: previewCard.priceCurrency,
              });
              setSearch("");
              closeCardPreview();
            } else {
              // Add to deck
              deckBuilder.handleAddCard({
                cardId: Number(previewCard.id),
                id: Number(previewCard.id),
                name: previewBaseCard.name,
                rarity: previewBaseCard.rarity ?? "",
                src: previewCard.src,
                quantity: 1,
                code: previewBaseCard.code,
                color: previewBaseCard.colors.length
                  ? previewBaseCard.colors[0].color
                  : "gray",
                colors: previewBaseCard.colors,
                cost: previewBaseCard.cost ?? "",
                category: previewBaseCard.category,
                set: previewCard.sets?.[0]?.set?.title || "",
                power: previewBaseCard.power ?? "",
                counter: previewBaseCard.counter ?? "",
                attribute: previewBaseCard.attribute ?? "",
                marketPrice: previewCard.marketPrice,
                priceCurrency: previewCard.priceCurrency,
              } as any);
            }
          }
        }}
        onRemoveCard={() => {
          if (previewCard) {
            const currentQty = getCardQuantityInDeck(previewCard.id);
            if (currentQty > 0) {
              deckBuilder.updateDeckCardQuantity(
                Number(previewCard.id),
                currentQty - 1
              );
            }
          }
        }}
      />
    </div>
  );
};

export default CompleteDeckBuilderLayout;
