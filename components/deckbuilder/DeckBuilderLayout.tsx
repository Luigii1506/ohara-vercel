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
import { allColors } from "@/helpers/constants";
import { sortByCollectionOrder } from "@/lib/cards/sort";
import { Badge } from "@/components/ui/badge";
import SearchFilters from "@/components/home/SearchFilters";
import ClearFiltersButton from "../ClearFiltersButton";

import DeckStats from "../../components/deckbuilder/DeckStatsPreview";

const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "700"] });

import LazyImage from "@/components/LazyImage";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";

import { DeckCard } from "@/types";
import ViewSwitch from "../ViewSwitch";
import StoreCard from "../StoreCard";

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

interface CompleteDeckBuilderLayoutProps {
  onSave: () => void;
  onRestart: () => void;
  deckBuilder: ReturnType<typeof useDeckBuilder>;
  initialCards: CardWithCollectionData[];
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
}

const CompleteDeckBuilderLayout = ({
  onSave,
  onRestart,
  deckBuilder,
  initialCards,
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
}: CompleteDeckBuilderLayoutProps) => {
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Helper functions for price handling
  const getNumericPrice = (value: any) => {
    if (value === null || value === undefined || value === "") return null;
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const getCardPriceValue = useCallback((card: CardWithCollectionData | DeckCard) => {
    if ('marketPrice' in card) {
      // Filtrar alternativas válidas antes de obtener el precio
      const validAlternates = filterValidAlternates(card.alternates);
      return (
        getNumericPrice(card.marketPrice) ??
        getNumericPrice(validAlternates[0]?.marketPrice) ??
        null
      );
    }
    return null;
  }, []);

  const formatCurrency = (value: number, currency?: string | null) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(value);

  // Helper function para filtrar alternativas excluidas
  const filterValidAlternates = (alternates: CardWithCollectionData[] | undefined) => {
    if (!alternates) return [];
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
        <div
          className={`text-xs font-medium text-gray-400 ${className}`}
        >
          N/A
        </div>
      );
    }

    const validAlternates = filterValidAlternates(card.alternates);
    const currency =
      card.priceCurrency ?? validAlternates[0]?.priceCurrency ?? "USD";

    return (
      <div
        className={`text-xs font-semibold text-emerald-600 ${className}`}
      >
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

  const [visibleCount, setVisibleCount] = useState(50);
  const [selectedCard, setSelectedCard] = useState<DeckCard | undefined>();

  const [showLargeImageCard, setShowLargeImageCard] = useState<boolean>(false);

  // Estados adicionales para StoreCard
  const [baseCard, setBaseCard] = useState<any>(null);
  const [alternatesCards, setAlternatesCards] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Estado para controlar la vista mobile
  const [mobileView, setMobileView] = useState<"cards" | "deck">("cards");
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

    handleCardClick({} as any, card, card);
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
    if (!initialCards || initialCards.length === 0) return [];

    return initialCards
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
          card.colors.some((col) =>
            selectedColors.includes(col.color.toLowerCase())
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
            return altSetCodes.some((code) => normalizedSelectedSets.includes(code));
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
          selectedCodes?.length === 0 || (card.setCode ?? "").split(",").some(code => selectedCodes.includes(code.trim()));

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
        // Filtrar alternativas excluidas
        alternates: filterValidAlternates(card.alternates),
      }))
      .sort((a, b) => {
        // Primero ordenar por el sort seleccionado si existe
        if (selectedSort === "Most variants") {
          const variantDiff = (b.alternates?.length ?? 0) - (a.alternates?.length ?? 0);
          if (variantDiff !== 0) return variantDiff;
        } else if (selectedSort === "Less variants") {
          const variantDiff = (a.alternates?.length ?? 0) - (b.alternates?.length ?? 0);
          if (variantDiff !== 0) return variantDiff;
        }

        // Luego aplicar orden estándar de colección (OP → EB → ST → P → otros)
        return sortByCollectionOrder(a, b);
      });
  }, [
    initialCards,
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
  ]);

  console.log("initial", initialCards);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isInputClear, setIsInputClear] = useState(false);

  // Ref para la lista de cartas (grid)
  const gridRef = useRef<HTMLDivElement>(null);

  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Estado para controlar el sidebar de filtros
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Si hay un Leader seleccionado, obtenemos sus colores
  const leaderColors = deckBuilder.selectedLeader
    ? deckBuilder.selectedLeader.colors.map((c: { color: string }) =>
        c.color.toLowerCase()
      )
    : [];

  const disabledColors = allColors?.filter(
    (color) => !leaderColors.includes(color)
  );

  // Filtrado adicional:
  // - Si NO hay un Leader seleccionado: mostramos solo cartas de la categoría "Leader".
  // - Si hay un Leader seleccionado: mostramos solo cartas que no sean de la categoría "Leader"
  //   y que tengan al menos un color en común con el Leader.
  const filteredByLeader = useMemo(() => {
    if (!filteredCards) return []; // ⚡ Retornar array vacío en vez de null

    const filtered = deckBuilder.selectedLeader
      ? filteredCards.filter(
          (card) =>
            card.category !== "Leader" &&
            card.colors.some((col) =>
              leaderColors.includes(col.color.toLowerCase())
            )
        )
      : filteredCards.filter((card) => card.category === "Leader");

    // Las cartas ya vienen ordenadas de filteredCards, pero aseguramos el orden
    return filtered.sort(sortByCollectionOrder);
  }, [filteredCards, deckBuilder.selectedLeader, leaderColors]);

  console.log("filteredCards", filteredCards);
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
      // Buscar el leader en initialCards (puede ser base o alternativa)
      let foundLeader: CardWithCollectionData | undefined;

      // Primero buscar en las cartas base
      foundLeader = initialCards.find(
        (card) => Number(card.id) === Number(deckBuilder.selectedLeader?.id)
      );

      // Si no se encuentra en las bases, buscar en las alternativas
      if (!foundLeader) {
        for (const card of initialCards) {
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
      // Buscar la carta original en initialCards (puede ser base o alternativa)
      let foundCard: CardWithCollectionData | undefined;

      // Primero buscar en las cartas base
      foundCard = initialCards.find(
        (card) => Number(card.id) === deckCard.cardId
      );

      // Si no se encuentra en las bases, buscar en las alternativas
      if (!foundCard) {
        for (const card of initialCards) {
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
  }, [deckBuilder.deckCards, deckBuilder.selectedLeader, initialCards, getCardPriceValue]);

  const handleScrollToTop = () => {
    gridRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setVisibleCount(50);
  };

  // Handler para el click en cada carta
  const handleCardClick = (
    e: MouseEvent<HTMLDivElement>,
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
      });

      // Scroll para que el card clickeado quede centrado
      // Scroll para que el card clickeado quede centrado solo si no se ve completamente
      const containerRect = gridRef.current?.getBoundingClientRect();
      const cardRect = e.currentTarget.getBoundingClientRect();

      if (containerRect) {
        if (
          cardRect.top < containerRect.top ||
          cardRect.bottom > containerRect.bottom
        ) {
          e.currentTarget.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      } else {
        // Si no se puede obtener el contenedor, se hace scroll como fallback.
        e.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" });
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

      if (
        remaining <= LOAD_THRESHOLD_PX &&
        !isLoadingMoreRef.current &&
        visibleCount < (filteredByLeader?.length ?? 0)
      ) {
        isLoadingMoreRef.current = true;
        setVisibleCount((prev) =>
          Math.min(prev + BATCH_SIZE, filteredByLeader?.length ?? 0)
        );
        setTimeout(() => {
          isLoadingMoreRef.current = false;
        }, 100);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [visibleCount, filteredByLeader?.length]);

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

  console.log("12", filteredByLeader);
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
            onClick={() => setMobileView("deck")}
            className={`flex flex-col items-center py-2 px-4 rounded-md transition-all min-w-0 flex-1 mx-1 relative ${
              mobileView === "deck"
                ? "bg-blue-100 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="relative flex flex-col">
              <Layers className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">Deck</span>
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
                  selectedAltArts.length > 0
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

        {/* Lista de cartas disponibles */}
        <div
          className="p-3 pb-20 md:pb-3 overflow-y-auto flex-1 min-h-0"
          ref={gridRef}
        >
          {viewSelected === "alternate" && (
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
                    if (!baseSetCodes.some((code: string) => normalizedSelectedSets.includes(code))) {
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
                      if (!altSetCodes.some((code) => normalizedSelectedSets.includes(code))) {
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
                      {baseCardMatches() && (
                        <div
                          onClick={(e) => {
                            if (totalQuantityBase >= 4) {
                              // Optional: Add logic if the limit is reached.
                            } else {
                              handleCardClick(e, card, card);
                            }
                          }}
                          className={`cursor-pointer border rounded-lg shadow bg-white flex justify-center items-center p-4 flex-col h-full ${
                            totalQuantityBase >= 4
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
                            {(() => {
                              const baseCardInDeck = deckBuilder.deckCards.find(
                                (deckCard) =>
                                  deckCard.cardId === Number(card.id)
                              );
                              return (
                                baseCardInDeck && (
                                  <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                                    <span className="mb-[2px]">
                                      {baseCardInDeck.quantity}
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
                        const alternateInDeck = deckBuilder.deckCards.find(
                          (deckCard) => deckCard.cardId === Number(alt.id)
                        );
                        const totalQuantity = deckBuilder.deckCards
                          ?.filter((card_alt) => card_alt.code === card.code)
                          .reduce(
                            (sum, card_alt) => sum + card_alt.quantity,
                            0
                          );

                        return (
                          <div
                            key={alt.id}
                            onClick={(e) => {
                              if (totalQuantity >= 4) {
                                // Optional: Add logic if the limit is reached.
                              } else {
                                handleCardClick(e, card, alt);
                              }
                            }}
                            className={`cursor-pointer border rounded-lg shadow bg-white flex justify-center items-center p-4 flex-col h-full ${
                              totalQuantity >= 4
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
                              {alternateInDeck && (
                                <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                                  <span className="mb-[2px]">
                                    {alternateInDeck.quantity}
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

          {viewSelected === "text" && (
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
                            ?.filter((card_alt) => card_alt.code === card.code)
                            .reduce(
                              (sum, card_alt) => sum + card_alt.quantity,
                              0
                            );

                          return (
                            <div
                              key={alt.id}
                              onClick={() => handleStoreCardClick(alt)}
                              className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg ${
                                totalQuantity >= 4 ? "opacity-70 grayscale" : ""
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

          {viewSelected === "list" && (
            <div className="grid gap-3 grid-cols-3 justify-items-center">
              {filteredByLeader?.slice(0, visibleCount).map((card, index) => {
                // Función que determina si la carta base coincide con los filtros
                const baseCardMatches = (): boolean => {
                  if (!card) return false;

                  if (normalizedSelectedSets.length > 0) {
                    const baseSetCodes = (card.setCode ?? "")
                      .split(",")
                      .map((code: string) => code.trim().toLowerCase())
                      .filter(Boolean);
                    if (!baseSetCodes.some((code: string) => normalizedSelectedSets.includes(code))) {
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
                      if (!altSetCodes.some((code) => normalizedSelectedSets.includes(code))) {
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

                return (
                  <React.Fragment key={card.id}>
                    {baseCardMatches() && (
                      <div
                        onClick={(e) => {
                          if (totalQuantityBase >= 4) {
                            // Optional: Add logic if the limit is reached.
                          } else {
                            handleCardClick(e, card, card);
                          }
                        }}
                        className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg ${
                          totalQuantityBase >= 4 ? "opacity-70 grayscale" : ""
                        }`}
                      >
                        <div className="border rounded-lg shadow pb-3 bg-white justify-center items-center flex flex-col relative">
                          <LazyImage
                            src={card.src}
                            fallbackSrc="/assets/images/backcard.webp"
                            alt={card.name}
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
                          <PriceTag card={card} className="mt-1" />
                          {(() => {
                            const baseCardInDeck = deckBuilder.deckCards.find(
                              (deckCard) => deckCard.cardId === Number(card.id)
                            );
                            return (
                              baseCardInDeck && (
                                <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                                  <span className="mb-[2px]">
                                    {baseCardInDeck.quantity}
                                  </span>
                                </div>
                              )
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {filteredAlts.length > 0 &&
                      filteredAlts.map((alt) => {
                        const alternateInDeck = deckBuilder.deckCards.find(
                          (deckCard) => deckCard.cardId === Number(alt.id)
                        );
                        const totalQuantity = deckBuilder.deckCards
                          ?.filter((card_alt) => card_alt.code === card.code)
                          .reduce(
                            (sum, card_alt) => sum + card_alt.quantity,
                            0
                          );

                        return (
                          <div
                            key={alt.id}
                            onClick={(e) => {
                              if (totalQuantity >= 4) {
                                // Optional: Add logic if the limit is reached.
                              } else {
                                handleCardClick(e, card, alt);
                              }
                            }}
                            className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg ${
                              totalQuantity >= 4 ? "opacity-70 grayscale" : ""
                            }`}
                          >
                            <div className="border rounded-lg shadow pb-3 bg-white justify-center items-center flex flex-col relative">
                              <LazyImage
                                src={alt.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={alt.name}
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
                              <PriceTag card={alt} className="mt-1" />
                              {alternateInDeck && (
                                <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                                  <span className="mb-[2px]">
                                    {alternateInDeck.quantity}
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

          {viewSelected === "grid" && (
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
                    if (!baseSetCodes.some((code: string) => normalizedSelectedSets.includes(code))) {
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
                    if (!altSetCodes.some((code: string) => normalizedSelectedSets.includes(code))) {
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
                  card.alternates?.filter((alt) => alternateMatches(alt)) || [];

                // Si ni la carta base ni ninguna alterna cumplen, no renderizamos nada para esta carta
                if (!baseCardMatches(card) && filteredAlternates.length === 0)
                  return null;

                // Obtener cantidad en deck para carta base
                const totalQuantityBase = deckBuilder.deckCards
                  ?.filter((card_alt) => card_alt.code === card.code)
                  .reduce((sum, card_alt) => sum + card_alt.quantity, 0);

                return (
                  <React.Fragment key={card.id}>
                    {/* Render the base card only if it matches the filters */}
                    {baseCardMatches(card) && (
                      <div
                        className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit mb-3"
                        onClick={(e) => {
                          if (totalQuantityBase >= 4) {
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
                          totalQuantityBase >= 4
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
                              <p>{card.sets?.[0]?.set?.title}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {(() => {
                          const baseCardInDeck = deckBuilder.deckCards.find(
                            (deckCard) => deckCard.cardId === Number(card.id)
                          );
                          return (
                            baseCardInDeck && (
                              <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[30px] w-[30px] flex items-center justify-center text-[12px] font-bold border-2 border-white z-10">
                                <span className="mb-[2px]">
                                  {baseCardInDeck.quantity}
                                </span>
                              </div>
                            )
                          );
                        })()}
                      </div>
                    )}

                    {/* Render filtered alternates */}
                    {filteredAlternates.map((alt, altIndex) => {
                      const alternateInDeck = deckBuilder.deckCards.find(
                        (deckCard) => deckCard.cardId === Number(alt.id)
                      );

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

                            if (totalQuantity >= 4) {
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
                          {alternateInDeck && (
                            <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[30px] w-[30px] flex items-center justify-center text-[12px] font-bold border-2 border-white z-10">
                              <span className="mb-[2px]">
                                {alternateInDeck.quantity}
                              </span>
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

      {/* Área principal: Construcción del deck */}
      <div
        className={`flex flex-col flex-1 min-h-0 bg-[#f2eede] ${
          mobileView === "deck" ? "flex" : "hidden md:flex"
        }`}
      >
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
                      const priceValue = getCardPriceValue(deckBuilder.selectedLeader);
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
                            setVisibleCount(50);
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
                  <div className={`text-lg sm:text-xl font-bold leading-none ${
                    50 - totalCards <= 10 ? 'text-amber-600' : 50 - totalCards === 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    {50 - totalCards}
                  </div>
                  <div className={`text-[10px] font-medium leading-tight mt-0.5 uppercase tracking-wider ${
                    50 - totalCards <= 10 ? 'text-amber-600' : 50 - totalCards === 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}>
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
                                <span className="text-gray-600">Cards with price:</span>
                                <span className="font-medium text-gray-900">{cardsWithPrice}</span>
                              </p>
                              {cardsWithoutPrice > 0 && (
                                <p className="flex justify-between gap-3">
                                  <span className="text-gray-600">Cards without price:</span>
                                  <span className="font-medium text-amber-600">{cardsWithoutPrice}</span>
                                </p>
                              )}
                              <div className="pt-2 mt-2 border-t border-gray-200">
                                <p className="flex justify-between gap-3">
                                  <span className="text-gray-600">Average per card:</span>
                                  <span className="font-medium text-emerald-600">
                                    {formatCurrency(totalDeckPrice / (cardsWithPrice || 1))}
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
                          ? 'bg-gray-900 text-white hover:bg-gray-800'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                      onClick={() => setIsStatsOpen(!isStatsOpen)}
                    >
                      <ChartColumnBigIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-white border border-gray-200">
                    <p className="font-medium text-sm">{isStatsOpen ? 'Hide' : 'View'} Statistics</p>
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
                  setVisibleCount(50);
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
    </div>
  );
};

export default CompleteDeckBuilderLayout;
