"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, ChartColumnBigIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showErrorToast } from "@/lib/toastify";
import { Deck, GroupedDecks } from "@/types";
import DeckCard from "./DeckCard";
import DeckDetailDrawer from "./DeckDetailDrawer";
import DeckDetailPanel from "./DeckDetailPanel";

const DecksClient = () => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isFetchingDecks, setIsFetchingDecks] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: session } = useSession();
  const userId = session?.user?.id;
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const isAdminShopView = currentPath.startsWith("/admin/shop-decks");
  const isPublicShopView = currentPath.startsWith("/shop");
  const isShopView = isAdminShopView || isPublicShopView;

  // Group decks by leader
  const groupedDecks = decks.reduce((acc, deck) => {
    const leaderCard = deck.deckCards.find(
      (dc) => dc.card?.category === "Leader"
    );
    if (leaderCard?.card) {
      const leaderCode = leaderCard.card.code;
      if (!acc[leaderCode as keyof typeof acc]) {
        acc[leaderCode] = {
          leaderCard,
          decks: [],
        };
      }
      acc[leaderCode].decks.push(deck);
    }
    return acc;
  }, {} as GroupedDecks);

  const fetchDecks = async () => {
    setIsFetchingDecks(true);
    try {
      let endpoint: string | null = null;
      if (isShopView) {
        const includeUnpublished =
          session?.user?.role === "ADMIN" ? "?includeUnpublished=true" : "";
        endpoint = `/api/admin/shop-decks${includeUnpublished}`;
      } else if (userId) {
        endpoint = `/api/admin/decks/user/${userId}`;
      }

      if (!endpoint) return;

      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(
          isShopView ? "No hay decks de tienda" : "No tienes decks"
        );
      }
      const data = await res.json();
      const filteredDecks = Array.isArray(data)
        ? data.filter((deck: Deck) =>
            isShopView ? deck.isShopDeck : !deck.isShopDeck
          )
        : [];
      setDecks(filteredDecks);
    } catch (error) {
      console.error("Error fetching decks:", error);
      showErrorToast(
        isShopView
          ? "No pudimos cargar los decks de la tienda"
          : "No pudimos cargar tus decks"
      );
    } finally {
      setIsFetchingDecks(false);
    }
  };

  useEffect(() => {
    if (isShopView || userId) {
      fetchDecks();
    } else {
      setIsFetchingDecks(false);
    }
  }, [session, userId, isShopView]);

  const handleSelectDeck = (deck: Deck) => {
    setSelectedDeck(deck);
    // Solo abrir drawer en móvil (< lg breakpoint)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsDrawerOpen(true);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleDeleteDeck = () => {
    setSelectedDeck(null);
    fetchDecks();
  };

  const mode = isAdminShopView
    ? "shop-admin"
    : isPublicShopView
    ? "shop"
    : "user";

  // Loading state
  if (isFetchingDecks) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-gradient-to-b from-[#fbf6ef] to-[#f2e2c7] w-full">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-amber-600" />
          <p className="text-sm font-semibold tracking-wide text-amber-700">
            {isShopView
              ? "Consultando decks disponibles..."
              : "Cargando tus decks..."}
          </p>
        </div>
      </div>
    );
  }

  // Empty state for public shop
  if (isPublicShopView && !isFetchingDecks && decks.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-gradient-to-b from-[#fbf6ef] to-[#f2e2c7] px-6 text-center w-full">
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/80 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm">
            <span className="animate-pulse">🧭</span>
            Sin decks disponibles
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            No hay decks disponibles en la tienda
          </h1>
          <p className="text-lg text-slate-600">
            Estamos preparando nuevos listados. Mientras tanto, explora las
            cartas o crea tu propio deck.
          </p>
          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-center">
            <Link
              href="/card-list"
              className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              Explorar cartas
            </Link>
            <Link
              href="/deckbuilder"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition-all hover:bg-slate-50"
            >
              Crear mi deck
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Empty state for user decks
  if (!isShopView && !isFetchingDecks && decks.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#f2eede] px-6 text-center w-full">
        <div className="max-w-md space-y-6">
          <h2 className="text-2xl font-bold text-slate-800 sm:text-3xl">
            Crea tu primer deck
          </h2>
          <p className="text-slate-600">
            Aún no tienes mazos guardados. Crea tu primer deck y empieza a
            construir tu estrategia.
          </p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="rounded-xl">
              <Link href="/deckbuilder">
                <Plus className="mr-2 h-5 w-5" />
                Crear Nuevo Deck
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-xl">
              <Link href="/">
                <ChartColumnBigIcon className="mr-2 h-5 w-5" />
                Explorar Cartas
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f2eede] lg:flex-row">
      {/* Sidebar - Deck List */}
      <div className="flex flex-col border-b border-slate-200 bg-white lg:h-screen lg:w-[400px] lg:flex-shrink-0 lg:border-b-0 lg:border-r lg:sticky lg:top-0">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {isAdminShopView
                  ? "Gestionar Decks"
                  : isPublicShopView
                  ? "Tienda de Decks"
                  : "Mis Decks"}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {decks.length} deck{decks.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button asChild size="sm" className="rounded-xl">
              <Link
                href={isAdminShopView ? "/admin/create-decks" : "/deckbuilder"}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline lg:hidden xl:inline">
                  Nuevo
                </span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Deck List - Scrollable */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          <div className="space-y-3 pb-20 lg:pb-4">
            {Object.entries(groupedDecks).map(
              ([leaderCode, { leaderCard, decks: leaderDecks }]) => (
                <DeckCard
                  key={leaderCode}
                  leaderCode={leaderCode}
                  leaderCard={leaderCard}
                  decks={leaderDecks}
                  selectedDeckUrl={selectedDeck?.uniqueUrl || null}
                  onSelectDeck={handleSelectDeck}
                  mode={mode}
                />
              )
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Desktop Only */}
      <div className="hidden flex-1 lg:flex lg:flex-col lg:h-screen lg:overflow-hidden">
        <DeckDetailPanel
          deck={selectedDeck}
          mode={mode}
          onDelete={handleDeleteDeck}
        />
      </div>

      {/* Floating Action Button - Mobile Only */}
      <div className="fixed bottom-6 right-6 lg:hidden">
        <Button asChild size="lg" className="h-14 w-14 rounded-full shadow-xl">
          <Link href={isAdminShopView ? "/admin/create-decks" : "/deckbuilder"}>
            <Plus className="h-6 w-6" />
          </Link>
        </Button>
      </div>

      {/* Deck Detail Drawer - Mobile Only */}
      <div className="lg:hidden">
        <DeckDetailDrawer
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          deck={selectedDeck}
          mode={mode}
          onDelete={handleDeleteDeck}
        />
      </div>
    </div>
  );
};

export default DecksClient;
