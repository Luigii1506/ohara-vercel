// hooks/useDeckBuilder.ts
import { showWarningToast } from "@/lib/toastify";
import { useState, useEffect } from "react";
import { DeckCard } from "@/types";
import { useSession } from "next-auth/react";

export interface DeckBuilderHook {
  deckData: any;
  deckCards: DeckCard[];
  selectedLeader: any;
  isDeckLoaded: boolean;
  isSaving: boolean;
  deckName: string;
  handleAddCard: (
    card: Omit<DeckCard, "quantity"> & { quantity?: number }
  ) => void;
  updateDeckCardQuantity: (cardId: number, newQuantity: number) => void;
  setDeckCards: React.Dispatch<React.SetStateAction<DeckCard[]>>;
  setSelectedLeader: React.Dispatch<React.SetStateAction<any>>;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setDeckName: React.Dispatch<React.SetStateAction<string>>;
}

export function useDeckBuilder(initialDeckUrl?: string): DeckBuilderHook {
  const [deckData, setDeckData] = useState<any>(null);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);
  const [selectedLeader, setSelectedLeader] = useState<any>(null);
  const [isDeckLoaded, setIsDeckLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deckName, setDeckName] = useState<string>("Mi Deck");

  const { data: session } = useSession();

  // Si se pasa una URL, se asume que se está haciendo fork de un deck existente
  useEffect(() => {
    if (initialDeckUrl) {
      // Use /api/decks/{id} for all users (regular route with proper auth)
      const url = `/api/decks/${initialDeckUrl}`;
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error("Deck no encontrado");
          return res.json();
        })
        .then((data) => {
          setDeckData(data);
          // Establecer el nombre del deck desde los datos cargados
          setDeckName(data.name || "Mi Deck");
          const isLeaderCategory = (category?: string | null) =>
            (category || "").toLowerCase() === "leader";

          // Asumimos que el deck original tiene 1 Leader
          const leaderEntry = data.deckCards.find((dc: any) =>
            isLeaderCategory(dc.card.category)
          );
          if (leaderEntry) setSelectedLeader(leaderEntry.card);
          // Las cartas no Leader para el deck

          const nonLeaderCards = data.deckCards
            .filter((dc: any) => !isLeaderCategory(dc.card.category))
            .map((dc: any) => ({
              attribute: dc.card.attribute,
              cardId: dc.card.id,
              name: dc.card.name,
              rarity: dc.card.rarity || "Desconocido",
              quantity: dc.quantity,
              src: dc.card.src,
              code: dc.card.code,
              color: dc.card.colors.length ? dc.card.colors[0].color : "gray",
              cost: dc.card.cost || "",
              category: dc.card.category,
              set: dc.card.sets[0].set.title ?? "",
              counter: dc.card.counter,
              power: dc.card.power,
              marketPrice: dc.card.marketPrice ?? null,
              priceCurrency: dc.card.priceCurrency ?? "USD",
            }));

          setDeckCards(nonLeaderCards);
          setIsDeckLoaded(true);
        })
        .catch((error) => {
          console.error("[useDeckBuilder] Error:", error);
          setIsDeckLoaded(true);
        });
    } else {
      // Para deck nuevo, podrías inicializar valores o esperar a la interacción del usuario
      setIsDeckLoaded(true);
    }
  }, [initialDeckUrl, session]);

  const handleAddCard = (
    card: Omit<DeckCard, "quantity"> & { quantity?: number }
  ) => {
    const quantityToAdd = card.quantity || 1;
    setDeckCards((prevDeck) => {
      const currentTotal = prevDeck.reduce(
        (total, card) => total + card.quantity,
        0
      );
      const allowedExtraGlobal = 50 - currentTotal;
      if (allowedExtraGlobal <= 0) return prevDeck;

      // Agrupar todas las cartas con el mismo código
      const groupCards = prevDeck.filter((c) => c.code === card.code);
      const groupQuantity = groupCards.reduce(
        (total, c) => total + c.quantity,
        0
      );

      // Si el código es "OP08-072", la limitación es 50; en caso contrario, 4.
      const groupLimit =
        card.code === "OP08-072" || card.code === "OP01-075" ? 50 : 4;

      if (groupQuantity >= groupLimit) {
        showWarningToast(`Max ${groupLimit} cards reached.`);
        return prevDeck;
      }

      // Cantidad extra permitida para este grupo
      const allowedExtraForGroup = groupLimit - groupQuantity;
      const extraToAdd = Math.min(
        quantityToAdd,
        allowedExtraForGroup,
        allowedExtraGlobal
      );

      // Buscar si la variante ya existe (por cardId)
      const existingCard = groupCards.find((c) => c.cardId === card.cardId);
      if (existingCard) {
        const newQuantity = existingCard.quantity + extraToAdd;
        return prevDeck.map((c) =>
          c.cardId === card.cardId ? { ...c, quantity: newQuantity } : c
        );
      } else {
        return [...prevDeck, { ...card, quantity: extraToAdd }];
      }
    });
  };

  const updateDeckCardQuantity = (cardId: number, newQuantity: number) => {
    setDeckCards((prev) => {
      // Encontrar la carta a actualizar
      const cardToUpdate = prev.find((card) => card.cardId === cardId);
      if (!cardToUpdate) return prev;

      if (newQuantity <= 0) {
        // Si se actualiza a 0 o menos, se elimina esa variante
        return prev.filter((card) => card.cardId !== cardId);
      }

      // Calcular el total actual del deck excluyendo la carta a actualizar
      const totalExcludingCurrent = prev.reduce(
        (sum, card) => (card.cardId === cardId ? sum : sum + card.quantity),
        0
      );
      // Límite global de 50 cartas
      const allowedGlobal = 50 - totalExcludingCurrent;
      if (newQuantity > allowedGlobal) {
        showWarningToast("Max 50 cards in deck reached.");
      }
      const validGlobalQuantity = Math.min(newQuantity, allowedGlobal);

      // Agrupar todas las variantes con el mismo código
      const groupCards = prev.filter((card) => card.code === cardToUpdate.code);
      // Sumar las cantidades de las demás variantes
      const sumOthers = groupCards.reduce(
        (sum, card) => (card.cardId === cardId ? sum : sum + card.quantity),
        0
      );

      // Para la carta con código "OP08-072" se permite hasta 50, para las demás hasta 4.
      const groupLimit =
        cardToUpdate.code === "OP08-072" || cardToUpdate.code === "OP01-075"
          ? 50
          : 4;
      const allowedForGroup = groupLimit - sumOthers;
      if (validGlobalQuantity > allowedForGroup) {
        showWarningToast(`Max ${groupLimit} cards reached.`);
      }
      const validQuantity = Math.min(validGlobalQuantity, allowedForGroup);

      return prev.map((card) =>
        card.cardId === cardId ? { ...card, quantity: validQuantity } : card
      );
    });
  };

  return {
    deckData,
    deckCards,
    selectedLeader,
    isDeckLoaded,
    isSaving,
    deckName,
    handleAddCard,
    updateDeckCardQuantity,
    setDeckCards,
    setSelectedLeader,
    setIsSaving,
    setDeckName,
  };
}
