"use client";

import {
  X,
  TrendingUp,
  Trophy,
  DollarSign,
  Lock,
  Download,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LazyImage from "@/components/LazyImage";
import LoginModal from "@/components/LoginModal";

interface CardInDeck {
  id: number;
  name: string;
  code: string;
  src: string;
  imageKey: string | null;
  marketPrice: any;
  category: string;
  rarity: string | null;
  colors: { color: string }[];
}

interface DeckCard {
  quantity: number;
  card: CardInDeck;
}

interface Deck {
  id: number;
  name: string;
  uniqueUrl: string;
  deckCards: DeckCard[];
}

interface LeaderCard {
  id: number;
  name: string;
  code: string;
  src: string;
  imageKey: string | null;
  colors: { color: string }[];
}

interface DeckDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  standing: number | null;
  archetypeName: string | null;
  deck: Deck | null;
  leaderCard: LeaderCard | null;
  totalPrice: string;
  tournamentName: string;
  deckSourceUrl?: string | null;
}

const DeckDrawer: React.FC<DeckDrawerProps> = ({
  isOpen,
  onClose,
  playerName,
  standing,
  archetypeName,
  deck,
  leaderCard,
  totalPrice,
  tournamentName,
  deckSourceUrl,
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  const handleImportDeck = async () => {
    if (!deck || !session) return;

    setIsForking(true);
    setForkError(null);

    try {
      const response = await fetch(`/api/decks/${deck.id}/fork`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al importar el deck");
      }

      // Redirigir a la página de edición del deck copiado
      router.push(`/decks/edit/${data.id}`);
    } catch (error) {
      setForkError(error instanceof Error ? error.message : "Error al importar");
      setIsForking(false);
    }
  };

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

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  const organizedCards = deck?.deckCards.reduce(
    (acc, deckCard) => {
      if (deckCard.card.category === "Leader") {
        acc.leader.push(deckCard);
      } else if (deckCard.card.category === "Character") {
        acc.characters.push(deckCard);
      } else if (deckCard.card.category === "Event") {
        acc.events.push(deckCard);
      } else if (deckCard.card.category === "Stage") {
        acc.stages.push(deckCard);
      } else {
        acc.other.push(deckCard);
      }
      return acc;
    },
    {
      leader: [] as DeckCard[],
      characters: [] as DeckCard[],
      events: [] as DeckCard[],
      stages: [] as DeckCard[],
      other: [] as DeckCard[],
    }
  );

  const totalCards =
    deck?.deckCards.reduce((sum, dc) => sum + dc.quantity, 0) || 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Drawer / Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center ${
          isAnimating ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`w-full max-h-[90vh] overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out lg:max-h-[85vh] lg:max-w-4xl lg:rounded-3xl ${
            isAnimating
              ? "translate-y-0 lg:translate-y-0 lg:scale-100 lg:opacity-100"
              : "translate-y-full lg:translate-y-0 lg:scale-95 lg:opacity-0"
          }`}
        >
          {/* Handle */}
          <div className="flex justify-center py-3 lg:hidden">
            <div className="h-1.5 w-12 rounded-full bg-slate-300" />
          </div>

          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 pt-2 sm:px-6 lg:pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {standing && (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-100 sm:h-8 sm:w-8">
                      <span className="text-xs font-bold text-amber-700 sm:text-sm">
                        #{standing}
                      </span>
                    </div>
                  )}
                  <h2 className="truncate text-lg font-bold text-slate-900 sm:text-2xl">
                    {playerName}
                  </h2>
                </div>
                <div className="mt-1 flex flex-col">
                  <p className="truncate text-xs text-slate-500 sm:text-sm">
                    {tournamentName}
                  </p>
                  {archetypeName && (
                    <p className="truncate text-xs text-emerald-600 sm:text-sm">
                      {archetypeName}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stats Cards - Compact on mobile */}
            <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:rounded-2xl sm:p-3">
                <div className="flex items-center gap-1.5 text-slate-500 sm:gap-2">
                  <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="text-[10px] sm:text-xs">Cards</span>
                </div>
                <p className="mt-0.5 text-lg font-bold text-slate-900 sm:mt-1 sm:text-xl">
                  {totalCards}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:rounded-2xl sm:p-3">
                <div className="flex items-center gap-1.5 text-slate-500 sm:gap-2">
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="text-[10px] sm:text-xs">Precio</span>
                </div>
                <p className="mt-0.5 text-lg font-bold text-emerald-600 sm:mt-1 sm:text-xl">
                  ${totalPrice}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:rounded-2xl sm:p-3">
                <div className="flex items-center gap-1.5 text-slate-500 sm:gap-2">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="text-[10px] sm:text-xs">Avg</span>
                </div>
                <p className="mt-0.5 text-lg font-bold text-slate-900 sm:mt-1 sm:text-xl">
                  $
                  {totalCards > 0
                    ? (parseFloat(totalPrice) / totalCards).toFixed(2)
                    : "0.00"}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-3 flex flex-col gap-2 sm:mt-4">
              {deck &&
                (session ? (
                  <button
                    onClick={handleImportDeck}
                    disabled={isForking}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-3"
                  >
                    {isForking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Importar Deck
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:scale-[0.98] sm:px-4 sm:py-3"
                  >
                    <Lock className="h-4 w-4" />
                    Iniciar sesión para importar
                  </button>
                ))}
              {forkError && (
                <p className="text-center text-xs text-red-500">{forkError}</p>
              )}
              {deck && (
                <Link
                  href={`/deckbuilder/${deck.uniqueUrl}`}
                  className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.98] sm:px-4 sm:py-3"
                >
                  Ver Deck Original
                </Link>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div
            className="overflow-y-auto px-4 pb-6 sm:px-6"
            style={{ maxHeight: "calc(90vh - 300px)" }}
          >
            {!deck || !deck.deckCards || deck.deckCards.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center sm:rounded-2xl sm:p-8">
                <p className="text-sm text-slate-500 sm:text-base">
                  Este deck aún no ha sido importado a la plataforma.
                </p>
              </div>
            ) : (
              <div className="space-y-5 sm:space-y-6">
                {/* Leader */}
                {organizedCards && organizedCards.leader.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:mb-3 sm:text-sm">
                      Líder (
                      {organizedCards.leader.reduce(
                        (s, dc) => s + dc.quantity,
                        0
                      )}
                      )
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
                      {organizedCards.leader.map((deckCard) => (
                        <CardGridItem
                          key={deckCard.card.id}
                          deckCard={deckCard}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Characters */}
                {organizedCards && organizedCards.characters.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:mb-3 sm:text-sm">
                      Personajes (
                      {organizedCards.characters.reduce(
                        (s, dc) => s + dc.quantity,
                        0
                      )}
                      )
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
                      {organizedCards.characters.map((deckCard) => (
                        <CardGridItem
                          key={deckCard.card.id}
                          deckCard={deckCard}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Events */}
                {organizedCards && organizedCards.events.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:mb-3 sm:text-sm">
                      Eventos (
                      {organizedCards.events.reduce(
                        (s, dc) => s + dc.quantity,
                        0
                      )}
                      )
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
                      {organizedCards.events.map((deckCard) => (
                        <CardGridItem
                          key={deckCard.card.id}
                          deckCard={deckCard}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Stages */}
                {organizedCards && organizedCards.stages.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:mb-3 sm:text-sm">
                      Escenarios (
                      {organizedCards.stages.reduce(
                        (s, dc) => s + dc.quantity,
                        0
                      )}
                      )
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
                      {organizedCards.stages.map((deckCard) => (
                        <CardGridItem
                          key={deckCard.card.id}
                          deckCard={deckCard}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Other */}
                {organizedCards && organizedCards.other.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:mb-3 sm:text-sm">
                      Otras (
                      {organizedCards.other.reduce(
                        (s, dc) => s + dc.quantity,
                        0
                      )}
                      )
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
                      {organizedCards.other.map((deckCard) => (
                        <CardGridItem
                          key={deckCard.card.id}
                          deckCard={deckCard}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
};

const CardGridItem: React.FC<{ deckCard: DeckCard }> = ({ deckCard }) => {
  const price = deckCard.card.marketPrice
    ? parseFloat(deckCard.card.marketPrice.toString())
    : 0;
  const totalPrice = price * deckCard.quantity;

  const imageSrc = deckCard.card.imageKey
    ? `https://images.oharatcg.com/${deckCard.card.imageKey}`
    : deckCard.card.src;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md sm:rounded-xl">
      {/* Card Image */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
        <LazyImage
          src={imageSrc}
          fallbackSrc="/images/card-back.png"
          alt={deckCard.card.name}
          size="small"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        {/* Quantity Badge */}
        <div className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-[10px] font-bold text-white shadow-sm sm:right-1 sm:top-1 sm:h-6 sm:w-6 sm:text-xs">
          {deckCard.quantity}
        </div>
      </div>

      {/* Card Info */}
      <div className="flex flex-1 flex-col p-1.5 sm:p-2">
        <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-slate-900 sm:text-xs">
          {deckCard.card.name}
        </p>
        <p className="mt-0.5 text-[9px] text-slate-500 sm:text-[10px]">
          {deckCard.card.code}
        </p>
        {price > 0 && (
          <p className="mt-auto pt-0.5 text-[10px] font-semibold text-emerald-600 sm:pt-1 sm:text-xs">
            ${totalPrice.toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
};

export default DeckDrawer;
