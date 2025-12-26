"use client";

import {
  X,
  Trophy,
  Edit,
  Trash2,
  FileText,
  Download,
  Share2,
  Copy,
  Check,
  ShoppingBag,
  Eye,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import { getColors } from "@/helpers/functions";
import { rarityFormatter } from "@/helpers/formatters";
import { Oswald } from "next/font/google";
import { cn } from "@/lib/utils";
import { Deck, DeckCard } from "@/types";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

interface DeckDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  deck: Deck | null;
  mode?: "user" | "shop" | "shop-admin";
  onDelete?: () => void;
}

const DeckDetailDrawer: React.FC<DeckDetailDrawerProps> = ({
  isOpen,
  onClose,
  deck,
  mode = "user",
  onDelete,
}) => {
  const { data: session } = useSession();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [content, setContent] = useState("");
  const [activeTab, setActiveTab] = useState("sansan");
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isShopView = mode === "shop" || mode === "shop-admin";
  const isAdminShopView = mode === "shop-admin";
  const isPublicShopView = mode === "shop";
  const canEditDeck = mode === "user" || isAdminShopView;
  const canDeleteDeck = mode === "user" || isAdminShopView;

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen && !isAnimating) return null;
  if (!deck) return null;

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  // Get leader card
  const leaderCard = deck.deckCards.find(
    (card) => card.card?.category === "Leader"
  );

  // Group and sort cards
  const groupedCards = Object.values(
    deck.deckCards.reduce((groups, card) => {
      if (!groups[card.code]) {
        groups[card.code] = [];
      }
      groups[card.code].push(card);
      return groups;
    }, {} as Record<string, DeckCard[]>)
  );

  groupedCards.sort((groupA, groupB) => {
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

  // Stats
  const counter2000Count = deck.deckCards
    .filter(
      (card) =>
        card.card?.counter?.includes("+2000") || card.counter?.includes("+2000")
    )
    .reduce((sum, card) => sum + card.quantity, 0);

  const counter1000Count = deck.deckCards
    .filter(
      (card) =>
        card.card?.counter?.includes("+1000") || card.counter?.includes("+1000")
    )
    .reduce((sum, card) => sum + card.quantity, 0);

  const triggerCount = deck.deckCards
    .filter(
      (card) =>
        card.card?.triggerCard &&
        card.card.triggerCard !== null &&
        card.card.triggerCard !== ""
    )
    .reduce((sum, card) => sum + card.quantity, 0);

  const totalCards = deck.deckCards.reduce(
    (sum, card) => sum + card.quantity,
    0
  );

  // Format deck for SanSan Events
  const formatSanSanEvents = () => {
    const leader = deck.deckCards.find(
      (card) => card.card?.category === "Leader"
    );
    if (!leader) return "No se encontró carta líder";

    const grouped = deck.deckCards
      .filter((card) => card.card?.category !== "Leader")
      .reduce((acc: Record<string, DeckCard>, card) => {
        const cardCode = card.card?.code || card.code || "";
        if (acc[cardCode]) {
          acc[cardCode].quantity += card.quantity;
        } else {
          acc[cardCode] = { ...card };
        }
        return acc;
      }, {} as Record<string, DeckCard>);

    const formatted = Object.values(grouped).map(
      (card) =>
        `${card.quantity} -\u200B ${card.card?.code || card.code} ${rarityFormatter(
          card.card?.rarity || card.rarity || ""
        )}\u200B.\u200B`
    );

    return `1 - ${leader.card?.code || leader.code} L\u200B.\u200B\n${formatted.join("\n")}`;
  };

  // Format deck for OPSim
  const formatOptgsim = (): string => {
    const grouped = deck.deckCards.reduce(
      (acc: Record<string, DeckCard>, card) => {
        const cardCode = card.card?.code || card.code || "";
        if (acc[cardCode]) {
          acc[cardCode].quantity += card.quantity;
        } else {
          acc[cardCode] = { ...card };
        }
        return acc;
      },
      {} as Record<string, DeckCard>
    );

    const formatted = Object.values(grouped).map(
      (card) => `${card.quantity}x${card.card?.code || card.code}`
    );

    const leader = deck.deckCards.find(
      (card) => card.card?.category === "Leader"
    );
    const leaderCode = leader?.card?.code || leader?.code || "";

    return `1x${leaderCode}\n${formatted.join("\n")}`;
  };

  const handleExport = () => {
    setIsModalOpen(true);
    requestAnimationFrame(() => {
      setContent(formatSanSanEvents());
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccessToast("Text copied to clipboard");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showErrorToast("Error al copiar el texto");
    }
  };

  const handleCopyUrl = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast("URL copied to clipboard");
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      showErrorToast("Error al copiar la URL");
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `${deck.name} - One Piece TCG Deck`,
      text: `Check out this One Piece TCG deck: ${deck.name}`,
      url: `https://oharatcg.com/decks/${deck.uniqueUrl}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        showSuccessToast("Deck shared successfully");
      } else {
        await navigator.clipboard.writeText(shareData.url);
        showSuccessToast("Deck URL copied to clipboard");
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(shareData.url);
        showSuccessToast("Deck URL copied to clipboard");
      } catch (copyErr) {
        showErrorToast("Error sharing deck");
      }
    }
  };

  const handleDelete = async () => {
    if (!deck) return;
    setIsDeleting(true);
    try {
      const endpoint = isShopView
        ? `/api/admin/shop-decks/${deck.id}`
        : `/api/admin/deck/${deck.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "No se pudo eliminar el deck");
      }

      showSuccessToast("Deck eliminado exitosamente");
      onDelete?.();
      handleClose();
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Error eliminando deck"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center ${
          isAnimating ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`w-full max-h-[92vh] overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out lg:max-h-[90vh] lg:max-w-5xl lg:rounded-3xl ${
            isAnimating
              ? "translate-y-0 lg:translate-y-0 lg:scale-100 lg:opacity-100"
              : "translate-y-full lg:translate-y-0 lg:scale-95 lg:opacity-0"
          }`}
        >
          {/* Handle for mobile */}
          <div className="flex justify-center py-3 lg:hidden">
            <div className="h-1.5 w-12 rounded-full bg-slate-300" />
          </div>

          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 pt-2 sm:px-6 lg:pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  {/* Leader Avatar */}
                  {leaderCard && (
                    <div className="relative h-12 w-12 flex-shrink-0 rounded-full sm:h-14 sm:w-14">
                      {leaderCard.card?.colors &&
                      leaderCard.card.colors.length === 2 ? (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: `linear-gradient(to right, ${getColors(
                              leaderCard.card.colors[0].color
                            )} 0%, ${getColors(
                              leaderCard.card.colors[0].color
                            )} 40%, ${getColors(
                              leaderCard.card.colors[1].color
                            )} 60%, ${getColors(
                              leaderCard.card.colors[1].color
                            )} 100%)`,
                          }}
                        />
                      ) : leaderCard.card?.colors &&
                        leaderCard.card.colors.length > 0 ? (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            backgroundColor: getColors(
                              leaderCard.card.colors[0].color
                            ),
                          }}
                        />
                      ) : null}
                      <div
                        className="absolute inset-1 rounded-full bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${leaderCard.card?.src})`,
                          backgroundSize: "150%",
                          backgroundPosition: "-20px -2px",
                        }}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold text-slate-900 sm:text-2xl">
                      {deck.name}
                    </h2>
                    <p className="text-xs text-slate-500 sm:text-sm">
                      {totalCards} cartas
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stats Cards */}
            <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
              <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                <span className="text-amber-600 text-xs">⚡</span>
                <span className="text-xs font-medium text-amber-700">
                  +2000
                </span>
                <span className="text-sm font-bold text-amber-800">
                  {counter2000Count}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1.5">
                <span className="text-sky-600 text-xs">⚡</span>
                <span className="text-xs font-medium text-sky-700">+1000</span>
                <span className="text-sm font-bold text-sky-800">
                  {counter1000Count}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                <span className="text-emerald-600 text-xs">🔥</span>
                <span className="text-xs font-medium text-emerald-700">
                  Trigger
                </span>
                <span className="text-sm font-bold text-emerald-800">
                  {triggerCount}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
              {!isAdminShopView && !isPublicShopView && (
                <>
                  <Button
                    onClick={handleExport}
                    size="sm"
                    className="flex-1 bg-slate-900 text-white hover:bg-slate-800 rounded-xl"
                  >
                    <FileText className="mr-1.5 h-4 w-4" />
                    Exportar
                  </Button>
                  <Button
                    onClick={handleShare}
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl"
                  >
                    <Share2 className="mr-1.5 h-4 w-4" />
                    Compartir
                  </Button>
                </>
              )}

              {isPublicShopView && deck.shopUrl && (
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
                  asChild
                >
                  <a
                    href={deck.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ShoppingBag className="mr-1.5 h-4 w-4" />
                    Comprar
                  </a>
                </Button>
              )}

              {canEditDeck && (
                <Button
                  size="sm"
                  className="flex-1 bg-black text-white hover:bg-black/90 rounded-xl"
                  asChild
                >
                  <Link
                    href={
                      isAdminShopView
                        ? `/admin/shop-decks/${deck.id}`
                        : `/decks/edit/${deck.id}`
                    }
                  >
                    <Edit className="mr-1.5 h-4 w-4" />
                    Editar
                  </Link>
                </Button>
              )}

              {canDeleteDeck && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-xl"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div
            className="overflow-y-auto px-4 pb-6 sm:px-6"
            style={{ maxHeight: "calc(92vh - 280px)" }}
          >
            {deck.deckCards.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center sm:rounded-2xl sm:p-8">
                <Eye className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-3 text-sm text-slate-500 sm:text-base">
                  No hay cartas en este deck
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-slate-100 p-3 sm:p-4">
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2 md:grid-cols-6 lg:grid-cols-8">
                  {groupedCards.map((group) =>
                    group.map((card, index) => (
                      <button
                        key={`${card.cardId}-${index}`}
                        onClick={() => {
                          setSelectedCard(card);
                          setShowLargeImage(true);
                        }}
                        className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md active:scale-[0.98]"
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
                          <img
                            src={card.card?.src || card.src}
                            alt={card.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          {card.quantity > 1 && (
                            <div className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-[10px] font-bold text-white shadow-sm sm:right-1 sm:top-1 sm:h-6 sm:w-6 sm:text-xs">
                              {card.quantity}
                            </div>
                          )}
                        </div>
                        <div className="p-1 sm:p-1.5">
                          <p
                            className={`${oswald.className} text-[10px] font-medium text-center text-slate-700 sm:text-xs`}
                          >
                            {card.code}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Large Image Modal */}
      {showLargeImage && selectedCard && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-5"
          onClick={() => setShowLargeImage(false)}
        >
          <div className="w-full max-w-lg">
            <p className="mb-3 text-center text-white text-lg">Tap to close</p>
            <img
              src={selectedCard.card?.src || selectedCard.src}
              className="max-w-full max-h-[75vh] mx-auto object-contain rounded-lg shadow-2xl"
              alt={selectedCard.name}
            />
            <p
              className={`${oswald.className} mt-3 text-center text-white font-medium`}
            >
              {selectedCard.code}
            </p>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setActiveTab("sansan");
            setCopied(false);
            setCopiedUrl(false);
            setContent("");
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle>Exportar Lista del Deck</DialogTitle>
            <DialogDescription>
              Copia la lista del deck en formato SanSan Events o OPSim
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pb-5 space-y-4">
            {/* Tabs */}
            <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => {
                  setActiveTab("sansan");
                  setContent(formatSanSanEvents());
                  setCopied(false);
                }}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === "sansan"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
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
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === "optcgsim"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                OPSim
              </button>
            </div>

            {/* Content */}
            <div className="max-h-40 overflow-auto rounded-lg bg-slate-100 p-3 text-sm">
              {content.split("\n").map((line, i) => (
                <p key={i} className="font-mono text-slate-700">
                  {line}
                </p>
              ))}
            </div>

            {/* Copy Button */}
            <Button onClick={handleCopy} className="w-full rounded-xl py-5">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Texto
                </>
              )}
            </Button>

            {/* Share URL */}
            {!isPublicShopView && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`https://oharatcg.com/decks/${deck.uniqueUrl}`}
                    className="flex-1 text-xs"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      handleCopyUrl(
                        `https://oharatcg.com/decks/${deck.uniqueUrl}`
                      )
                    }
                  >
                    {copiedUrl ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="w-full rounded-xl"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartir
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeckDetailDrawer;
