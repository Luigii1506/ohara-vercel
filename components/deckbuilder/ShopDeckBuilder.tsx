"use client";

import { useRouter } from "next/navigation";
import { useDeckBuilder } from "@/hooks/useDeckBuilder";
import DeckBuilderLayout from "@/components/deckbuilder/DeckBuilderLayout";
import { useAllCards } from "@/hooks/useCards";
import { CardWithCollectionData } from "@/types";
import { useCardStore } from "@/store/cardStore";
import type { CardsFilters } from "@/lib/cards/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useUser } from "@/app/context/UserContext";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ShopDeckBuilder = () => {
  const router = useRouter();
  const deckBuilder = useDeckBuilder();
  const { data: session } = useSession();
  const { role, loading } = useUser();

  const [deckName, setDeckNameState] = useState("");
  const [isDeckNameManual, setIsDeckNameManual] = useState(false);
  const [shopSlug, setShopSlug] = useState("");
  const [shopUrl, setShopUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [hasEditedSlug, setHasEditedSlug] = useState(false);

  const cachedCards = useCardStore((state) => state.allCards);
  const setAllCards = useCardStore((state) => state.setAllCards);
  const isFullyLoaded = useCardStore((state) => state.isFullyLoaded);
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
    if (!deckBuilder.selectedLeader) {
      if (!isDeckNameManual) {
        setDeckNameState("");
      }
      return;
    }
    if (isDeckNameManual) return;
    const leaderName = deckBuilder.selectedLeader.name ?? "";
    if (leaderName) {
      setDeckNameState(leaderName);
    }
  }, [deckBuilder.selectedLeader, isDeckNameManual]);

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
    (total, card) => total + card.quantity,
    0
  );

  const handleDeckNameChange = (value: string) => {
    if (!isDeckNameManual) {
      setIsDeckNameManual(true);
    }
    setDeckNameState(value);
  };

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
      // Validación sencilla para URL
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

    const baseName =
      deckName.trim() || deckBuilder.selectedLeader?.name || "Mi Deck";

    deckBuilder.setIsSaving(true);
    try {
      const response = await fetch("/api/admin/shop-decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: baseName,
          cards: payloadCards,
          userId: session ? session.user.id : null,
          shopSlug: normalizedSlug,
          shopUrl: urlToSave,
          isPublished,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "No se pudo crear el deck de tienda"
        );
      }

      showSuccessToast("Deck de tienda creado correctamente");
      const newDeck = await response.json();
      router.push(`/shop`);
    } catch (error) {
      console.error("Error en la creación del deck de tienda:", error);
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Error creando el deck de tienda"
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

  return (
    <DeckBuilderLayout
      deckBuilder={deckBuilder}
      onSave={handleSave}
      onRestart={handleRestart}
      initialCards={dataSource as CardWithCollectionData[]}
      deckName={deckName}
      setDeckName={handleDeckNameChange}
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

export default ShopDeckBuilder;
