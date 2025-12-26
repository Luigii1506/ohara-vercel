"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Oswald } from "next/font/google";
import {
  Share2,
  Pencil,
  X,
  Check,
  Copy,
  ChartColumnBigIcon,
  Layers,
  Users,
  Printer,
  Trash2,
  Loader2,
} from "lucide-react";
import { getColors } from "@/helpers/functions";
import { rarityFormatter } from "@/helpers/formatters";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import { cn } from "@/lib/utils";
import MobileDeckStats from "@/components/deckbuilder/MobileDeckStats";
import { DeckCard, Deck, CardWithCollectionData } from "@/types";
import CardWithBadges from "@/components/CardWithBadges";
import CardPreviewDialog from "@/components/deckbuilder/CardPreviewDialog";
import ProxiesDrawer, { ProxyCard } from "@/components/ProxiesDrawer";
import BaseDrawer from "@/components/ui/BaseDrawer";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Helper functions for price
const getNumericPrice = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const formatCurrency = (value: number, currency?: string | null) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(value);

interface DeckDetailViewProps {
  deck: Deck | null;
  isLoading?: boolean;
  isDrawer?: boolean;
  onClose?: () => void;
  onDelete?: () => void;
}

const DeckDetailView: React.FC<DeckDetailViewProps> = ({
  deck,
  isLoading = false,
  isDrawer = false,
  onClose,
  onDelete,
}) => {
  const router = useRouter();
  const { data: session } = useSession();

  // Preview dialog state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCard, setPreviewCard] = useState<DeckCard | null>(null);

  // Export drawer state
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Stats inline state (not a drawer anymore)
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Proxies drawer state
  const [isProxiesOpen, setIsProxiesOpen] = useState(false);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fork state
  const [isForking, setIsForking] = useState(false);

  // Export state
  const [content, setContent] = useState("");
  const [activeTab, setActiveTab] = useState("sansan");
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Extract data from deck
  const leaderCard = deck?.deckCards?.find(
    (dc: any) => dc.card?.category === "Leader" || dc.category === "Leader"
  );
  const selectedLeader = (leaderCard?.card ?? null) as CardWithCollectionData | null;

  // Extended DeckCard type with price info
  interface DeckCardWithPrice extends DeckCard {
    marketPrice?: number | string | null;
    priceCurrency?: string | null;
  }

  const deckCards: DeckCardWithPrice[] = useMemo(() => {
    if (!deck?.deckCards) return [];
    return deck.deckCards
      .filter((dc: any) => {
        const category = dc.card?.category || dc.category;
        return category !== "Leader";
      })
      .map((dc: any) => ({
        cardId: dc.card?.id || dc.cardId,
        id: dc.card?.id || dc.cardId,
        name: dc.card?.name || dc.name,
        rarity: dc.card?.rarity || dc.rarity || "",
        quantity: dc.quantity,
        src: dc.card?.src || dc.src,
        code: dc.card?.code || dc.code,
        category: dc.card?.category || dc.category,
        color: dc.card?.colors?.[0]?.color || dc.color || "",
        colors: dc.card?.colors || dc.colors || [],
        cost: dc.card?.cost || dc.cost || "",
        power: dc.card?.power || dc.power || "",
        counter: dc.card?.counter || dc.counter || "",
        set: dc.card?.sets?.[0]?.set?.title || dc.set || "",
        attribute: dc.card?.attribute || dc.attribute || "",
        marketPrice: dc.card?.marketPrice ?? null,
        priceCurrency: dc.card?.priceCurrency ?? "USD",
        // Card details for preview
        texts: dc.card?.texts || [],
        effects: dc.card?.effects || [],
        conditions: dc.card?.conditions || [],
        types: dc.card?.types || [],
        sets: dc.card?.sets || [],
        triggerCard: dc.card?.triggerCard || null,
      }));
  }, [deck?.deckCards]);

  const totalCards = deckCards.reduce((sum, card) => sum + card.quantity, 0);

  // Calculate total deck price
  const deckPrice = useMemo(() => {
    let total = 0;
    // Add leader price
    if (selectedLeader) {
      const leaderPrice = getNumericPrice((selectedLeader as any).marketPrice);
      if (leaderPrice !== null) {
        total += leaderPrice;
      }
    }
    // Add all cards prices
    deckCards.forEach((card) => {
      const cardPrice = getNumericPrice(card.marketPrice);
      if (cardPrice !== null) {
        total += cardPrice * card.quantity;
      }
    });
    return total;
  }, [selectedLeader, deckCards]);

  const isOwner = useMemo(() => {
    if (!session?.user?.id || !deck?.userId) return false;
    return String(deck.userId) === String(session.user.id);
  }, [session?.user?.id, deck?.userId]);

  // Stats calculations
  const counter2000Count = deckCards
    .filter((card) => card.counter?.includes("+2000") || card.counter?.includes("2000"))
    .reduce((sum, card) => sum + card.quantity, 0);

  const counter1000Count = deckCards
    .filter((card) => card.counter?.includes("+1000") || card.counter?.includes("1000"))
    .reduce((sum, card) => sum + card.quantity, 0);

  const triggerCount = useMemo(() => {
    if (!deck?.deckCards) return 0;
    return deck.deckCards
      .filter((dc: any) => {
        const category = dc.card?.category || dc.category;
        if (category === "Leader") return false;
        const trigger = dc.card?.triggerCard || dc.triggerCard;
        return trigger && trigger !== "";
      })
      .reduce((sum: number, dc: any) => sum + dc.quantity, 0);
  }, [deck?.deckCards]);

  // Group and sort cards
  const groupedCards = useMemo(() => {
    const groups = Object.values(
      deckCards.reduce((groups, card) => {
        if (!groups[card.code]) {
          groups[card.code] = [];
        }
        groups[card.code].push(card);
        return groups;
      }, {} as Record<string, DeckCardWithPrice[]>)
    );

    groups.sort((groupA, groupB) => {
      const cardA = groupA[0];
      const cardB = groupB[0];
      const isSpecialA = cardA.category === "Event" || cardA.category === "Stage";
      const isSpecialB = cardB.category === "Event" || cardB.category === "Stage";
      if (isSpecialA !== isSpecialB) {
        return isSpecialA ? 1 : -1;
      }
      const costA = parseInt(cardA.cost ?? "0", 10);
      const costB = parseInt(cardB.cost ?? "0", 10);
      return costA - costB;
    });

    return groups;
  }, [deckCards]);

  // Prepare cards for proxies drawer
  const proxiesCards = useMemo((): ProxyCard[] => {
    const leaderProxyCard: ProxyCard[] = selectedLeader
      ? [{
          id: Number(selectedLeader.id),
          name: selectedLeader.name,
          src: selectedLeader.src,
          code: selectedLeader.code,
          quantity: 1,
        }]
      : [];

    const mainCards: ProxyCard[] = deckCards.map((card) => ({
      id: card.cardId,
      name: card.name,
      src: card.src,
      code: card.code,
      quantity: card.quantity,
    }));

    return [...leaderProxyCard, ...mainCards];
  }, [selectedLeader, deckCards]);

  // Handlers
  const openCardPreview = (card: DeckCard) => {
    setPreviewCard(card);
    setIsPreviewOpen(true);
  };

  const closeCardPreview = () => {
    setIsPreviewOpen(false);
    setPreviewCard(null);
  };

  const openExportDrawer = () => {
    setIsExportOpen(true);
    setContent(formatSanSanEvents());
  };

  const closeExportDrawer = () => {
    setIsExportOpen(false);
    setActiveTab("sansan");
    setCopied(false);
    setCopiedUrl(false);
    setContent("");
  };

  // Toggle stats inline view
  const toggleStats = () => {
    setIsStatsOpen(!isStatsOpen);
  };

  const handleShare = async () => {
    const shareData = {
      title: deck?.name || "Mi Deck",
      text: "Mira mi deck en One Piece Card Game!",
      url: `https://oharatcg.com/decks/${deck?.uniqueUrl || deck?.id}`,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error al compartir:", err);
      }
    } else {
      await navigator.clipboard.writeText(shareData.url);
      showSuccessToast("Link copiado al portapapeles");
    }
  };

  const handleEdit = () => {
    router.push(`/decks/edit/${deck?.id}`);
  };

  const handleFork = async () => {
    if (!session?.user) {
      showErrorToast("Debes iniciar sesión para copiar un deck");
      return;
    }

    setIsForking(true);
    try {
      const response = await fetch(`/api/decks/${deck?.id}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Error al copiar el deck");

      const data = await response.json();
      showSuccessToast(data.message || "Deck copiado exitosamente");
      router.push(`/decks/${data.uniqueUrl}`);
    } catch (error) {
      console.error("Error al copiar deck:", error);
      showErrorToast("Error al copiar el deck. Inténtalo de nuevo.");
    } finally {
      setIsForking(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/decks/${deck?.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Error al eliminar el deck");

      showSuccessToast("Deck eliminado exitosamente");
      onDelete?.();
      if (!isDrawer) {
        router.push("/decks");
      }
    } catch (error) {
      console.error("Error al eliminar deck:", error);
      showErrorToast("Error al eliminar el deck. Inténtalo de nuevo.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccessToast("Texto copiado!");
      setCopied(true);
    } catch (err) {
      console.error("Error al copiar el texto: ", err);
    }
  };

  const handleCopyUrl = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast("URL copiada!");
      setCopiedUrl(true);
    } catch (err) {
      console.error("Error al copiar el texto: ", err);
    }
  };

  const formatOptgsim = (): string => {
    const grouped = deckCards.reduce((acc: Record<string, DeckCard>, card) => {
      if (acc[card.code]) {
        acc[card.code].quantity += card.quantity;
      } else {
        acc[card.code] = { ...card };
      }
      return acc;
    }, {} as Record<string, DeckCard>);

    const formattedCards = Object.values(grouped).map(
      (card) => `${card.quantity}x${card.code}`
    );

    return `1x${selectedLeader?.code ?? ""}\n${formattedCards.join("\n")}`;
  };

  const formatSanSanEvents = () => {
    const grouped = deckCards.reduce((acc: Record<string, DeckCard>, card) => {
      if (acc[card.code]) {
        acc[card.code].quantity += card.quantity;
      } else {
        acc[card.code] = { ...card };
      }
      return acc;
    }, {} as Record<string, DeckCard>);

    const formattedCards = Object.values(grouped).map(
      (card) =>
        `${card.quantity} -\u200B ${card.code} ${rarityFormatter(card.rarity)}\u200B.\u200B`
    );

    return `1 - ${selectedLeader?.code ?? ""} L\u200B.\u200B\n${formattedCards.join("\n")}`;
  };

  if (isLoading) {
    return (
      <div className={cn(
        "w-full flex flex-col bg-gray-50",
        isDrawer ? "max-h-[90vh]" : "min-h-screen"
      )}>
        {/* Header Skeleton */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Leader avatar skeleton */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 bg-gray-200 rounded-md animate-pulse w-32" />
                <div className="h-3 bg-gray-200 rounded-md animate-pulse w-20" />
              </div>
            </div>
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-gray-200 animate-pulse" />
          </div>

          {/* Stats badges skeleton */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="h-8 w-20 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-8 w-24 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-8 w-24 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-8 w-20 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Cards Grid Skeleton */}
        <div className={cn(
          "flex-1 overflow-y-auto px-2 py-4",
          isDrawer ? "pb-4" : "pb-32 md:pb-4"
        )}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5 sm:gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[3/4.2] bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons skeleton */}
        <div className={cn(
          "bg-white border-t border-gray-200 p-3 sm:p-4",
          isDrawer ? "sticky bottom-0" : "sticky bottom-0 md:relative"
        )}>
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-12 bg-gray-200 rounded-xl animate-pulse" />
              <div className="h-12 w-12 bg-gray-200 rounded-xl animate-pulse" />
              <div className="h-12 w-12 bg-gray-200 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Deck no encontrado.</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn(
        "w-full flex flex-col bg-gray-50",
        isDrawer ? "max-h-[90vh]" : "min-h-screen"
      )}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            {/* Leader info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {selectedLeader ? (
                <>
                  <div
                    className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full cursor-pointer flex-shrink-0"
                    onClick={() => {
                      const leaderDeckCard: any = {
                        cardId: Number(selectedLeader.id),
                        id: Number(selectedLeader.id),
                        name: selectedLeader.name,
                        rarity: selectedLeader.rarity ?? "",
                        quantity: 1,
                        src: selectedLeader.src,
                        code: selectedLeader.code,
                        color: selectedLeader.colors?.[0]?.color ?? "",
                        colors: selectedLeader.colors || [],
                        cost: selectedLeader.cost ?? "",
                        category: selectedLeader.category,
                        set: selectedLeader.sets?.[0]?.set?.title ?? "",
                        power: selectedLeader.power ?? "",
                        counter: selectedLeader.counter ?? "",
                        attribute: selectedLeader.attribute ?? "",
                        // Card details for preview
                        texts: (selectedLeader as any).texts || [],
                        effects: (selectedLeader as any).effects || [],
                        conditions: (selectedLeader as any).conditions || [],
                        types: selectedLeader.types || [],
                        sets: selectedLeader.sets || [],
                        triggerCard: selectedLeader.triggerCard || null,
                      };
                      openCardPreview(leaderDeckCard);
                    }}
                  >
                    {selectedLeader.colors?.length === 2 ? (
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `linear-gradient(to right, ${getColors(
                            selectedLeader.colors[0].color
                          )} 0%, ${getColors(
                            selectedLeader.colors[0].color
                          )} 40%, ${getColors(
                            selectedLeader.colors[1].color
                          )} 60%, ${getColors(
                            selectedLeader.colors[1].color
                          )} 100%)`,
                        }}
                      />
                    ) : selectedLeader.colors?.length > 0 ? (
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          backgroundColor: getColors(selectedLeader.colors[0].color),
                        }}
                      />
                    ) : null}
                    <div
                      className="absolute inset-1 rounded-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${selectedLeader.src})`,
                        backgroundSize: "150%",
                        backgroundPosition: "-20px -2px",
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                      {deck.name || selectedLeader.name}
                    </h1>
                    <p className={`${oswald.className} text-xs sm:text-sm text-gray-500 truncate`}>
                      {selectedLeader.code}
                      {!isOwner && (deck.user as any)?.name && (
                        <span className="ml-2">• {(deck.user as any).name}</span>
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg font-bold text-gray-700 truncate">
                      {deck.name || "Cargando..."}
                    </h1>
                  </div>
                </>
              )}
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={toggleStats}
                className={cn(
                  "h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center transition-all",
                  isStatsOpen
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <ChartColumnBigIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              {isDrawer && onClose && (
                <button
                  onClick={onClose}
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Stats Badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Deck Price - Only show if price > 0 */}
            {deckPrice > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                <span className="text-sm font-bold text-emerald-700">
                  {formatCurrency(deckPrice)}
                </span>
              </div>
            )}

            {/* Counter +2000 */}
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5">
              <span className="text-amber-600 text-xs">+2000</span>
              <span className="text-sm font-bold text-amber-800">{counter2000Count}</span>
            </div>

            {/* Counter +1000 */}
            <div className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1.5">
              <span className="text-sky-600 text-xs">+1000</span>
              <span className="text-sm font-bold text-sky-800">{counter1000Count}</span>
            </div>

            {/* Trigger */}
            <div className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1.5">
              <span className="text-violet-600 text-xs">Trigger</span>
              <span className="text-sm font-bold text-violet-800">{triggerCount}</span>
            </div>
          </div>
        </div>

        {/* Content Area - Stats or Cards with transition */}
        <div className={cn(
          "flex-1 overflow-y-auto",
          isDrawer ? "pb-4" : "pb-32 md:pb-4"
        )}>
          {/* Stats View */}
          {isStatsOpen && (
            <div className="bg-gray-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <MobileDeckStats deck={deckCards} />
            </div>
          )}

          {/* Cards View */}
          {!isStatsOpen && (
            <div className="px-2 py-4 animate-in fade-in duration-150">
              <div className="max-w-7xl mx-auto">
                {deckCards.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-gray-500">No hay cartas en el deck.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5 sm:gap-2">
                    {groupedCards.flatMap((group) =>
                      group.map((card, index) => (
                        <CardWithBadges
                          key={`${card.cardId}-${index}`}
                          id={card.cardId}
                          src={card.src}
                          alt={card.name}
                          code={card.code}
                          price={getNumericPrice(card.marketPrice)}
                          priceCurrency={card.priceCurrency}
                          onClick={() => openCardPreview(card)}
                          quantityInDeck={card.quantity}
                          size="small"
                          className="!max-w-none"
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons - Sticky bottom */}
        <div className={cn(
          "bg-white border-t border-gray-200 p-3 sm:p-4",
          isDrawer ? "sticky bottom-0" : "sticky bottom-0 md:relative"
        )}>
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-2">
              {/* Primary action */}
              {isOwner ? (
                <Button
                  onClick={handleEdit}
                  className="flex-1 h-12 gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl"
                >
                  <Pencil className="w-4 h-4" />
                  Editar Deck
                </Button>
              ) : (
                <Button
                  onClick={handleFork}
                  disabled={isForking || !session?.user}
                  className="flex-1 h-12 gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  <Copy className="w-4 h-4" />
                  {isForking ? "Copiando..." : "Copiar Deck"}
                </Button>
              )}

              {/* Secondary actions */}
              <Button
                onClick={() => setIsProxiesOpen(true)}
                variant="outline"
                className="h-12 w-12 p-0 border-2 border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 rounded-xl flex-shrink-0"
                title="Imprimir Proxies"
              >
                <Printer className="w-5 h-5" />
              </Button>

              <Button
                onClick={openExportDrawer}
                variant="outline"
                className="h-12 w-12 p-0 border-2 border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 rounded-xl flex-shrink-0"
                title="Compartir / Exportar"
              >
                <Share2 className="w-5 h-5" />
              </Button>

              {/* Delete button - only for owner */}
              {isOwner && (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="outline"
                  className="h-12 w-12 p-0 border-2 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-xl flex-shrink-0"
                  title="Eliminar Deck"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                Eliminar Deck
              </h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                ¿Estás seguro que deseas eliminar este deck? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="outline"
                  className="flex-1 h-11 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl"
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDelete}
                  className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Eliminar"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Export Drawer */}
      <BaseDrawer isOpen={isExportOpen} onClose={closeExportDrawer} maxHeight="90vh">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4">
          <h2 className="text-xl font-bold text-gray-900">Exportar Deck</h2>
          <button
            onClick={closeExportDrawer}
            className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] px-4 pb-4">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-4">
            <button
              onClick={() => {
                setActiveTab("sansan");
                setContent(formatSanSanEvents());
                setCopied(false);
              }}
              className={cn(
                "flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors",
                activeTab === "sansan"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              SanSan
            </button>
            <button
              onClick={() => {
                setActiveTab("optcgsim");
                setContent(formatOptgsim());
                setCopied(false);
              }}
              className={cn(
                "flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors",
                activeTab === "optcgsim"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              OPSim
            </button>
          </div>

          {/* Content */}
          <div className="bg-gray-100 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
            {content.split("\n").map((line, index) => (
              <p key={index} className="text-sm text-gray-700 font-mono">
                {line}
              </p>
            ))}
          </div>

          <Button
            onClick={handleCopy}
            className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl mb-4"
          >
            {copied ? (
              <span className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                Copiado!
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Copy className="w-5 h-5" />
                Copiar Texto
              </span>
            )}
          </Button>

          {/* URL Section */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="text"
                value={`https://oharatcg.com/decks/${deck?.uniqueUrl || deck?.id}`}
                readOnly
                className="flex-1 h-12 font-mono text-sm"
              />
              <Button
                onClick={() =>
                  handleCopyUrl(`https://oharatcg.com/decks/${deck?.uniqueUrl || deck?.id}`)
                }
                variant="outline"
                className="h-12 px-4"
              >
                {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <Button
              onClick={handleShare}
              className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Compartir
            </Button>
          </div>
        </div>
      </BaseDrawer>

      {/* Proxies Drawer */}
      <ProxiesDrawer
        isOpen={isProxiesOpen}
        onClose={() => setIsProxiesOpen(false)}
        cards={proxiesCards}
        deckName={deck?.name || "deck"}
      />

      {/* Card Preview Dialog */}
      <CardPreviewDialog
        isOpen={isPreviewOpen}
        onClose={closeCardPreview}
        card={previewCard as any}
        currentQuantity={previewCard?.quantity || 0}
        maxQuantity={4}
        canAdd={false}
        canRemove={false}
      />
    </>
  );
};

export default DeckDetailView;
