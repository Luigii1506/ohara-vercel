// CompleteDeckBuilderLayout.tsx
"use client";

import {
  useState,
  useRef,
  MouseEvent,
  useEffect,
  useMemo,
  Fragment,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Card as UICard,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Grid,
  Layers,
  Search,
  Loader2,
  ExternalLink,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Oswald } from "next/font/google";
import DropdownSearch from "@/components/DropdownSearch";
import FiltersSidebar from "@/components/FiltersSidebar";
import { Transition } from "@headlessui/react";
import { CardWithCollectionData } from "@/types";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import ClearFiltersButton from "../ClearFiltersButton";
import { sortByCollectionOrder } from "@/lib/cards/sort";

const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "700"] });

import LazyImage from "@/components/LazyImage";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";

import { DeckCard } from "@/types";
import ViewSwitch from "../ViewSwitch";
import StoreCard from "../StoreCard";
import Link from "next/link";
import { CardDetailsSection } from "./CardDetailsSection";
import {
  HoverImagePreviewOverlay,
  useHoverImagePreview,
} from "@/components/HoverImagePreview";

const ONE_PIECE_CATEGORY_ID = 68;

interface TcgLinkerLayoutProps {
  initialCards: CardWithCollectionData[];
}

type CardDetail = CardWithCollectionData & {
  tcgplayerProductId?: string | null;
  tcgplayerLinkStatus?: boolean | null;
  tcgUrl?: string | null;
  marketPrice?: number | string | null;
  lowPrice?: number | string | null;
  highPrice?: number | string | null;
  priceCurrency?: string | null;
  priceUpdatedAt?: string | Date | null;
  isWatchlisted?: boolean;
};

interface TcgplayerProduct {
  productId: number;
  name: string;
  imageUrl?: string | null;
  groupName?: string | null;
  url?: string | null;
  categoryName?: string | null;
}

interface TcgplayerSearchResponse {
  results: TcgplayerProduct[];
  totalResults: number;
  nextOffset: number | null;
}

interface TcgplayerProductDetail {
  product: TcgplayerProduct | null;
  pricing: {
    marketPrice?: number | null;
    lowPrice?: number | null;
    highPrice?: number | null;
    midPrice?: number | null;
  } | null;
}

const fetchJSON = async <T,>(input: RequestInfo, init?: RequestInit) => {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }
  return (await res.json()) as T;
};

const formatPriceValue = (
  value?: number | string | null,
  currency?: string | null
) => {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return null;
  const safeCurrency = currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch {
    return `${safeCurrency} ${numericValue.toFixed(2)}`;
  }
};

const formatUpdatedTimestamp = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

type QueryFieldKey =
  | "name"
  | "color"
  | "rarity"
  | "type"
  | "cost"
  | "power"
  | "counter"
  | "attribute";
type TcgSearchFilter = { name: string; values: string[] };

const FILTER_NAME_MAP: Record<QueryFieldKey, string> = {
  name: "ProductName",
  color: "Color",
  rarity: "Rarity",
  type: "Card Type",
  cost: "Cost",
  power: "Power",
  counter: "Counter",
  attribute: "Attribute",
};

type LinkStatusFilter = "all" | "linked" | "unlinked" | "missing";

const LINK_FILTER_OPTIONS: { value: LinkStatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "linked", label: "Linkeadas" },
  { value: "unlinked", label: "Sin link" },
  { value: "missing", label: "Missing" },
];

const buildQueryFromCard = (
  card: CardWithCollectionData | null,
  fields: Record<QueryFieldKey, boolean>
) => {
  if (!card) return "";
  const parts: string[] = [];
  if (fields.name && card.name) parts.push(card.name);
  if (fields.color && card.colors?.length) {
    parts.push(card.colors.map((c) => c.color).join(" "));
  }
  if (fields.rarity && card.rarity) parts.push(card.rarity);
  if (fields.type && card.category) parts.push(card.category);
  if (fields.cost && card.cost) parts.push(card.cost);
  if (fields.power && card.power) parts.push(card.power);
  if (fields.counter && card.counter) parts.push(card.counter);
  if (fields.attribute && card.attribute) parts.push(card.attribute);
  return parts.join(" ").trim();
};

const buildFiltersFromCard = (
  card: CardWithCollectionData | null,
  fields: Record<QueryFieldKey, boolean>
): TcgSearchFilter[] => {
  if (!card) return [];
  const filters: TcgSearchFilter[] = [];
  if (fields.name && card.name) {
    filters.push({ name: FILTER_NAME_MAP.name, values: [card.name] });
  }
  if (fields.color && card.colors?.length) {
    filters.push({
      name: FILTER_NAME_MAP.color,
      values: card.colors.map((c) => c.color),
    });
  }
  if (fields.rarity && card.rarity) {
    filters.push({ name: FILTER_NAME_MAP.rarity, values: [card.rarity] });
  }
  if (fields.type && card.category) {
    filters.push({ name: FILTER_NAME_MAP.type, values: [card.category] });
  }
  if (fields.cost && card.cost) {
    filters.push({ name: FILTER_NAME_MAP.cost, values: [card.cost] });
  }
  if (fields.power && card.power) {
    filters.push({ name: FILTER_NAME_MAP.power, values: [card.power] });
  }
  if (fields.counter && card.counter) {
    filters.push({ name: FILTER_NAME_MAP.counter, values: [card.counter] });
  }
  if (fields.attribute && card.attribute) {
    filters.push({
      name: FILTER_NAME_MAP.attribute,
      values: [card.attribute],
    });
  }
  return ensureLanguageFilter(filters);
};

const ensureLanguageFilter = (filters: TcgSearchFilter[]) => {
  const hasLanguage = filters.some(
    (filter) =>
      filter.name.toLowerCase() === "language" && filter.values.length > 0
  );
  if (!hasLanguage) {
    filters.push({ name: "Language", values: ["All"] });
  }
  return filters;
};

const TcgLinker = ({ initialCards }: TcgLinkerLayoutProps) => {
  const [cards, setCards] = useState<CardWithCollectionData[]>(initialCards);
  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);
  const [proxies, setProxies] = useState<DeckCard[]>([]);
  const {
    preview: hoverPreview,
    showPreview,
    hidePreview,
  } = useHoverImagePreview();

  const [search, setSearch] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);

  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);
  const [linkFilter, setLinkFilter] = useState<LinkStatusFilter>("all");

  const linkStatusCounts = useMemo(() => {
    const counts: Record<LinkStatusFilter, number> = {
      all: 0,
      linked: 0,
      unlinked: 0,
      missing: 0,
    };
    const registerStatus = (status?: boolean | null) => {
      counts.all += 1;
      if (status === true) {
        counts.linked += 1;
      } else if (status === false) {
        counts.missing += 1;
      } else {
        counts.unlinked += 1;
      }
    };

    if (!cards || cards.length === 0) {
      return counts;
    }

    for (const card of cards) {
      registerStatus(card.tcgplayerLinkStatus);
      card.alternates?.forEach((alt) =>
        registerStatus(alt.tcgplayerLinkStatus)
      );
    }

    return counts;
  }, [cards]);

  const matchesLinkStatusFilter = useCallback(
    (status?: boolean | null) => {
      const normalizedStatus = status === true ? true : status === false ? false : null;
      switch (linkFilter) {
        case "linked":
          return normalizedStatus === true;
        case "missing":
          return normalizedStatus === false;
        case "unlinked":
          return normalizedStatus === null;
        default:
          return true;
      }
    },
    [linkFilter]
  );

  const normalizedSelectedSets = useMemo(
    () => selectedSets.map((value) => value.toLowerCase()),
    [selectedSets]
  );

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

  const [activeFilters, setActiveFilters] = useState<TcgSearchFilter[]>([]);
  const [draftFilters, setDraftFilters] = useState<TcgSearchFilter[]>([]);
  const [isSearchDirty, setIsSearchDirty] = useState(false);
  const [lastSearchTimestamp, setLastSearchTimestamp] = useState<Date | null>(
    null
  );

  const [selectedLinkCard, setSelectedLinkCard] = useState<CardDetail | null>(
    null
  );
  const [cardDetailLoading, setCardDetailLoading] = useState(false);
  const [tcgSearch, setTcgSearch] = useState("");
  const [tcgResults, setTcgResults] = useState<TcgplayerProduct[]>([]);
  const [tcgLoading, setTcgLoading] = useState(false);
  const [tcgNextOffset, setTcgNextOffset] = useState<number | null>(null);
  const [linkedProduct, setLinkedProduct] =
    useState<TcgplayerProductDetail | null>(null);
  const [linking, setLinking] = useState(false);
  const [searchMode, setSearchMode] = useState<"filters" | "text">("filters");
  const [textSearchQuery, setTextSearchQuery] = useState("");
  const defaultQueryFields: Record<QueryFieldKey, boolean> = {
    name: true,
    color: true,
    rarity: false,
    type: false,
    cost: false,
    power: false,
    counter: false,
    attribute: false,
  };
  const [queryFields, setQueryFields] = useState<
    Record<QueryFieldKey, boolean>
  >({
    ...defaultQueryFields,
  });
  const linkedProductId = selectedLinkCard?.tcgplayerProductId
    ? Number(selectedLinkCard.tcgplayerProductId)
    : null;
  const linkedProductIds = useMemo(() => {
    const ids = new Set<number>();
    cards.forEach((card) => {
      if (card.tcgplayerProductId) {
        const id = Number(card.tcgplayerProductId);
        if (Number.isFinite(id)) {
          ids.add(id);
        }
      }
      card.alternates?.forEach((alt) => {
        if (alt.tcgplayerProductId) {
          const id = Number(alt.tcgplayerProductId);
          if (Number.isFinite(id)) {
            ids.add(id);
          }
        }
      });
    });
    return ids;
  }, [cards]);
  const snapshotInfo = useMemo(() => {
    if (!selectedLinkCard?.marketPrice) return null;
    return {
      market: formatPriceValue(
        selectedLinkCard.marketPrice,
        selectedLinkCard.priceCurrency
      ),
      low: formatPriceValue(
        selectedLinkCard.lowPrice,
        selectedLinkCard.priceCurrency
      ),
      high: formatPriceValue(
        selectedLinkCard.highPrice,
        selectedLinkCard.priceCurrency
      ),
      updatedAt: formatUpdatedTimestamp(selectedLinkCard.priceUpdatedAt),
    };
  }, [selectedLinkCard]);
  const buildPreviewSrc = useCallback((src?: string | null) => {
    if (!src) return null;
    const optimized = getOptimizedImageUrl(src, "large");
    return optimized || src;
  }, []);
  const handlePreviewEnter = useCallback(
    (src?: string | null, alt?: string, options?: { raw?: boolean }) => {
      const previewSrc = options?.raw ? src : buildPreviewSrc(src);
      if (previewSrc) {
        showPreview(previewSrc, alt);
      }
    },
    [buildPreviewSrc, showPreview]
  );

  const isCardLinked = useCallback(
    (card?: {
      tcgplayerLinkStatus?: boolean | null;
      tcgplayerProductId?: string | null;
    }) =>
      card?.tcgplayerLinkStatus === true || Boolean(card?.tcgplayerProductId),
    []
  );

  const isCardMarkedMissing = useCallback(
    (card?: { tcgplayerLinkStatus?: boolean | null }) =>
      card?.tcgplayerLinkStatus === false,
    []
  );

  const toggleMissingLink = useCallback(
    async (cardId: string | number) => {
      try {
        const cardIdStr = String(cardId);

        // Buscar primero en selectedLinkCard, luego en cards
        let card =
          selectedLinkCard && String(selectedLinkCard.id) === cardIdStr
            ? selectedLinkCard
            : cards.find((c) => String(c.id) === cardIdStr) ||
              cards
                .flatMap((c) => c.alternates || [])
                .find((alt) => String(alt.id) === cardIdStr);

        const currentlyMissing = card?.tcgplayerLinkStatus === false;
        const method = currentlyMissing ? "DELETE" : "POST";

        console.log(
          `Toggling missing for card ${cardIdStr}: currentlyMissing=${currentlyMissing}, method=${method}`
        );

        const updated = await fetchJSON<CardDetail>(
          `/api/admin/cards/${cardIdStr}/tcgplayer/missing`,
          { method }
        );
        updateLocalCard(updated);
      } catch (error) {
        console.error("Failed to toggle missing link status", error);
      }
    },
    [cards, selectedLinkCard]
  );

  const queryToggleOptions = useMemo(
    () => [
      {
        key: "name" as QueryFieldKey,
        label: "Name",
        available: Boolean(selectedLinkCard?.name),
      },
      {
        key: "color" as QueryFieldKey,
        label: "Color",
        available: Boolean(selectedLinkCard?.colors?.length),
      },
      {
        key: "rarity" as QueryFieldKey,
        label: "Rarity",
        available: Boolean(selectedLinkCard?.rarity),
      },
      {
        key: "type" as QueryFieldKey,
        label: "Card Type",
        available: Boolean(selectedLinkCard?.category),
      },
      {
        key: "cost" as QueryFieldKey,
        label: "Cost",
        available: Boolean(selectedLinkCard?.cost),
      },
      {
        key: "power" as QueryFieldKey,
        label: "Power",
        available: Boolean(selectedLinkCard?.power),
      },
      {
        key: "counter" as QueryFieldKey,
        label: "Counter",
        available: Boolean(selectedLinkCard?.counter),
      },
      {
        key: "attribute" as QueryFieldKey,
        label: "Attribute",
        available: Boolean(selectedLinkCard?.attribute),
      },
    ],
    [selectedLinkCard]
  );

  const handleToggleQueryField = (key: QueryFieldKey) => {
    if (!selectedLinkCard) return;
    setQueryFields((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) {
        return prev;
      }
      const newQuery = buildQueryFromCard(selectedLinkCard, next);
      setTcgSearch(
        newQuery || selectedLinkCard.name || selectedLinkCard.code || tcgSearch
      );
      const newFilters = ensureLanguageFilter(
        buildFiltersFromCard(selectedLinkCard, next)
      );
      setDraftFilters(newFilters);
      setIsSearchDirty(true);
      return next;
    });
  };

  const handleResetTcgFilters = () => {
    if (!selectedLinkCard) return;
    setQueryFields({ ...defaultQueryFields });
    const baseQuery =
      buildQueryFromCard(selectedLinkCard, defaultQueryFields) ||
      selectedLinkCard.name ||
      selectedLinkCard.code ||
      "";
    setTcgSearch(baseQuery);
    const baseFilters = ensureLanguageFilter(
      buildFiltersFromCard(selectedLinkCard, defaultQueryFields)
    );
    setDraftFilters(baseFilters);
    setIsSearchDirty(true);
  };

  const [visibleCount, setVisibleCount] = useState(50);
  const [selectedCard, setSelectedCard] = useState<DeckCard | undefined>();

  const [showLargeImageCard, setShowLargeImageCard] = useState<boolean>(false);

  // Estados adicionales para StoreCard
  const [baseCard, setBaseCard] = useState<any>(null);
  const [alternatesCards, setAlternatesCards] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Estado para controlar la vista mobile
  const [mobileView, setMobileView] = useState<"cards" | "proxies">("cards");

  // Función para manejar click en cards desde StoreCard
  const handleStoreCardClick = (card: CardWithCollectionData) => {
    // Verificar si la carta ya existe en el array de proxies
    const existingCardIndex = proxies.findIndex(
      (proxy) => proxy.cardId === Number(card.id)
    );

    if (existingCardIndex !== -1) {
      // Si la carta ya existe, incrementar su cantidad
      setProxies((prev) =>
        prev.map((proxy, index) =>
          index === existingCardIndex
            ? { ...proxy, quantity: proxy.quantity + 1 }
            : proxy
        )
      );
    } else {
      // Si la carta no existe, agregarla como nueva
      const newProxy: DeckCard = {
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

      setProxies((prev) => [...prev, newProxy]);
    }
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

  const updateLocalCard = (updated: CardDetail) => {
    // Normalizar el ID a string para comparación
    const updatedIdStr = String(updated.id);

    setCards((prev) =>
      prev.map((card) => {
        if (String(card.id) === updatedIdStr) {
          return { ...card, ...updated, id: card.id };
        }
        if (card.alternates?.some((alt) => String(alt.id) === updatedIdStr)) {
          return {
            ...card,
            alternates: card.alternates.map((alt) =>
              String(alt.id) === updatedIdStr
                ? { ...alt, ...updated, id: alt.id }
                : alt
            ),
          };
        }
        return card;
      })
    );
    setSelectedLinkCard((prev) =>
      prev && String(prev.id) === updatedIdStr
        ? { ...prev, ...updated, id: prev.id }
        : updated
    );
    setTcgSearch(
      buildQueryFromCard(updated, queryFields) ||
        updated.name ||
        updated.code ||
        ""
    );
  };

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
    if (!cards || cards.length === 0) return [];

    return cards
      .filter((card) => {
        const baseStatus = card.tcgplayerLinkStatus ?? null;
        const altStatuses = card.alternates?.map(
          (alt) => alt.tcgplayerLinkStatus ?? null
        );
        const hasLinked =
          baseStatus === true || altStatuses?.some((status) => status === true);
        const hasMissing =
          baseStatus === false || altStatuses?.some((status) => status === false);
        const hasUnlinked =
          baseStatus === null || altStatuses?.some((status) => status === null);

        const satisfiesLinkFilter = (() => {
          switch (linkFilter) {
            case "linked":
              return hasLinked;
            case "missing":
              return hasMissing;
            case "unlinked":
              return hasUnlinked;
            default:
              return true;
          }
        })();

        if (!satisfiesLinkFilter) {
          return false;
        }

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
          card.colors.some((col) =>
            selectedColors.includes(col.color.toLowerCase())
          );

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
      .sort((a, b) => {
        // Primero ordenar por el sort seleccionado si existe
        if (selectedSort === "Most variants") {
          const variantDiff = b.alternates?.length - a.alternates?.length;
          if (variantDiff !== 0) return variantDiff;
        } else if (selectedSort === "Less variants") {
          const variantDiff = a.alternates?.length - b.alternates?.length;
          if (variantDiff !== 0) return variantDiff;
        }

        // Luego aplicar orden estándar de colección (OP → EB → ST → P → otros)
        return sortByCollectionOrder(a, b);
      });
  }, [
    cards,
    search,
    selectedColors,
    selectedRarities,
    selectedCategories,
    selectedCounter,
    selectedTrigger,
    selectedEffects,
    selectedTypes,
    normalizedSelectedSets,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedSort,
    selectedAltArts,
    selectedCodes,
    linkFilter,
    matchesLinkStatusFilter,
  ]);

  // Ref para la lista de cartas (grid)
  const gridRef = useRef<HTMLDivElement>(null);

  // Estado para controlar el sidebar de filtros
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handler para el click en cada carta (compatible con DeckBuilderLayout)
  const handleSearchTcg = async (
    offset = 0,
    overrideFilters?: TcgSearchFilter[]
  ) => {
    if (!selectedLinkCard) return;

    if (offset === 0) {
      setTcgNextOffset(null);
      setTcgResults([]);
    }

    setTcgLoading(true);
    try {
      let data: TcgplayerSearchResponse;

      if (searchMode === "text") {
        // Búsqueda por texto libre
        const searchText = textSearchQuery.trim() || selectedLinkCard.name;
        if (!searchText) {
          setTcgLoading(false);
          return;
        }

        data = await fetchJSON<TcgplayerSearchResponse>(
          "/api/admin/tcgplayer/search-by-name",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              searchText,
              categoryId: ONE_PIECE_CATEGORY_ID,
              offset,
              limit: 50,
              includeExtendedFields: true,
            }),
          }
        );
      } else {
        // Búsqueda por filtros (modo original)
        let filtersToUse: TcgSearchFilter[] =
          overrideFilters && overrideFilters.length
            ? overrideFilters
            : offset > 0 && activeFilters.length
            ? activeFilters
            : draftFilters.length
            ? draftFilters
            : buildFiltersFromCard(selectedLinkCard, queryFields);

        const normalizedFilters = ensureLanguageFilter([...(filtersToUse ?? [])]);

        if (!normalizedFilters.length) {
          setTcgLoading(false);
          return;
        }

        data = await fetchJSON<TcgplayerSearchResponse>(
          "/api/admin/tcgplayer/search",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              categoryId: ONE_PIECE_CATEGORY_ID,
              filters: normalizedFilters,
              offset,
              limit: 50,
              includeExtendedFields: true,
            }),
          }
        );

        if (offset === 0) {
          setActiveFilters(normalizedFilters);
          setDraftFilters(normalizedFilters);
        }
      }

      if (offset === 0) {
        setTcgResults(data.results);
        setIsSearchDirty(false);
        setLastSearchTimestamp(new Date());
      } else {
        setTcgResults((prev) => [...prev, ...data.results]);
      }
      console.log("[handleSearchTcg] Setting nextOffset:", {
        nextOffset: data.nextOffset,
        totalResults: data.totalResults,
        resultsCount: data.results.length,
      });
      setTcgNextOffset(data.nextOffset);
    } catch (error) {
      console.error("TCGplayer search failed", error);
    } finally {
      setTcgLoading(false);
    }
  };

  const handleCardClick = async (
    e: MouseEvent<HTMLDivElement>,
    card: CardWithCollectionData,
    alternate: CardWithCollectionData
  ) => {
    e.preventDefault();
    const targetCard = alternate ?? card;
    handleSetSelectedCard(targetCard);
    setQueryFields({ ...defaultQueryFields });
    setSelectedLinkCard(targetCard as CardDetail);
    setLinkedProduct(null);
    setTcgResults([]);
    setActiveFilters([]);
    setTcgNextOffset(null);
    setLastSearchTimestamp(null);
    const initialFilters = ensureLanguageFilter(
      buildFiltersFromCard(targetCard, defaultQueryFields)
    );
    setDraftFilters(initialFilters);
    setIsSearchDirty(true);
    const defaultQuery =
      buildQueryFromCard(targetCard, defaultQueryFields) ||
      targetCard.name ||
      targetCard.code ||
      card.name ||
      card.code ||
      "";
    setTcgSearch(defaultQuery);
    setCardDetailLoading(true);
    try {
      const detail = await fetchJSON<{ card: CardDetail }>(
        `/api/admin/cards/${targetCard.id}`
      );
      updateLocalCard(detail.card);
      const detailFilters = ensureLanguageFilter(
        buildFiltersFromCard(detail.card, defaultQueryFields)
      );
      const detailQuery =
        buildQueryFromCard(detail.card, defaultQueryFields) ||
        detail.card.name ||
        detail.card.code ||
        defaultQuery;
      setTcgSearch(detailQuery);
      setDraftFilters(detailFilters);
      await handleSearchTcg(0, detailFilters);
    } catch (error) {
      console.error("Failed to fetch card detail", error);
      setIsSearchDirty(true);
    } finally {
      setCardDetailLoading(false);
    }
  };

  const handleLinkProduct = async (product: TcgplayerProduct) => {
    if (!selectedLinkCard) return;
    setLinking(true);
    try {
      let productDetail: TcgplayerProductDetail | null = null;
      try {
        productDetail = await fetchJSON<TcgplayerProductDetail>(
          `/api/admin/tcgplayer/products/${product.productId}?includePricing=true`
        );
      } catch (detailError) {
        console.error(
          "Failed to load product detail before linking",
          detailError
        );
      }

      const payload: {
        productId: number;
        tcgUrl: string | null;
        pricing?: TcgplayerProductDetail["pricing"];
        currency?: string;
      } = {
        productId: product.productId,
        tcgUrl: productDetail?.product?.url ?? product.url ?? null,
      };

      if (productDetail?.pricing) {
        payload.pricing = productDetail.pricing;
        payload.currency = selectedLinkCard.priceCurrency ?? "USD";
      }

      const updated = await fetchJSON<CardDetail>(
        `/api/admin/cards/${selectedLinkCard.id}/tcgplayer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      updateLocalCard(updated);
      setLinkedProduct(productDetail);
    } catch (error) {
      console.error("Failed to link card", error);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkProduct = async () => {
    if (!selectedLinkCard) return;
    setLinking(true);
    try {
      const updated = await fetchJSON<CardDetail>(
        `/api/admin/cards/${selectedLinkCard.id}/tcgplayer`,
        {
          method: "DELETE",
        }
      );
      updateLocalCard(updated);
      setLinkedProduct(null);
    } catch (error) {
      console.error("Failed to unlink card", error);
    } finally {
      setLinking(false);
    }
  };

  // Agrupamos las cartas por código sin modificar sus cantidades:
  const groupedCards = Object.values(
    proxies.reduce((groups, card) => {
      if (!groups[card.code]) {
        groups[card.code] = [];
      }
      groups[card.code].push(card);
      return groups;
    }, {} as Record<string, typeof proxies>)
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

  useEffect(() => {
    if (!selectedLinkCard?.tcgplayerProductId) {
      setLinkedProduct(null);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const detail = await fetchJSON<TcgplayerProductDetail>(
          `/api/admin/tcgplayer/products/${selectedLinkCard.tcgplayerProductId}?includePricing=true`,
          { signal: controller.signal }
        );
        setLinkedProduct(detail);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Failed to load product detail", error);
        }
        setLinkedProduct(null);
      }
    };
    load();
    return () => controller.abort();
  }, [selectedLinkCard?.tcgplayerProductId]);

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

      if (
        remaining <= LOAD_THRESHOLD_PX &&
        !isLoadingMoreRef.current &&
        visibleCount < (filteredCards?.length ?? 0)
      ) {
        isLoadingMoreRef.current = true;
        setVisibleCount((prev) =>
          Math.min(prev + BATCH_SIZE, filteredCards?.length ?? 0)
        );
        setTimeout(() => {
          isLoadingMoreRef.current = false;
        }, 100);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [visibleCount, filteredCards?.length]);

  useEffect(() => {
    if (!showLargeImageCard) {
      setTimeout(() => {
        setIsTouchable(true);
      }, 300);
    } else {
      setIsTouchable(false);
    }
  }, [showLargeImageCard]);

  const totalCards = proxies.reduce((total, card) => total + card.quantity, 0);

  console.log("tcgResultstcgResults", tcgResults);

  return (
    <div className="flex flex-1 bg-[#f2eede] w-full h-full overflow-hidden">
      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 z-50 shadow-lg">
        <div className="flex justify-around items-center">
          <button
            onClick={() => setMobileView("cards")}
            className={`flex flex-col items-center py-2 px-4 rounded-md transition-all min-w-0 flex-1 mx-1 ${
              mobileView === "cards"
                ? "bg-blue-100 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Grid className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Cards</span>
          </button>

          <button
            onClick={() => setMobileView("proxies")}
            className={`flex flex-col items-center py-2 px-4 rounded-md transition-all min-w-0 flex-1 mx-1 relative ${
              mobileView === "proxies"
                ? "bg-blue-100 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="relative flex flex-col">
              <Layers className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">Proxies</span>
              {totalCards > 0 && (
                <div className="absolute -top-2 -right-1 bg-red-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {totalCards}
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Sidebar izquierdo: Lista de cartas disponibles con filtros */}
      <div
        className={`bg-white ${
          mobileView === "cards" ? "flex" : "hidden md:flex"
        } w-full md:w-[300px] lg:w-[400px] xl:w-[450px] flex-shrink-0 border-r border-slate-200 min-h-0 flex-col`}
      >
        {/* Controles móviles */}
        <div className="flex p-3 flex-col gap-3 border-b border-[#f5f5f5]">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Estado TCGplayer
            </span>
            <div className="flex flex-wrap gap-2">
              {LINK_FILTER_OPTIONS.map((option) => {
                const isActive = linkFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLinkFilter(option.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      isActive
                        ? "bg-[#2463eb] text-white shadow"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {option.label}
                    {typeof linkStatusCounts[option.value] === "number" ? (
                      <span className="ml-1 text-[11px] font-normal">
                        ({linkStatusCounts[option.value]})
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

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
                className={`
              ${
                totalFilters > 0
                  ? "bg-[#2463eb] !text-white"
                  : "bg-gray-100 !text-black"
              }
              px-4 py-2 text-black font-bold border rounded-lg
                `}
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
                  linkFilter !== "all"
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
                  setLinkFilter("all");
                }}
                isMobile={true}
              />
            </div>

            <div className="flex justify-center items-center gap-2">
              <ViewSwitch
                viewSelected={viewSelected}
                setViewSelected={setViewSelected}
                isText={false}
              />
            </div>
          </div>
        </div>

        {/* Lista de cartas disponibles */}
        <div
          className="p-3 pb-20 md:pb-3 overflow-y-auto flex-1 min-h-0"
          ref={gridRef}
        >
          {viewSelected === "alternate" && (
            <div className="flex flex-col gap-5">
              {filteredCards?.slice(0, visibleCount).map((card, index) => {
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

                  if (!matchesLinkStatusFilter(card?.tcgplayerLinkStatus ?? null)) {
                    return false;
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

                    if (!matchesLinkStatusFilter(alt?.tcgplayerLinkStatus ?? null)) {
                      return false;
                    }

                    return true;
                  });
                };

                const filteredAlts = getFilteredAlternates();
                const isBaseLinked = isCardLinked(card);
                const isBaseMissing = isCardMarkedMissing(card);
                const baseListStateClass = isBaseLinked
                  ? "bg-gradient-to-br from-emerald-50 via-white to-emerald-100 border-emerald-500 ring-2 ring-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                  : isBaseMissing
                  ? "bg-gradient-to-br from-amber-50 via-white to-amber-100 border-amber-400 ring-2 ring-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                  : "bg-white";
                const baseCardStateClass = isBaseLinked
                  ? "bg-gradient-to-br from-emerald-50 via-white to-emerald-100 border-emerald-500 ring-2 ring-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                  : isBaseMissing
                  ? "bg-gradient-to-br from-amber-50 via-white to-amber-100 border-amber-400 ring-2 ring-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                  : "bg-white";

                if (!baseCardMatches() && filteredAlts.length === 0)
                  return null;

                const totalQuantityBase = proxies
                  ?.filter((card_alt) => card_alt.code === card.code)
                  .reduce((sum, card_alt) => sum + card_alt.quantity, 0);

                return (
                  <div className="flex flex-col gap-5" key={card.id}>
                    <div className="grid gap-3 grid-cols-2 mb-3">
                      {/* Info Card */}
                      <div className="bg-black border rounded-lg shadow p-5 h-full text-white relative overflow-hidden">
                        {card.tcgplayerProductId && (
                          <div className="absolute top-3 right-3 z-10 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                            Linked
                          </div>
                        )}
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
                      {baseCardMatches() && (
                        <div
                          onClick={(e) => handleCardClick(e, card, card)}
                          className={`cursor-pointer border rounded-lg shadow flex justify-center items-center p-4 flex-col h-full relative overflow-hidden ${baseCardStateClass} ${
                            totalQuantityBase >= 4
                              ? "opacity-70 grayscale"
                              : "hover:shadow-md"
                          }`}
                        >
                          {card.tcgplayerProductId ? (
                            <span className="absolute top-2 right-2 rounded-full bg-emerald-600 text-white text-[11px] px-2 py-0.5 shadow flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Linked
                            </span>
                          ) : isBaseMissing ? (
                            <span className="absolute top-2 right-2 rounded-full bg-amber-500 text-white text-[11px] px-2 py-0.5 shadow flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Missing
                            </span>
                          ) : null}
                          <div className="flex justify-center items-center w-full relative">
                            <div
                              className="w-[80%] m-auto"
                              onMouseEnter={() =>
                                handlePreviewEnter(card?.src, card?.name)
                              }
                              onMouseLeave={hidePreview}
                            >
                              <LazyImage
                                src={card?.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={card?.name}
                                priority={index < 20}
                                size="small"
                                className="w-full"
                              />
                            </div>
                            {(() => {
                              const baseCardInProxies = proxies.find(
                                (proxyCard) =>
                                  proxyCard.cardId === Number(card.id)
                              );
                              return (
                                baseCardInProxies && (
                                  <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                                    <span className="mb-[2px]">
                                      {baseCardInProxies.quantity}
                                    </span>
                                  </div>
                                )
                              );
                            })()}
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
                                {set.set.title}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alternate Cards */}
                      {filteredAlts.map((alt) => {
                        const alternateInProxies = proxies.find(
                          (proxyCard) => proxyCard.cardId === Number(alt.id)
                        );
                        const isAltLinked = Boolean(alt.tcgplayerProductId);
                        const isAltMissing = isCardMarkedMissing(alt);
                        const altCardStateClass = isAltLinked
                          ? "bg-gradient-to-br from-emerald-50 via-white to-emerald-100 border-emerald-500 ring-2 ring-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                          : isAltMissing
                          ? "bg-gradient-to-br from-amber-50 via-white to-amber-100 border-amber-400 ring-2 ring-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                          : "bg-white";

                        return (
                          <div
                            key={alt.id}
                            onClick={(e) => handleCardClick(e, card, alt)}
                            className={`cursor-pointer border rounded-lg shadow flex justify-center items-center p-4 flex-col h-full hover:shadow-md relative overflow-hidden ${altCardStateClass}`}
                          >
                            {isAltLinked ? (
                              <span className="absolute top-2 right-2 rounded-full bg-emerald-600 text-white text-[11px] px-2 py-0.5 shadow flex items-center gap-1 z-10">
                                <CheckCircle2 className="h-3 w-3" />
                                Linked
                              </span>
                            ) : isAltMissing ? (
                              <span className="absolute top-2 right-2 rounded-full bg-amber-500 text-white text-[11px] px-2 py-0.5 shadow flex items-center gap-1 z-10">
                                <AlertTriangle className="h-3 w-3" />
                                Missing
                              </span>
                            ) : null}
                            <div className="flex justify-center items-center w-full relative">
                              <div
                                className="w-[80%] m-auto"
                                onMouseEnter={() =>
                                  handlePreviewEnter(alt?.src, alt?.name)
                                }
                                onMouseLeave={hidePreview}
                              >
                                <LazyImage
                                  src={alt?.src}
                                  fallbackSrc="/assets/images/backcard.webp"
                                  alt={alt?.name}
                                  priority={index < 20}
                                  size="small"
                                  className="w-full"
                                />
                              </div>
                              {alternateInProxies && (
                                <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                                  <span className="mb-[2px]">
                                    {alternateInProxies.quantity}
                                  </span>
                                </div>
                              )}
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

          {viewSelected === "list" && (
            <div className="grid gap-3 grid-cols-3 justify-items-center">
              {filteredCards?.slice(0, visibleCount).map((card, index) => {
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

                  if (!matchesLinkStatusFilter(card?.tcgplayerLinkStatus ?? null)) {
                    return false;
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

                    if (!matchesLinkStatusFilter(alt?.tcgplayerLinkStatus ?? null)) {
                      return false;
                    }
                    return true;
                  });
                };

                const filteredAlts = getFilteredAlternates();
                const isBaseMissingList = isCardMarkedMissing(card);
                const baseListStateClass = card.tcgplayerProductId
                  ? "bg-gradient-to-br from-emerald-50 via-white to-emerald-100 border-emerald-500 ring-2 ring-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                  : isBaseMissingList
                  ? "bg-gradient-to-br from-amber-50 via-white to-amber-100 border-amber-400 ring-2 ring-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                  : "bg-white";

                // Si ni la carta base ni alguna alterna coinciden, no renderizamos nada
                if (!baseCardMatches() && filteredAlts.length === 0)
                  return null;

                return (
                  <React.Fragment key={card.id}>
                    {baseCardMatches() && (
                      <div
                        onClick={(e) => handleCardClick(e, card, card)}
                        className="w-full cursor-pointer transition-all duration-200 rounded-lg"
                      >
                        <div
                          className={`border rounded-lg shadow pb-3 justify-center items-center flex flex-col relative overflow-hidden ${baseListStateClass}`}
                        >
                          <div
                            className="w-full"
                            onMouseEnter={() =>
                              handlePreviewEnter(card?.src, card?.name)
                            }
                            onMouseLeave={hidePreview}
                          >
                            <LazyImage
                              src={card.src}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={card.name}
                              priority={index < 20}
                              size="small"
                              className="w-full"
                            />
                          </div>
                          {card.tcgplayerProductId ? (
                            <div className="absolute top-2 left-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] text-white shadow flex items-center gap-1 z-10">
                              <CheckCircle2 className="h-3 w-3" />
                              Linked
                            </div>
                          ) : isBaseMissingList ? (
                            <div className="absolute top-2 left-2 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] text-white shadow flex items-center gap-1 z-10">
                              <AlertTriangle className="h-3 w-3" />
                              Missing
                            </div>
                          ) : null}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex justify-center items-center w-full flex-col">
                                  <span
                                    className={`${oswald.className} text-[13px] font-bold mt-2`}
                                  >
                                    {card?.code}
                                  </span>
                                  <span className="text-center text-[13px] line-clamp-1">
                                    {card?.sets[0]?.set?.title}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{card?.sets[0]?.set?.title}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {(() => {
                            const baseCardInProxies = proxies.find(
                              (proxyCard) =>
                                proxyCard.cardId === Number(card.id)
                            );
                            return (
                              baseCardInProxies && (
                                <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                                  <span className="mb-[2px]">
                                    {baseCardInProxies.quantity}
                                  </span>
                                </div>
                              )
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {filteredAlts.map((alt) => {
                      const alternateInProxies = proxies.find(
                        (proxyCard) => proxyCard.cardId === Number(alt.id)
                      );
                      const isAltMissingList = isCardMarkedMissing(alt);
                      const altListStateClass = alt.tcgplayerProductId
                        ? "bg-gradient-to-br from-emerald-50 via-white to-emerald-100 border-emerald-500 ring-2 ring-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                        : isAltMissingList
                        ? "bg-gradient-to-br from-amber-50 via-white to-amber-100 border-amber-400 ring-2 ring-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                        : "bg-white";

                      return (
                        <div
                          key={alt.id}
                          onClick={(e) => handleCardClick(e, card, alt)}
                          className="w-full cursor-pointer transition-all duration-200 rounded-lg"
                        >
                          <div
                            className={`border rounded-lg shadow pb-3 justify-center items-center flex flex-col relative overflow-hidden ${altListStateClass}`}
                          >
                            {alt.tcgplayerProductId && (
                              <Badge className="absolute left-2 top-2 bg-emerald-600 text-white shadow flex items-center gap-1 z-10">
                                <CheckCircle2 className="h-3 w-3" />
                                Linked
                              </Badge>
                            )}
                            {!alt.tcgplayerProductId && isAltMissingList && (
                              <Badge className="absolute left-2 top-2 bg-amber-500 text-white shadow flex items-center gap-1 z-10">
                                <AlertTriangle className="h-3 w-3" />
                                Missing
                              </Badge>
                            )}
                            <div
                              className="w-full"
                              onMouseEnter={() =>
                                handlePreviewEnter(alt?.src, alt?.name)
                              }
                              onMouseLeave={hidePreview}
                            >
                              <LazyImage
                                src={alt.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={alt.name}
                                priority={index < 20}
                                size="small"
                                className="w-full"
                              />
                            </div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex justify-center items-center w-full flex-col">
                                    <span
                                      className={`${oswald.className} text-[13px] font-bold mt-2`}
                                    >
                                      {card?.code}
                                    </span>
                                    <span className="text-center text-[13px] line-clamp-1">
                                      {alt?.sets[0]?.set?.title}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{alt?.sets[0]?.set?.title}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {alternateInProxies && (
                              <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                                <span className="mb-[2px]">
                                  {alternateInProxies.quantity}
                                </span>
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

      {/* Área principal*/}
      <div
        className={`flex flex-col flex-1 min-h-0 bg-[#f2eede] overflow-y-auto ${
          mobileView === "proxies" ? "flex" : "hidden md:flex"
        }`}
      >
        <div className="flex flex-col gap-4 p-4">
          <UICard className="shadow-lg border border-gray-200">
            <CardHeader>
              <CardTitle>Card Detail</CardTitle>
            </CardHeader>
            <CardContent>
              {cardDetailLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : selectedLinkCard ? (
                <CardDetailsSection
                  selectedLinkCard={selectedLinkCard}
                  snapshotInfo={snapshotInfo}
                  linkedProduct={linkedProduct}
                  linking={linking}
                  handleUnlinkProduct={handleUnlinkProduct}
                  handleToggleMissing={() =>
                    toggleMissingLink(selectedLinkCard.id)
                  }
                  formatPriceValue={formatPriceValue}
                  onPreviewEnter={handlePreviewEnter}
                  onPreviewLeave={hidePreview}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a card from the left to view details and link it to
                  TCGplayer.
                </p>
              )}
            </CardContent>
          </UICard>

          <UICard className="flex-1 shadow-lg border border-gray-200">
            <CardHeader>
              <CardTitle>TCGplayer Search</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!selectedLinkCard ? (
                <p className="text-sm text-muted-foreground">
                  Select a card on the left to configure a TCGplayer search.
                </p>
              ) : (
                <>
                  {selectedLinkCard.tcgplayerProductId && (
                    <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                      <p className="font-semibold">
                        This card is currently linked to TCGplayer product #
                        {selectedLinkCard.tcgplayerProductId}.
                      </p>
                      <p className="mt-2">
                        You can unlink it from the detail panel or directly from
                        the product card below.
                      </p>
                    </div>
                  )}

                  <Tabs
                    value={searchMode}
                    onValueChange={(value) => {
                      setSearchMode(value as "filters" | "text");
                      setIsSearchDirty(true);
                    }}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="filters">Filter Search</TabsTrigger>
                      <TabsTrigger value="text">Text Search</TabsTrigger>
                    </TabsList>

                    <TabsContent value="filters" className="space-y-4 mt-4">
                      <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 space-y-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex-1 min-w-[200px] space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Query preview
                            </p>
                            <p className="text-base font-semibold text-gray-900">
                              {tcgSearch || selectedLinkCard.name || "Auto"}
                            </p>
                            {lastSearchTimestamp && !isSearchDirty && (
                              <p className="text-xs text-muted-foreground">
                                Last search:{" "}
                                {formatUpdatedTimestamp(lastSearchTimestamp)}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:shadow-md"
                              onClick={() => handleSearchTcg(0)}
                              disabled={tcgLoading}
                            >
                              {tcgLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Searching...
                                </>
                              ) : (
                                <>
                                  <Search className="mr-2 h-4 w-4" />
                                  Search TCGplayer
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleResetTcgFilters}
                              disabled={tcgLoading}
                            >
                              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                              Reset filters
                            </Button>
                          </div>
                        </div>
                        {isSearchDirty ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Filters updated. Run a new search to refresh the list.
                          </div>
                        ) : (
                          lastSearchTimestamp && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                              Results are in sync with your last search.
                            </div>
                          )
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Include the following attributes in the search query:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {queryToggleOptions.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              disabled={!option.available}
                              onClick={() => handleToggleQueryField(option.key)}
                              className={`px-3 py-1 rounded-full text-xs border transition ${
                                queryFields[option.key] && option.available
                                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                  : "bg-gray-100 text-gray-600 border-gray-200"
                              } ${
                                !option.available
                                  ? "opacity-40 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="text" className="space-y-4 mt-4">
                      <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 space-y-4 shadow-sm">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-2">
                              Search query
                            </label>
                            <Input
                              type="text"
                              placeholder={`Search for "${selectedLinkCard.name}" or enter custom text...`}
                              value={textSearchQuery}
                              onChange={(e) => {
                                setTextSearchQuery(e.target.value);
                                setIsSearchDirty(true);
                              }}
                              className="w-full"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSearchTcg(0);
                                }
                              }}
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              {textSearchQuery.trim()
                                ? `Searching for: "${textSearchQuery.trim()}"`
                                : `Will search for card name: "${selectedLinkCard.name}"`}
                            </p>
                          </div>
                          {lastSearchTimestamp && !isSearchDirty && (
                            <p className="text-xs text-muted-foreground">
                              Last search: {formatUpdatedTimestamp(lastSearchTimestamp)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:shadow-md"
                            onClick={() => handleSearchTcg(0)}
                            disabled={tcgLoading}
                          >
                            {tcgLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Search TCGplayer
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTextSearchQuery("");
                              setIsSearchDirty(true);
                            }}
                            disabled={tcgLoading || !textSearchQuery}
                          >
                            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                            Clear text
                          </Button>
                        </div>
                        {isSearchDirty ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Search text updated. Run a new search to refresh the list.
                          </div>
                        ) : (
                          lastSearchTimestamp && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                              Results are in sync with your last search.
                            </div>
                          )
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="space-y-3">
                    {tcgResults.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-muted-foreground bg-white/60">
                        {tcgLoading
                          ? "Searching TCGplayer..."
                          : isSearchDirty
                          ? 'Your search is ready. Click "Search TCGplayer" to load results.'
                          : "No matches for the current filters. Adjust the toggles and search again."}
                      </div>
                    ) : (
                      <>
                        {isSearchDirty && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Search parameters changed. Run a new search to update this list.
                          </div>
                        )}
                        {!isSearchDirty && tcgResults.length > 0 && (
                          <>
                            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-center justify-between">
                              <span>
                                Showing <strong>{tcgResults.length}</strong> results
                                {tcgNextOffset !== null && " (more available)"}
                              </span>
                              {tcgNextOffset !== null && (
                                <span className="text-[11px] opacity-75">
                                  Click "Load more" below to see more results
                                </span>
                              )}
                            </div>
                          </>
                        )}
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {tcgResults.map((product) => {
                            const isLinkedCard =
                              Boolean(linkedProductId) &&
                              linkedProductId === product.productId;
                            const isLinkedAnywhere = linkedProductIds.has(
                              product.productId
                            );
                            const cardClasses = isLinkedAnywhere
                              ? "relative overflow-hidden border-2 border-emerald-500/70 bg-gradient-to-br from-emerald-50 via-emerald-100 to-white shadow-lg ring-2 ring-emerald-300"
                              : "border bg-white/90 shadow-sm hover:shadow-md";
                            return (
                              <div
                                key={product.productId}
                                className={`${cardClasses} rounded-xl p-3 flex flex-col transition`}
                              >
                                {isLinkedAnywhere && (
                                  <>
                                    <div className="absolute inset-0 pointer-events-none rounded-xl bg-emerald-500/5" />
                                    <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs uppercase tracking-wide pb-2">
                                      <CheckCircle2 className="h-4 w-4" />
                                      {isLinkedCard
                                        ? "Linked to this card"
                                        : "Linked elsewhere"}
                                    </div>
                                  </>
                                )}
                                <div className="flex gap-3 relative z-[1]">
                                  <div className="relative w-20 h-28 rounded-lg overflow-hidden bg-gray-50 border">
                                    {isLinkedAnywhere && (
                                      <span className="absolute top-1 right-1 rounded-full bg-emerald-600 text-white text-[9px] px-2 py-0.5 shadow">
                                        {isLinkedCard
                                          ? "Active Link"
                                          : "Linked"}
                                      </span>
                                    )}
                                    {product.imageUrl ? (
                                      <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                        onMouseEnter={() =>
                                          handlePreviewEnter(
                                            product.imageUrl,
                                            product.name
                                          )
                                        }
                                        onMouseLeave={hidePreview}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                                        No image
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <p
                                      className={`font-semibold text-sm leading-tight line-clamp-2 ${
                                        isLinkedAnywhere
                                          ? "text-emerald-900"
                                          : ""
                                      }`}
                                    >
                                      {product.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {product.groupName ??
                                        product.categoryName ??
                                        "-"}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                      Product ID: {product.productId}
                                    </p>
                                    {product.url && (
                                      <Link
                                        href={product.url}
                                        target="_blank"
                                        className={`inline-flex items-center gap-1 text-[11px] mt-1 ${
                                          isLinkedAnywhere
                                            ? "text-emerald-700"
                                            : "text-primary"
                                        }`}
                                      >
                                        View on TCGplayer
                                        <ExternalLink className="h-3 w-3" />
                                      </Link>
                                    )}
                                  </div>
                                </div>
                                {isLinkedCard ? (
                                  <Button
                                    className="mt-4 bg-red-600 hover:bg-red-700 text-white"
                                    variant="destructive"
                                    disabled={linking}
                                    onClick={handleUnlinkProduct}
                                  >
                                    {linking
                                      ? "Unlinking..."
                                      : "Unlink product"}
                                  </Button>
                                ) : isLinkedAnywhere ? (
                                  <Button
                                    className="mt-4"
                                    variant="secondary"
                                    disabled
                                    title="This product is already linked to another card"
                                  >
                                    Linked to another card
                                  </Button>
                                ) : (
                                  <Button
                                    className="mt-4"
                                    variant="secondary"
                                    disabled={linking}
                                    onClick={() => handleLinkProduct(product)}
                                  >
                                    Link product
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {tcgNextOffset !== null && !isSearchDirty && (
                          <div className="flex justify-center pt-2">
                            <Button
                              variant="outline"
                              onClick={() => handleSearchTcg(tcgNextOffset)}
                              disabled={tcgLoading}
                            >
                              {tcgLoading ? "Loading..." : "Load more"}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </UICard>
          <HoverImagePreviewOverlay preview={hoverPreview} />
        </div>
      </div>

      {/* Sidebar de filtros móviles */}
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
          disabledColors={[]}
          selectedAltArts={selectedAltArts}
          setSelectedAltArts={setSelectedAltArts}
          selectedCodes={selectedCodes}
          setSelectedCodes={setSelectedCodes}
          disabledTypes={[]}
        />
      </Transition>

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
    </div>
  );
};

export default TcgLinker;
