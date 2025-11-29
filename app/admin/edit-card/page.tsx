"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { CardWithCollectionData } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MultiSelect from "@/components/MultiSelect";
import { setCodesOptions, setOptions } from "@/helpers/constants";
import { Oswald } from "next/font/google";
import { Plus, Edit, Trash2, RefreshCcw, Loader2, Eye } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import DropdownSearch from "@/components/DropdownSearch";
import ViewSwitch from "@/components/ViewSwitch";
import LazyImage from "@/components/LazyImage";
import FiltersSidebar from "@/components/FiltersSidebar";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import EditCardModal from "./components/EditCardModal";
import EditAlternateModal from "./components/EditAlternateModal";
import { useAllCards } from "@/hooks/useCards";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateCardMutation,
  useDeleteCardMutation,
} from "@/hooks/queries/useCardMutations";
import {
  useSetsDropdownQuery,
  useSetsQuery,
} from "@/hooks/queries/useSetsQuery";
import { useHybridCardSync } from "@/hooks/queries/useHybridCardSync";
import {
  EditCardSkeleton,
  CardDetailSkeleton,
} from "@/components/skeletons/EditCardSkeleton";
import { sortByCollectionOrder } from "@/lib/cards/sort";
import { useCardStore } from "@/store/cardStore";
import type { CardsFilters } from "@/lib/cards/types";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Interfaces
interface AlternateCard {
  id: string;
  src: string;
  sets: { set: { id: string; title: string; code?: string | null } }[];
  alias: string;
  tcgUrl?: string;
  alternateArt?: string | null;
  order?: string;
  isPro?: boolean;
  region?: string;
  isFirstEdition?: boolean;
  code?: string;
  setCode?: string;
}

interface Set {
  id: string;
  title: string;
  code?: string | null;
}

const EditCard = () => {
  const gridRef = useRef<HTMLDivElement>(null);

  // ✅ Obtener todas las cartas usando el mismo sistema que proxies
  const cachedCards = useCardStore((state) => state.allCards);
  const setAllCards = useCardStore((state) => state.setAllCards);
  const isFullyLoaded = useCardStore((state) => state.isFullyLoaded);
  const setIsFullyLoaded = useCardStore((state) => state.setIsFullyLoaded);
  const allCardsSignatureRef = useRef<string | null>(null);

  // Filtros vacíos para traer TODAS las cartas
  const fullQueryFilters = useMemo<CardsFilters>(() => ({}), []);

  const {
    data: allCardsData,
    isLoading: cardsLoading,
    isFetching: isFetchingAllCards,
    error: cardsError,
  } = useAllCards(fullQueryFilters, {
    includeRelations: true,
    includeAlternates: true,
    includeCounts: true,
  });

  // ✅ Guardar en Zustand cuando lleguen las cartas
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
    }
  }, [allCardsData, isFetchingAllCards, setAllCards, setIsFullyLoaded]);

  // ✅ Usar cachedCards si existen, sino allCardsData
  const cards = cachedCards.length > 0 ? cachedCards : allCardsData ?? [];

  const queryClient = useQueryClient();

  const refetchCards = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["cards"] });
  }, [queryClient]);

  const { data: setsDropdown = [], isLoading: setsLoading } =
    useSetsDropdownQuery();

  const { data: sets = [] } = useSetsQuery();

  // 🚀 Mutations with optimistic updates
  const updateCardMutation = useUpdateCardMutation();
  const deleteCardMutation = useDeleteCardMutation();

  // 🚀 Hybrid sync system for compatibility with other pages
  const { syncForceRefresh, optimisticUpdate } = useHybridCardSync();

  // Estados principales que se mantienen igual
  const [selectedCard, setSelectedCard] = useState<
    CardWithCollectionData | undefined
  >(undefined);

  // Estados para alternas
  const [alternates, setAlternates] = useState<AlternateCard[]>([]);

  // Sistema de loading consolidado y más limpio
  const [globalLoading, setGlobalLoading] = useState<{
    type: "none" | "reordering" | "deleting" | "refreshing" | "saving";
    message?: string;
    affectedIds?: string[];
  }>({ type: "none" });

  // 🚀 SPEED OPTIMIZATION: Simple loading logic (like DeckBuilderLayout)
  const isInitialLoading = !cards || cards.length === 0;
  const isMutating =
    updateCardMutation.isPending || deleteCardMutation.isPending;

  // Estados de modales
  const [showEditCardModal, setShowEditCardModal] = useState(false);
  const [showEditAlternateModal, setShowEditAlternateModal] = useState(false);
  const [editingAlternate, setEditingAlternate] =
    useState<AlternateCard | null>(null);
  const [cardModalLoading, setCardModalLoading] = useState(false);
  const [alternateModalLoading, setAlternateModalLoading] = useState(false);
  // Estados de clonado removidos - ahora todo va por EditAlternateModal
  const [isModalLarge, setIsModalLarge] = useState(false);
  const [selectedCardForImage, setSelectedCardForImage] =
    useState<AlternateCard | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    alternate: AlternateCard;
    index: number;
  } | null>(null);

  // Funciones helper para manejo de loading limpio
  const setLoadingState = useCallback(
    (
      type: "none" | "reordering" | "deleting" | "refreshing" | "saving",
      message?: string,
      affectedIds?: string[]
    ) => {
      setGlobalLoading({ type, message, affectedIds });
    },
    []
  );

  const clearLoadingState = useCallback(() => {
    setGlobalLoading({ type: "none" });
  }, []);

  const isCardLoading = useCallback(
    (cardId: string) => {
      return globalLoading.affectedIds?.includes(cardId) || false;
    },
    [globalLoading.affectedIds]
  );

  const isAnyOperationInProgress = useCallback(() => {
    return globalLoading.type !== "none";
  }, [globalLoading.type]);

  // Función helper para normalizar automáticamente el orden secuencial
  const normalizeAlternatesOrder = useCallback(
    (alternatesList: AlternateCard[]): AlternateCard[] => {
      return alternatesList
        .sort((a, b) => {
          // Mantener el orden actual lo más posible, pero corrigiendo inconsistencias
          const orderA = parseInt(a.order || "0") || 0;
          const orderB = parseInt(b.order || "0") || 0;
          return orderA - orderB;
        })
        .map((alt, index) => ({
          ...alt,
          order: (index + 1).toString(), // Siempre secuencial: 1, 2, 3, 4...
        }));
    },
    []
  );

  // Función de utilidad para calcular el siguiente orden disponible
  const getNextOrder = useCallback(() => {
    return (alternates.length + 1).toString(); // Simplificado: siguiente en la secuencia
  }, [alternates]);

  // Estados del sidebar (igual que ProxiesBuilder)
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
  const [viewSelected, setViewSelected] = useState<
    "grid" | "list" | "alternate" | "text"
  >("list");
  const [visibleCount, setVisibleCount] = useState(50);
  const [mobileView, setMobileView] = useState<"cards" | "deck">("cards");

  // Estado para controlar el modal de filtros
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);

  // 🚀 Hybrid refresh function for backward compatibility (EditAlternateModal + other pages)
  const refreshData = useCallback(async () => {
    await syncForceRefresh(); // 🚀 This syncs both TanStack Query + Zustand
  }, [syncForceRefresh]);

  // Helper para búsqueda de código de carta (igual que ProxiesBuilder)
  const matchesCardCode = useCallback((code: string, search: string) => {
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
  }, []);

  // Filtrado de cartas (igual que ProxiesBuilder)
  const filteredCards = useMemo(() => {
    if (!cards || cards.length === 0) return [];

    return cards
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

        const matchesSets =
          selectedSets?.length === 0 ||
          selectedSets.includes(card.setCode) ||
          (card.alternates ?? []).some((alt) =>
            selectedSets.includes(alt.setCode)
          );

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
          );

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
          selectedCodes?.length === 0 || selectedCodes.includes(card.setCode);

        return (
          matchesSearch &&
          matchesColors &&
          matchesSets &&
          matchesTypes &&
          matchesEffects &&
          matchesRarity &&
          matchesAltArts &&
          matchesCosts &&
          matchesPower &&
          matchesCategories &&
          matchesAttributes &&
          matchesCounter &&
          matchedTrigger &&
          matchedCode
        );
      })
      .sort((a, b) => {
        // Aplicar orden estándar de colección (OP → EB → ST → P → otros)
        return sortByCollectionOrder(a, b);
      });
  }, [
    cards,
    search,
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
    matchesCardCode,
  ]);

  const visibleCards = useMemo(
    () => filteredCards.slice(0, visibleCount),
    [filteredCards, visibleCount]
  );

  // Función para contar filtros activos (igual que ProxiesBuilder)
  const totalFilters = useMemo(() => {
    return (
      selectedColors.length +
      selectedSets.length +
      selectedCodes.length +
      selectedRarities.length +
      selectedCategories.length +
      (selectedCounter !== "" ? 1 : 0) +
      (selectedTrigger !== "" ? 1 : 0) +
      selectedEffects.length +
      selectedTypes.length +
      selectedCosts.length +
      selectedPower.length +
      selectedAttributes.length +
      selectedAltArts.length
    );
  }, [
    selectedColors,
    selectedSets,
    selectedCodes,
    selectedRarities,
    selectedCategories,
    selectedCounter,
    selectedTrigger,
    selectedEffects,
    selectedTypes,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedAltArts,
  ]);

  // Función para limpiar filtros (igual que ProxiesBuilder)
  const clearFilters = () => {
    setSelectedColors([]);
    setSelectedSets([]);
    setSelectedCodes([]);
    setSelectedRarities([]);
    setSelectedCategories([]);
    setSelectedCounter("");
    setSelectedTrigger("");
    setSelectedEffects([]);
    setSelectedTypes([]);
    setSelectedCosts([]);
    setSelectedPower([]);
    setSelectedAttributes([]);
    setSelectedAltArts([]);
    setSearch("");
  };

  // ✅ Cards ya se cargan automáticamente con TanStack Query

  // Infinite scroll usando scroll event (igual que ProxiesBuilder)
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

  // Reset count cuando cambian filtros
  useEffect(() => {
    setVisibleCount(50);
  }, [selectedSets, selectedRarities, search]);

  // Handlers para cartas
  const handleSelectCard = useCallback((card: CardWithCollectionData) => {
    setSelectedCard(card);

    // Procesar alternas y asegurar orden consistente
    if (card.alternates && card.alternates.length > 0) {
      const processedAlternates = card.alternates
        .map((alt) => ({
          ...alt,
          id: alt.id?.toString() || "",
        }))
        .sort((a, b) => {
          const orderA = parseInt((a as any).order || "0") || 0;
          const orderB = parseInt((b as any).order || "0") || 0;
          return orderA - orderB;
        })
        .map((alt, index) => ({
          ...alt,
          order: (index + 1).toString(),
        }));
      setAlternates(processedAlternates);
    } else {
      setAlternates([]);
    }

    // Limpiar selección de alterna
    setEditingAlternate(null);
    setShowEditAlternateModal(false);
    setMobileView("deck");
  }, []);

  // Handlers para editar carta principal
  const handleEditCard = () => {
    if (selectedCard) {
      setShowEditCardModal(true);
    }
  };

  // Handler para clonar alterna específica (usar modal de edición de alterna)
  const handleCloneAlternate = useCallback(
    (alternate: AlternateCard) => {
      if (!selectedCard) return;

      // Crear copia temporal de la alterna específica con datos modificados para clonado
      const tempId = `temp-${Date.now()}-clone`;
      const clonedAlternate: AlternateCard = {
        ...selectedCard, // Base de la carta principal
        // Datos específicos de alterna clonada
        id: tempId, // ID temporal único
        src: alternate.src, // Usar imagen de la alterna
        alias: `${alternate.alias || selectedCard.name}_copia`, // Alias modificado
        tcgUrl: alternate.tcgUrl,
        alternateArt: alternate.alternateArt,
        isPro: alternate.isPro,
        region: alternate.region,
        isFirstEdition: false, // CRÍTICO: Las alternas siempre son false
        order: getNextOrder(), // Orden siguiente disponible
        // El código se mantendrá automáticamente del selectedCard por el spread operator
        // Mantener sets de la alterna si existen
        sets:
          alternate.sets && alternate.sets.length > 0
            ? alternate.sets
            : selectedCard.sets || [],
        // Mantener el setCode de la alterna si existe
        setCode: alternate.setCode || "",
      };

      // 🚀 OPTIMISTIC UPDATE: Agregar la alterna clonada inmediatamente al estado
      setAlternates((prev) => [...prev, clonedAlternate]);

      // Usar modal específico de edición de alternas
      setEditingAlternate(clonedAlternate);
      setShowEditAlternateModal(true);
    },
    [selectedCard, getNextOrder]
  );

  // 🚀 Save Card with TanStack Query optimistic updates
  const handleSaveCard = async (
    updatedCard: Partial<CardWithCollectionData>
  ) => {
    if (!selectedCard) return;

    setCardModalLoading(true);

    try {
      // 🔧 FIXED: Only send the modified fields + ID, not the entire card
      const cardUpdateData = {
        id: selectedCard.id,
        ...updatedCard, // Only the fields that were actually modified
      } as CardWithCollectionData;

      console.log("🔍 Sending to API (only modified fields):", cardUpdateData);

      const updatedCardData = await updateCardMutation.mutateAsync(
        cardUpdateData
      );

      // Update selected card to reflect changes
      setSelectedCard(updatedCardData);
      setShowEditCardModal(false);

      // Success toast is handled by the mutation
    } catch (error) {
      console.error("Error al guardar carta:", error);
      // Error toast is handled by the mutation
    } finally {
      setCardModalLoading(false);
    }
  };

  // Handlers para alternas
  const handleEditAlternate = useCallback((alternate: AlternateCard) => {
    setEditingAlternate(alternate);
    setShowEditAlternateModal(true);
  }, []);

  const handleSaveAlternate = async (updatedAlternate: AlternateCard) => {
    if (!selectedCard) return;

    // CRÍTICO: Para alternas temporales, necesitamos buscar por el ID temporal,
    // no por el ID real que viene del servidor
    const alternateId = editingAlternate?.id || updatedAlternate.id;

    // Validar que el ID sea válido
    if (!alternateId) {
      showErrorToast("Error: ID de alterna no válido");
      return;
    }

    const isTempAlternate =
      typeof alternateId === "string" && alternateId.startsWith("temp-");

    setAlternateModalLoading(true);

    try {
      if (isTempAlternate) {
        // Es una alterna temporal que se está convirtiendo en permanente
        // La creación en BD ya se hizo en EditAlternateModal, solo actualizar localmente

        // Ahora manejado por el nuevo sistema de loading global

        showSuccessToast("Nueva alterna creada correctamente");

        // Para alternas temporales, actualizar inmediatamente con los datos reales

        // 🚀 OPTIMISTIC UPDATE: Reemplazar la alterna temporal con datos reales
        setAlternates((prev) => {
          const newAlternates = prev.map((alt) => {
            if (alt.id === alternateId) {
              // Reemplazar completamente la temporal con los datos reales
              const replacedAlternate = {
                ...updatedAlternate,
                id: updatedAlternate.id.toString(), // Asegurar que el ID sea string
                sets: updatedAlternate.sets || [],
              };
              console.log(
                `✨ Replaced temporary alternate ${alternateId} with real ID: ${updatedAlternate.id}`
              );
              return replacedAlternate;
            }
            return alt;
          });
          return newAlternates;
        });

        // 🚀 TANSTACK QUERY OPTIMISTIC UPDATE: Add the new alternate to cache
        if (updatedAlternate.id && updatedAlternate.id !== alternateId) {
          optimisticUpdate.addCard({
            ...selectedCard,
            alternates: alternates.map((alt) =>
              alt.id === alternateId
                ? { ...updatedAlternate, id: updatedAlternate.id.toString() }
                : alt
            ),
          });
        }

        // El estado de loading se maneja globalmente ahora
      } else {
        // Es una alterna existente, actualizar en BD

        // Actualización optimista
        setAlternates((prev) =>
          prev.map((alt) => (alt.id === alternateId ? updatedAlternate : alt))
        );

        // Solo enviar los campos que realmente se están editando
        const formattedData = {
          src: updatedAlternate.src,
          alias: updatedAlternate.alias,
          tcgUrl: updatedAlternate.tcgUrl,
          alternateArt: updatedAlternate.alternateArt,
          order: updatedAlternate.order,
          isPro: updatedAlternate.isPro,
          region: updatedAlternate.region,
          setIds: updatedAlternate.sets?.map((s) => s.set.id) || [],
          setCode: updatedAlternate.setCode || "",
        };

        const response = await fetch(`/api/admin/cards/${alternateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formattedData),
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const updatedAlternateData = await response.json();

        // 🚀 OPTIMISTIC UPDATE: Actualizar con datos del servidor
        setAlternates((prev) =>
          prev.map((alt) =>
            alt.id === alternateId
              ? {
                  ...updatedAlternateData,
                  id: alt.id,
                  sets: updatedAlternateData.sets || [],
                }
              : alt
          )
        );

        // 🚀 TANSTACK QUERY OPTIMISTIC UPDATE: Update the card in cache
        optimisticUpdate.updateCard({
          ...selectedCard,
          alternates: alternates.map((alt) =>
            alt.id === alternateId
              ? {
                  ...updatedAlternateData,
                  id: alt.id,
                  sets: updatedAlternateData.sets || [],
                }
              : alt
          ),
        });

        showSuccessToast("Alterna actualizada correctamente");
      }

      setShowEditAlternateModal(false);
      setEditingAlternate(null);

      // 🚀 Usar sistema híbrido para refrescar ambos sistemas
      await syncForceRefresh();
    } catch (error) {
      console.error("Error al guardar alterna:", error);

      if (isTempAlternate) {
        // 🚀 ROLLBACK: Remover alterna temporal que falló al guardarse
        setAlternates((prev) => prev.filter((alt) => alt.id !== alternateId));
        console.log(`🗑️ Removed failed temporary alternate: ${alternateId}`);
      } else {
        // 🚀 ROLLBACK: Revertir alternas existentes a su estado original
        const originalAlternate = alternates.find(
          (alt) => alt.id === alternateId
        );
        if (originalAlternate) {
          setAlternates((prev) =>
            prev.map((alt) =>
              alt.id === alternateId ? originalAlternate : alt
            )
          );
          console.log(`↩️ Reverted alternate ${alternateId} to original state`);
        }
      }

      // 🚀 Also trigger sync to ensure consistency
      await syncForceRefresh();

      showErrorToast(
        `Error al guardar: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    } finally {
      setAlternateModalLoading(false);
    }
  };

  // Funciones de drag and drop para reordenar alternas
  const handleDragStart = useCallback(
    (e: React.DragEvent, alternate: AlternateCard, index: number) => {
      setDraggedItem({ alternate, index });
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();

      if (!draggedItem || !selectedCard || isAnyOperationInProgress()) return;

      const { alternate: draggedAlternate, index: dragIndex } = draggedItem;

      if (dragIndex === dropIndex) return;

      // Crear nueva lista con el elemento reordenado
      const newAlternates = [...alternates];
      newAlternates.splice(dragIndex, 1);
      newAlternates.splice(dropIndex, 0, draggedAlternate);

      // Actualizar orden en cada alterna - asegurar que sea secuencial
      const updatedAlternates = newAlternates.map((alt, index) => ({
        ...alt,
        order: (index + 1).toString(),
      }));

      // Validar que no haya duplicados en el orden
      const orders = updatedAlternates.map((alt) => alt.order);
      const uniqueOrders = new Set(orders);
      if (orders.length !== uniqueOrders.size) {
        console.error("Error: Ordenes duplicados detectados", orders);
        showErrorToast("Error: Se detectaron posiciones duplicadas");
        return;
      }

      // Bloquear nuevas operaciones con feedback específico
      setLoadingState(
        "reordering",
        "Reordenando cartas...",
        updatedAlternates.map((alt) => alt.id)
      );

      // Actualización optimista
      setAlternates(updatedAlternates);

      try {
        // ⚡ OPTIMIZACIÓN: Una sola petición batch para todas las cartas
        const reorderData = updatedAlternates.map((alt, index) => ({
          id: alt.id,
          order: (index + 1).toString(),
        }));

        const response = await fetch("/api/admin/cards/batch-reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reorderData }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Error desconocido" }));
          throw new Error(
            errorData.error ||
              `Error ${response.status}: ${response.statusText}`
          );
        }

        const result = await response.json();
        console.log("✅ Batch reorder exitoso:", result.summary);

        showSuccessToast(
          `"${draggedAlternate.alias || "Alterna"}" movida a la posición ${
            dropIndex + 1
          }. Orden actualizado para todas las cartas.`
        );
      } catch (error) {
        console.error("Error al actualizar orden:", error);

        // Rollback en caso de error
        setAlternates(alternates);
        showErrorToast("Error al actualizar el orden. Cambios revertidos.");
      } finally {
        // Limpiar estado de loading
        clearLoadingState();
        setDraggedItem(null);
      }
    },
    [
      draggedItem,
      selectedCard,
      alternates,
      isAnyOperationInProgress,
      setLoadingState,
      clearLoadingState,
    ]
  );

  const handleCancelAlternate = useCallback(() => {
    // 🚀 OPTIMISTIC CLEANUP: Remover específicamente la alterna temporal que se está cancelando
    if (
      editingAlternate &&
      typeof editingAlternate.id === "string" &&
      editingAlternate.id.startsWith("temp-")
    ) {
      setAlternates((prev) =>
        prev.filter((alt) => alt.id !== editingAlternate.id)
      );
      console.log(`🗑️ Removed temporary alternate: ${editingAlternate.id}`);
    }

    // Limpiar estado de edición
    setEditingAlternate(null);
    setShowEditAlternateModal(false);
  }, [editingAlternate]);

  const handleDeleteAlternate = useCallback(
    async (alternateId: string) => {
      if (!confirm("¿Estás seguro de que quieres eliminar esta alterna?"))
        return;

      // Establecer loading solo para la carta específica
      setLoadingState("deleting", "Eliminando alterna...", [alternateId]);

      // Actualización optimista con normalización automática
      const originalAlternates = [...alternates];
      const filteredAlternates = alternates.filter(
        (alt) => alt.id !== alternateId
      );
      const normalizedAlternates = normalizeAlternatesOrder(filteredAlternates);
      setAlternates(normalizedAlternates);

      try {
        const response = await fetch(`/api/admin/cards/${alternateId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        // ⚡ OPTIMIZACIÓN: Actualizar orden en lote para las alternates restantes
        if (normalizedAlternates.length > 0) {
          const reorderData = normalizedAlternates.map((alt, index) => ({
            id: alt.id,
            order: (index + 1).toString(),
          }));

          const reorderResponse = await fetch(
            "/api/admin/cards/batch-reorder",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reorderData }),
            }
          );

          if (!reorderResponse.ok) {
            console.warn(
              "⚠️ Error al reordenar después de eliminar, pero eliminación exitosa"
            );
          }
        }

        showSuccessToast(
          "Alterna eliminada y orden actualizado automáticamente"
        );

        // Cerrar modal si era la alterna que se estaba editando
        if (editingAlternate?.id === alternateId) {
          setEditingAlternate(null);
          setShowEditAlternateModal(false);
        }

        // Refrescar lista principal
        await queryClient.invalidateQueries({ queryKey: ["cards"] });

        // 🚀 Forzar actualización del store de cartas para add-cards
        queryClient.invalidateQueries({ queryKey: ["cards"] });
      } catch (error) {
        console.error("Error al eliminar alterna:", error);

        // Rollback
        setAlternates(originalAlternates);
        showErrorToast(
          `Error al eliminar: ${
            error instanceof Error ? error.message : "Error desconocido"
          }`
        );
      } finally {
        clearLoadingState();
      }
    },
    [
      alternates,
      editingAlternate,
      refetchCards,
      queryClient,
      normalizeAlternatesOrder,
      setLoadingState,
      clearLoadingState,
    ]
  );

  const handleAddAlternate = useCallback(() => {
    if (!selectedCard) return;

    // Calcular el siguiente orden basándose en la última alterna existente
    const nextOrder = getNextOrder();

    // Crear alterna temporal localmente (sin guardar en BD)
    const tempId = `temp-${Date.now()}`;
    const tempAlternate: AlternateCard = {
      ...selectedCard, // Campos base de la carta
      id: tempId, // ID temporal único (sobrescribe el ID original)
      src: "https://oharatcg-21eab.kxcdn.com/images/backcard.webp", // Sobrescribe la imagen
      sets: [], // Sobrescribe los sets
      alias: `Alterna ${alternates.length + 1}`, // Sobrescribe el alias
      tcgUrl: "",
      alternateArt: null,
      order: nextOrder,
      isPro: false,
      region: "",
      isFirstEdition: false, // CRÍTICO: Las alternas nunca son first edition
      setCode: "", // Inicialmente vacío, se llenará cuando se seleccione un set
    };

    // Agregar a la lista local temporalmente
    setAlternates((prev) => {
      const updatedAlternates = [...prev, tempAlternate];

      // Verificar si el orden es consistente, si no, reordenar
      const orders = updatedAlternates.map(
        (alt) => parseInt(alt.order || "0") || 0
      );
      const hasInconsistencies = orders.some(
        (order, index) => order !== index + 1
      );

      if (hasInconsistencies) {
        // Reordenar para mantener consistencia
        return updatedAlternates
          .sort((a, b) => {
            const orderA = parseInt(a.order || "0") || 0;
            const orderB = parseInt(b.order || "0") || 0;
            return orderA - orderB;
          })
          .map((alt, index) => ({
            ...alt,
            order: (index + 1).toString(),
          }));
      }

      return updatedAlternates;
    });

    //showSuccessToast(`Alterna temporal creada con orden ${nextOrder}`);

    // Abrir modal para edición inmediata
    handleEditAlternate(tempAlternate);
  }, [selectedCard, alternates, getNextOrder, handleEditAlternate]);

  const refreshAlternates = useCallback(async () => {
    if (!selectedCard) return;

    setLoadingState("refreshing", "Refrescando alternas...");

    try {
      const response = await fetch(
        `/api/admin/cards/${selectedCard.id}?includeAlternates=true`
      );
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const { alternates: serverAlternates } = data;

      if (serverAlternates && serverAlternates.length > 0) {
        const processedAlternates = serverAlternates.map((alt: any) => ({
          ...alt,
          id: alt.id?.toString() || "",
          sets: alt.sets || [],
        }));

        // Aplicar normalización automática
        const normalizedAlternates =
          normalizeAlternatesOrder(processedAlternates);

        // Reemplazar completamente con las alternas del servidor
        setAlternates(normalizedAlternates);

        showSuccessToast(
          "Alternas refrescadas y orden normalizado automáticamente"
        );
      } else {
        // Si no hay alternas en el servidor, limpiar completamente
        // Esto elimina tanto las permanentes como las temporales
        setAlternates([]);
        showSuccessToast("No hay alternas para esta carta");
      }

      await syncForceRefresh();
    } catch (error) {
      console.error("❌ Error al refrescar alternas:", error);
      showErrorToast(
        `Error al refrescar: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    } finally {
      clearLoadingState();
    }
  }, [selectedCard, syncForceRefresh, setLoadingState, clearLoadingState]);

  return (
    <>
      <style jsx global>{`
        .bg-blue-25 {
          background-color: #eff6ff;
        }
        .border-blue-300 {
          border-color: #93c5fd;
        }
        .cursor-move:hover {
          cursor: grab;
        }
        .cursor-move:active {
          cursor: grabbing;
        }

        /* Gradiente radial personalizado para overlays */
        .bg-gradient-radial {
          background: radial-gradient(
            circle at center,
            var(--tw-gradient-stops)
          );
        }

        /* Efectos de hover mejorados para cards */
        .card-hover-effect {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .card-hover-effect:hover {
          transform: translateY(-4px) scale(1.02);
        }

        /* Glassmorphism para overlays */
        .glass-effect {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        /* Grid responsive para alternates con tamaño FIJO - más cartas, no más grandes */
        .grid-alternates-responsive {
          /* En móviles pequeños: tamaño fijo 180px - alineado a la izquierda */
          @media (max-width: 640px) {
            grid-template-columns: repeat(auto-fill, 180px) !important;
            justify-content: start !important;
          }

          /* En tablets: tamaño fijo 200px - alineado a la izquierda */
          @media (min-width: 641px) and (max-width: 1024px) {
            grid-template-columns: repeat(auto-fill, 200px) !important;
            justify-content: start !important;
          }

          /* En pantallas grandes: tamaño fijo 220px - alineado a la izquierda */
          @media (min-width: 1025px) {
            grid-template-columns: repeat(auto-fill, 220px) !important;
            justify-content: start !important;
          }

          /* En pantallas ultra anchas: mismo tamaño fijo 220px, más columnas - alineado a la izquierda */
          @media (min-width: 1920px) {
            grid-template-columns: repeat(auto-fill, 220px) !important;
            justify-content: start !important;
          }

          /* 🚀 BEAUTIFUL ANIMATIONS FOR ALTERNATES */
          .alternate-card-glow {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06),
              0 0 20px -5px rgba(59, 130, 246, 0.15); /* Blue glow */
          }

          .alternate-card-shimmer {
            position: relative;
            overflow: hidden;
          }

          .alternate-card-shimmer::before {
            content: "";
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(
              45deg,
              transparent 30%,
              rgba(255, 255, 255, 0.5) 50%,
              transparent 70%
            );
            transform: translateX(-100%) translateY(-100%) rotate(45deg);
            transition: transform 0.6s ease-in-out;
          }

          .alternate-card-shimmer:hover::before {
            transform: translateX(100%) translateY(100%) rotate(45deg);
          }

          /* Smooth perspective for 3D effects */
          .alternate-perspective {
            transform-style: preserve-3d;
            perspective: 1000px;
          }

          /* Loading pulse effect for new cards */
          @keyframes alternateCardEntrance {
            0% {
              opacity: 0;
              transform: scale(0.8) translateY(20px) rotateX(-15deg);
            }
            50% {
              opacity: 0.8;
              transform: scale(1.05) translateY(-5px) rotateX(0deg);
            }
            100% {
              opacity: 1;
              transform: scale(1) translateY(0px) rotateX(0deg);
            }
          }

          /* Magical sparkle effect */
          .alternate-sparkle {
            position: relative;
          }

          .alternate-sparkle::after {
            content: "✨";
            position: absolute;
            top: 8px;
            right: 8px;
            font-size: 12px;
            opacity: 0;
            animation: sparkle 2s ease-in-out infinite;
            pointer-events: none;
          }

          @keyframes sparkle {
            0%,
            100% {
              opacity: 0;
              transform: scale(0.5) rotate(0deg);
            }
            50% {
              opacity: 1;
              transform: scale(1) rotate(180deg);
            }
          }

          /* 🚀 Special gradient border for temporary/new cloned cards */
          .alternate-temp-glow {
            position: relative;
            background: linear-gradient(
              45deg,
              #34d399,
              #3b82f6,
              #8b5cf6,
              #f59e0b
            );
            background-size: 400% 400%;
            animation: gradientShift 3s ease infinite;
            padding: 2px;
            border-radius: 14px; /* Slightly larger to show gradient border */
          }

          .alternate-temp-glow .alternate-temp-inner {
            background: white;
            border-radius: 12px;
            width: 100%;
            height: 100%;
          }

          @keyframes gradientShift {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }

          /* Pulse effect for new cards */
          .alternate-new-pulse {
            animation: newCardPulse 2s ease-in-out;
          }

          @keyframes newCardPulse {
            0%,
            100% {
              box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
            }
            50% {
              box-shadow: 0 0 20px 10px rgba(34, 197, 94, 0);
            }
          }
        }
      `}</style>
      <TooltipProvider>
        {/* 🚀 Error handling for TanStack Query */}
        {cardsError && (
          <div className="flex items-center justify-center h-screen bg-gray-50">
            <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
              <h3 className="text-lg font-medium text-red-600 mb-2">
                Error Loading Cards
              </h3>
              <p className="text-gray-600 mb-4">{cardsError.message}</p>
              <Button
                onClick={() => refetchCards()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* 🚀 Intelligent Skeleton for initial loading */}
        {isInitialLoading && <EditCardSkeleton />}

        {/* Main app UI - only shown when data is loaded */}
        {!cardsError && !isInitialLoading && (
          <div className="flex flex-1 bg-[#f2eede] w-full h-full overflow-hidden">
            {/* Sidebar con lista de cartas */}
            <div
              className={`bg-white ${
                mobileView === "cards" ? "flex" : "hidden md:flex"
              } w-full md:w-[300px] lg:w-[400px] xl:w-[450px] flex-shrink-0 border-r border-slate-200 min-h-0 flex-col`}
            >
              {/* Controles de búsqueda y filtros */}
              <div className="flex p-3 flex-col gap-3 border-b border-[#f5f5f5]">
                <DropdownSearch
                  search={search}
                  setSearch={setSearch}
                  placeholder="Buscar cartas..."
                />

                {/* Filtros rápidos */}
                <div className="flex flex-col gap-2">
                  <MultiSelect
                    options={setOptions}
                    selected={selectedSets}
                    setSelected={setSelectedSets}
                    displaySelectedAs={(selected) =>
                      selected.length === 1
                        ? setOptions.find((s) => s.value === selected[0])
                            ?.label || selected[0]
                        : `Sets (${selected.length})`
                    }
                    searchPlaceholder="Buscar sets..."
                    isSolid={false}
                    isSearchable={true}
                    isFullWidth={true}
                  />
                </div>

                <div className="flex justify-between items-center gap-2">
                  <div className="flex gap-2 justify-center items-center">
                    <button
                      type="button"
                      onClick={() => setIsFiltersModalOpen(true)}
                      className={`
                  ${
                    totalFilters > 0
                      ? "bg-[#2463eb] !text-white"
                      : "bg-gray-100 !text-black"
                  }
                  px-4 py-2 text-black font-bold border rounded-lg
                `}
                    >
                      Filtros
                      {totalFilters > 0 && (
                        <Badge className="ml-2 !bg-white !text-[#2463eb] font-bold">
                          {totalFilters}
                        </Badge>
                      )}
                    </button>
                    {totalFilters > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="px-2"
                      >
                        Limpiar
                      </Button>
                    )}
                  </div>

                  <div className="flex justify-center items-center gap-2">
                    <ViewSwitch
                      viewSelected={viewSelected}
                      setViewSelected={setViewSelected}
                      isAlternate={false}
                    />
                  </div>
                </div>
              </div>

              {/* Lista de cartas */}
              <div
                className="p-3 pb-20 md:pb-3 overflow-y-auto flex-1 min-h-0"
                ref={gridRef}
              >
                <div className="text-sm text-gray-600 mb-3">
                  {filteredCards.length} cartas encontradas
                </div>

                {viewSelected === "list" && (
                  <div className="grid gap-3 grid-cols-3 justify-items-center">
                    {visibleCards.map((card) => (
                      <div
                        key={card.id}
                        onClick={() => handleSelectCard(card)}
                        className={`w-full cursor-pointer transition-all duration-200 rounded-lg border ${
                          selectedCard?.id === card.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative">
                          <LazyImage
                            src={card.src}
                            fallbackSrc="/assets/images/backcard.webp"
                            alt={card.name}
                            className="w-full"
                            size="small"
                            customOptions={{
                              width: 300,
                              height: 420,
                              quality: 75,
                              format: "webp",
                              fit: "contain",
                              position: "center",
                              enlarge: 0,
                              progressive: 1,
                            }}
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex justify-center items-center w-full flex-col p-1">
                                <span
                                  className={`${oswald.className} text-[13px] font-[500] mt-1`}
                                >
                                  {card.code}
                                </span>
                                <span className="text-center text-[11px] line-clamp-1 text-gray-600">
                                  {card.sets?.[0]?.set?.title}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{card.name}</p>
                              <p className="text-sm">
                                {card.sets?.[0]?.set?.title}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {viewSelected === "text" && (
                  <div className="flex flex-col gap-2">
                    {visibleCards.map((card) => (
                      <div
                        key={card.id}
                        onClick={() => handleSelectCard(card)}
                        className={`cursor-pointer p-3 rounded-lg border transition-all duration-200 ${
                          selectedCard?.id === card.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-16 flex-shrink-0">
                            <LazyImage
                              src={card.src}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={card.name}
                              className="w-full h-full object-cover rounded"
                              size="thumb"
                              customOptions={{
                                width: 48,
                                height: 64,
                                quality: 70,
                                format: "webp",
                                fit: "cover",
                                position: "center",
                                enlarge: 0,
                                progressive: 1,
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm line-clamp-1">
                              {card.name}
                            </h3>
                            <p
                              className={`${oswald.className} text-xs text-gray-600`}
                            >
                              {card.code}
                            </p>
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {card.sets?.[0]?.set?.title}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Botón de fallback para cargar más */}
                {visibleCount < filteredCards.length && (
                  <div className="flex justify-center mt-4">
                    <Button
                      onClick={() => setVisibleCount((prev) => prev + 50)}
                      variant="outline"
                      size="sm"
                    >
                      Cargar más cartas ({filteredCards.length - visibleCount}{" "}
                      restantes)
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Área principal */}
            <div
              className={`${
                mobileView === "deck" ? "flex" : "hidden md:flex"
              } flex-1 flex-col`}
            >
              {selectedCard ? (
                <>
                  {/* Header de la carta seleccionada */}
                  <div className="bg-white border-b border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMobileView("cards")}
                          className="md:hidden"
                        >
                          ← Volver
                        </Button>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-16 h-20 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden rounded border border-gray-300"
                            onClick={() => {
                              // Convertir selectedCard a formato compatible con el modal
                              const cardForModal = {
                                id: selectedCard.id?.toString() || "",
                                src: selectedCard.src || "",
                                sets: selectedCard.sets || [],
                                alias: selectedCard.name || "Carta Principal",
                                order: "0", // Carta principal tiene orden 0
                              };
                              setSelectedCardForImage(cardForModal);
                              setIsModalLarge(true);
                            }}
                          >
                            <LazyImage
                              src={selectedCard.src}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={selectedCard.name}
                              className="w-full h-full object-cover"
                              size="thumb"
                              customOptions={{
                                width: 64,
                                height: 80,
                                quality: 70,
                                format: "webp",
                                fit: "cover",
                                position: "center",
                                enlarge: 0,
                                progressive: 1,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <h1 className="text-xl font-bold">
                            {selectedCard.name}
                          </h1>
                          <div className="flex gap-2 text-sm text-gray-600">
                            <span className={oswald.className}>
                              ({selectedCard.code})
                            </span>
                            <span>•</span>
                            <span>{selectedCard.rarity}</span>
                            <span>•</span>
                            <span>{alternates.length} alternas</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Indicador global de operación */}
                        {isAnyOperationInProgress() && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-sm font-medium text-blue-700">
                              {globalLoading.message || "Procesando..."}
                            </span>
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleEditCard}
                          disabled={!selectedCard || isAnyOperationInProgress()}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar Carta
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refreshAlternates}
                          disabled={!selectedCard || isAnyOperationInProgress()}
                          className={
                            globalLoading.type === "refreshing"
                              ? "animate-pulse"
                              : ""
                          }
                        >
                          <RefreshCcw
                            className={`h-4 w-4 mr-1 ${
                              globalLoading.type === "refreshing"
                                ? "animate-spin"
                                : ""
                            }`}
                          />
                          Refrescar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddAlternate}
                          disabled={isAnyOperationInProgress()}
                          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={`Crear nueva alterna temporal con orden ${getNextOrder()}`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Nueva Altern
                          {alternates.length > 0 && (
                            <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded">
                              #{getNextOrder()}
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Grid de alternas */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 bg-gradient-to-b from-transparent via-white/5 to-transparent">
                    {alternates.length > 0 ? (
                      <div
                        className="gap-3 grid-alternates-responsive"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, 220px)",
                          justifyContent: "start",
                          width: "100%",
                        }}
                      >
                        {alternates.map((alternate, index) => (
                          <div
                            key={alternate.id}
                            className={`relative group overflow-hidden alternate-card-shimmer alternate-perspective animate-fade-in hover:scale-[1.02] hover:-translate-y-2 active:scale-[0.98] transition-all duration-300 ${
                              alternate.id.toString().startsWith("temp-")
                                ? "alternate-sparkle alternate-temp-glow alternate-new-pulse"
                                : "bg-white rounded-xl border"
                            } ${
                              isAnyOperationInProgress()
                                ? "cursor-not-allowed opacity-75"
                                : "cursor-move"
                            } ${
                              draggedItem?.index === index
                                ? "border-blue-400 shadow-xl ring-2 ring-blue-200/50 bg-blue-50/50"
                                : alternate.id.toString().startsWith("temp-")
                                ? "" // No additional styles for temp cards as they have gradient border
                                : "border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-xl hover:alternate-card-glow"
                            }`}
                            draggable={!isAnyOperationInProgress()}
                            onDragStart={(e) =>
                              handleDragStart(
                                e as unknown as React.DragEvent,
                                alternate,
                                index
                              )
                            }
                            onDragOver={(e) => handleDragOver(e)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnter={(e) => {
                              if (draggedItem && draggedItem.index !== index) {
                                e.currentTarget.classList.add(
                                  "border-dashed",
                                  "border-blue-400",
                                  "bg-blue-25",
                                  "ring-2",
                                  "ring-blue-200"
                                );
                              }
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove(
                                "border-dashed",
                                "border-blue-400",
                                "bg-blue-25",
                                "ring-2",
                                "ring-blue-200"
                              );
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                            }}
                            style={{
                              animationDelay: `${index * 80}ms`,
                            }}
                          >
                            {/* 🚀 Special wrapper for temporary cards with gradient border */}
                            <div
                              className={
                                alternate.id.toString().startsWith("temp-")
                                  ? "alternate-temp-inner relative"
                                  : "relative"
                              }
                            >
                              {/* Indicador de loading sutil - solo para carta específica */}
                              {isCardLoading(alternate.id) && (
                                <div className="absolute top-2 right-2 z-10">
                                  <div className="flex items-center gap-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full border border-blue-200 shadow-sm">
                                    <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                    <span className="text-xs font-medium text-blue-700">
                                      {globalLoading.type === "deleting"
                                        ? "Eliminando"
                                        : globalLoading.type === "reordering"
                                        ? "Reordenando"
                                        : "Cargando"}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Imagen principal - tamaño fijo y consistente */}
                              <div
                                className="relative aspect-[2.5/3.5] bg-gray-50 overflow-hidden"
                                onClick={(e) => {
                                  console.log("clicked");
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log("clicked1");
                                  setSelectedCardForImage(alternate);
                                  setIsModalLarge(true);
                                }}
                              >
                                <LazyImage
                                  src={alternate.src}
                                  fallbackSrc="/assets/images/backcard.webp"
                                  alt={
                                    alternate.alias || `Alterna ${alternate.id}`
                                  }
                                  className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                                  size="small"
                                  customOptions={{
                                    width: 300,
                                    height: 420,
                                    quality: 75,
                                    format: "webp",
                                    fit: "cover",
                                    position: "center",
                                    enlarge: 0,
                                    progressive: 1,
                                  }}
                                />

                                {/* Badge de orden en esquina superior izquierda */}
                                <div className="absolute top-2 left-2 z-20">
                                  <div
                                    className={`px-2 py-1 rounded-md text-xs font-bold shadow-md ${
                                      alternate.order &&
                                      parseInt(alternate.order) === index + 1
                                        ? "bg-emerald-500 text-white"
                                        : "bg-amber-500 text-white"
                                    }`}
                                  >
                                    #{alternate.order || index + 1}
                                    {alternate.order &&
                                      parseInt(alternate.order) !==
                                        index + 1 && (
                                        <span className="ml-1">⚠</span>
                                      )}
                                  </div>
                                </div>

                                {/* Badges de estado en esquina superior derecha */}
                                <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
                                  {alternate.isPro && (
                                    <Badge className="text-xs px-2 py-1 bg-purple-500 text-white shadow-md">
                                      PRO
                                    </Badge>
                                  )}
                                  {alternate.region && (
                                    <Badge className="text-xs px-2 py-1 bg-emerald-500 text-white shadow-md">
                                      {alternate.region}
                                    </Badge>
                                  )}
                                </div>

                                {/* Overlay con botones de acción */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditAlternate(alternate);
                                        }}
                                        disabled={isAnyOperationInProgress()}
                                        className="h-9 w-9 p-0 bg-white hover:bg-gray-50 text-emerald-600 rounded-full shadow-lg"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Editar alterna
                                    </TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Clonar la alterna específica
                                          handleCloneAlternate(alternate);
                                        }}
                                        disabled={
                                          isAnyOperationInProgress() ||
                                          !selectedCard
                                        }
                                        className="h-9 w-9 p-0 bg-white hover:bg-gray-50 text-blue-600 rounded-full shadow-lg"
                                      >
                                        <svg
                                          className="h-4 w-4"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <rect
                                            x="9"
                                            y="9"
                                            width="13"
                                            height="13"
                                            rx="2"
                                            ry="2"
                                          />
                                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Clonar como nueva alterna
                                    </TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteAlternate(alternate.id);
                                        }}
                                        disabled={isAnyOperationInProgress()}
                                        className="h-9 w-9 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Eliminar alterna
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>

                              {/* Información inferior */}
                              <div className="p-3 space-y-2">
                                {/* Título */}
                                {alternate.alias &&
                                  alternate.alias !== "" &&
                                  alternate.alias !== "0" && (
                                    <h4 className="font-semibold text-gray-900 text-sm truncate">
                                      {alternate.alias}
                                    </h4>
                                  )}

                                {/* Sets */}
                                <div className="flex items-center gap-1 flex-wrap">
                                  {alternate.sets &&
                                  alternate.sets.length > 0 ? (
                                    <>
                                      <Badge
                                        variant="outline"
                                        className="text-xs px-2 py-0.5 bg-slate-50 text-slate-700 border-slate-200"
                                      >
                                        {alternate.sets[0].set.title}
                                      </Badge>
                                      {alternate.sets.length > 1 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200"
                                        >
                                          +{alternate.sets.length - 1}
                                        </Badge>
                                      )}
                                    </>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-xs px-2 py-0.5 bg-red-50 text-red-700 border-red-200"
                                    >
                                      Sin set
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>{" "}
                            {/* Close special wrapper for temporary cards */}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-80 text-gray-500 p-8">
                        <div className="relative mb-6">
                          <div className="text-8xl opacity-80 animate-pulse">
                            🎨
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-b from-blue-400/10 to-purple-400/10 rounded-full blur-xl"></div>
                        </div>
                        <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-gray-700 to-gray-500 bg-clip-text text-transparent">
                          No hay alternates disponibles
                        </h3>
                        <p className="text-sm text-gray-400 mb-6 text-center max-w-md leading-relaxed">
                          Esta carta no tiene versiones alternas. Puedes crear
                          la primera alterna para expandir su colección.
                        </p>
                        <Button
                          onClick={handleAddAlternate}
                          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                        >
                          <Plus className="h-5 w-5 mr-2" />
                          Crear Primera Alterna
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-12">
                  <div className="text-center text-gray-500">
                    <div className="relative mb-8">
                      <div className="text-9xl opacity-70 animate-bounce">
                        🃏
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-b from-indigo-400/10 to-blue-400/10 rounded-full blur-2xl"></div>
                    </div>
                    <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-gray-600 to-gray-400 bg-clip-text text-transparent">
                      Selecciona una carta para comenzar
                    </h2>
                    <p className="text-gray-400 text-lg leading-relaxed max-w-md">
                      Elige una carta del panel izquierdo para ver, editar y
                      gestionar todas sus versiones alternas
                    </p>
                    <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-300">
                      <span>💡</span>
                      <span>
                        Usa los filtros para encontrar cartas específicas
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modales */}
            <EditCardModal
              isOpen={showEditCardModal}
              onClose={() => setShowEditCardModal(false)}
              card={selectedCard || null}
              onSave={handleSaveCard}
              loading={cardModalLoading}
            />

            <EditAlternateModal
              isOpen={showEditAlternateModal}
              onClose={() => {
                setShowEditAlternateModal(false);
                setEditingAlternate(null);
              }}
              alternate={editingAlternate}
              sets={sets as Set[]}
              setsDropdown={setsDropdown}
              onSave={handleSaveAlternate}
              loading={alternateModalLoading}
              onCancel={handleCancelAlternate}
            />

            {/* Modal de imagen grande */}
            {isModalLarge && (
              <div
                className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
                onClick={() => {
                  setIsModalLarge(false);
                }}
                onTouchEnd={() => {
                  setIsModalLarge(false);
                }}
              >
                <div className="w-full max-w-3xl">
                  <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
                    Tap to close
                  </div>
                  <div className="flex flex-col items-center gap-3 px-5 mb-3">
                    <img
                      key={selectedCardForImage?.id}
                      src={selectedCardForImage?.src}
                      className="max-w-full max-h-[calc(100dvh-130px)] object-contain"
                      alt=""
                    />
                    <div className="text-white text-lg font-[400] text-center px-5">
                      <span className={`${oswald.className} font-[500]`}>
                        {selectedCardForImage?.alias || "Alterna"}
                      </span>
                      <br />
                      <span>{selectedCardForImage?.sets[0]?.set?.title}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* End of conditional main app UI */}

        {/* 🚀 Subtle mutation loading indicator */}
        {isMutating && (
          <div className="fixed top-4 right-4 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg shadow-sm z-50 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Guardando cambios...</span>
          </div>
        )}

        {/* Modal de filtros (igual que ProxiesBuilder) */}
        <Transition
          show={isFiltersModalOpen}
          enter="transition transform duration-300"
          enterFrom="-translate-x-full"
          enterTo="translate-x-0"
          leave="transition transform duration-200"
          leaveFrom="translate-x-0"
          leaveTo="-translate-x-full"
        >
          <FiltersSidebar
            isOpen={isFiltersModalOpen}
            setIsOpen={setIsFiltersModalOpen}
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
      </TooltipProvider>
    </>
  );
};

export default EditCard;
