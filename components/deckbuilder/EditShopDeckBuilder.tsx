"use client";

import { useRouter } from "next/navigation";
import { useDeckBuilder } from "@/hooks/useDeckBuilder";
import DeckBuilderLayout from "@/components/deckbuilder/DeckBuilderLayout";
import { useAllCards } from "@/hooks/useCards";
import { useCardStore } from "@/store/cardStore";
import type { CardsFilters } from "@/lib/cards/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardWithCollectionData, DeckCard } from "@/types";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";
import { useUser } from "@/app/context/UserContext";

interface EditShopDeckBuilderProps {
  deckId: string;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const convertDeckCard = (deckCard: any): DeckCard => {
  const card = deckCard.card;
  return {
    cardId: card.id,
    id: deckCard.id,
    name: card.name,
    rarity: card.rarity ?? "",
    src: card.src,
    quantity: deckCard.quantity,
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
};

const EditShopDeckBuilder = ({ deckId }: EditShopDeckBuilderProps) => {
  const router = useRouter();
  const deckBuilder = useDeckBuilder();
  const {
    setDeckCards: setBuilderDeckCards,
    setSelectedLeader: setBuilderLeader,
  } = deckBuilder;
  const { role, loading } = useUser();

  const [deckName, setDeckName] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [shopUrl, setShopUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isLoadingDeck, setIsLoadingDeck] = useState(true);
  const [hasEditedSlug, setHasEditedSlug] = useState(false);

  const cachedCards = useCardStore((state) => state.allCards);
  const setAllCards = useCardStore((state) => state.setAllCards);
  const setIsFullyLoaded = useCardStore((state) => state.setIsFullyLoaded);
  const allCardsSignatureRef = useRef<string | null>(null);

  const fullQueryFilters = useMemo<CardsFilters>(() => ({}), []);

  const { data: allCardsData, isFetching: isFetchingAllCards } = useAllCards(
    fullQueryFilters,
    {
      includeRelations: true,
      includeAlternates: true,
      includeCounts: true,
    }
  );

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

  useEffect(() => {
    const fetchDeck = async () => {
      try {
        const res = await fetch(`/api/admin/shop-decks/${deckId}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "No se pudo cargar el deck");
        }
        const deck = await res.json();
        setDeckName(deck.name ?? "");
        setShopSlug(deck.shopSlug ?? "");
        setShopUrl(deck.shopUrl ?? "");
        setIsPublished(deck.isPublished ?? false);

        const leaderEntry = deck.deckCards.find(
          (dc: any) => dc.card?.category === "Leader"
        );
        if (leaderEntry) {
          setBuilderLeader(leaderEntry.card);
        }

        const nonLeaders = deck.deckCards
          .filter((dc: any) => dc.card?.category !== "Leader")
          .map(convertDeckCard);

        setBuilderDeckCards(nonLeaders);
      } catch (error) {
        console.error(error);
        showErrorToast(
          error instanceof Error
            ? error.message
            : "Error cargando el deck de tienda"
        );
        router.push("/admin/shop-decks");
      } finally {
        setIsLoadingDeck(false);
      }
    };

    fetchDeck();
  }, [deckId, setBuilderDeckCards, setBuilderLeader, router]);

  useEffect(() => {
    if (!hasEditedSlug) {
      setShopSlug(deckName ? slugify(deckName) : "");
    }
  }, [deckName, hasEditedSlug]);

  useEffect(() => {
    if (!loading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [loading, role, router]);

  const dataSource = cachedCards.length > 0 ? cachedCards : allCardsData ?? [];
  const totalCards = deckBuilder.deckCards.reduce(
    (sum, card) => sum + card.quantity,
    0
  );

  const handleSave = async () => {
    if (deckBuilder.isSaving) return;
    if (!deckBuilder.selectedLeader) {
      showErrorToast("Selecciona un líder para el deck.");
      return;
    }
    if (totalCards !== 50) {
      showErrorToast("El deck debe tener 50 cartas (sin contar el líder).");
      return;
    }

    const normalizedSlug = slugify(shopSlug);
    if (!normalizedSlug) {
      showErrorToast("Define un slug válido para la tienda.");
      return;
    }

    const urlToSave = shopUrl.trim();
    try {
      new URL(urlToSave);
    } catch {
      showErrorToast("Ingresa una URL de tienda válida (https://...).");
      return;
    }

    const payloadCards = [
      { cardId: deckBuilder.selectedLeader.id, quantity: 1 },
      ...deckBuilder.deckCards.map((card) => ({
        cardId: card.cardId,
        quantity: card.quantity,
      })),
    ];

    deckBuilder.setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/shop-decks/${deckId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deckName.trim(),
          cards: payloadCards,
          shopSlug: normalizedSlug,
          shopUrl: urlToSave,
          isPublished,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo actualizar el deck");
      }

      showSuccessToast("Deck actualizado correctamente");
      router.push("/admin/shop-decks");
    } catch (error) {
      console.error("Error actualizando deck:", error);
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Error actualizando el deck de tienda"
      );
    } finally {
      deckBuilder.setIsSaving(false);
    }
  };

  const handleRestart = () => {
    deckBuilder.setSelectedLeader(undefined);
    deckBuilder.setDeckCards([]);
  };

  const handleSlugFromLayout = (value: string) => {
    setHasEditedSlug(true);
    setShopSlug(value);
  };

  if (!loading && role !== "ADMIN") {
    return null;
  }

  if (isLoadingDeck) {
    return (
      <div className="flex items-center justify-center h-[80vh] w-full">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Cargando deck...</p>
        </div>
      </div>
    );
  }

  return (
    <DeckBuilderLayout
      deckBuilder={deckBuilder}
      onSave={handleSave}
      onRestart={handleRestart}
      initialCards={dataSource as CardWithCollectionData[]}
      deckName={deckName}
      setDeckName={setDeckName}
      isShopMode
      shopSlug={shopSlug}
      setShopSlug={handleSlugFromLayout}
      shopUrl={shopUrl}
      setShopUrl={setShopUrl}
      isPublished={isPublished}
      setIsPublished={setIsPublished}
    />
  );
};

export default EditShopDeckBuilder;
