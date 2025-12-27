"use client";

import {
  Trophy,
  Users,
  Calendar,
  MapPin,
  Award,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import DeckDrawer from "./DeckDrawer";
import LazyImage from "@/components/LazyImage";

interface CardColor {
  color: string;
}

interface LeaderCard {
  id: number;
  name: string;
  code: string;
  src: string;
  imageKey: string | null;
  colors: CardColor[];
}

interface CardInDeck {
  id: number;
  name: string;
  code: string;
  src: string;
  imageKey: string | null;
  marketPrice: any;
  category: string;
  rarity: string | null;
  colors: CardColor[];
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

interface TournamentDeck {
  id: number;
  playerName: string;
  standing: number | null;
  deckSourceUrl: string | null;
  archetypeName: string | null;
  deck: Deck | null;
  leaderCard: LeaderCard | null;
  totalPrice: string;
}

interface Tournament {
  id: number;
  type: "REGIONAL" | "CHAMPIONSHIP" | "TREASURE_CUP" | null;
  name: string;
  region: string | null;
  country: string | null; // ISO country code (e.g., "US", "JP", "ES")
  format: string | null;
  eventDate: string;
  playerCount: number | null;
  winnerName: string | null;
  tournamentUrl: string;
  source: {
    name: string;
    slug: string;
  };
  decks: TournamentDeck[];
}

// Get flag image URL from country code
const getFlagUrl = (countryCode: string | null): string | null => {
  if (!countryCode) return null;
  // Use flagcdn.com for high-quality flags
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
};

interface TournamentCardProps {
  tournament: Tournament;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament }) => {
  const [selectedDeck, setSelectedDeck] = useState<TournamentDeck | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const handlePlayerClick = (deck: TournamentDeck) => {
    setSelectedDeck(deck);
    setIsDrawerOpen(true);
  };

  const topDecks = tournament.decks.slice(0, 8);
  const winner = tournament.decks.find((d) => d.standing === 1);

  const getLeaderImageSrc = (leaderCard: LeaderCard | null) => {
    if (!leaderCard) return "/images/card-back.png";
    return leaderCard.imageKey
      ? `https://images.oharatcg.com/${leaderCard.imageKey}`
      : leaderCard.src;
  };

  const getColorClass = (colors: CardColor[]) => {
    if (!colors || colors.length === 0) return "bg-slate-700";

    const colorMap: Record<string, string> = {
      Red: "bg-red-600",
      Blue: "bg-blue-600",
      Green: "bg-green-600",
      Purple: "bg-purple-600",
      Yellow: "bg-yellow-600",
      Black: "bg-gray-700",
    };

    return colorMap[colors[0].color] || "bg-slate-700";
  };

  const getStandingBadgeStyle = (standing: number) => {
    switch (standing) {
      case 1:
        // Gold - 1st place
        return "bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-amber-950 border-amber-300 shadow-amber-500/40";
      case 2:
        // Silver - 2nd place
        return "bg-gradient-to-br from-slate-300 via-gray-400 to-slate-500 text-slate-900 border-slate-200 shadow-slate-400/40";
      case 3:
        // Bronze - 3rd place
        return "bg-gradient-to-br from-orange-400 via-amber-600 to-orange-700 text-orange-950 border-orange-300 shadow-orange-500/40";
      default:
        // Generic - 4th and beyond
        return "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white border-slate-500 shadow-slate-600/40";
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
        {/* Header */}
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">
                  {tournament.source.name}
                </span>
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">
                {tournament.name}
              </h3>
            </div>

            {/* Country Flag */}
            {tournament.country && (
              <div className="ml-3 flex-shrink-0">
                <img
                  src={getFlagUrl(tournament.country) || ""}
                  alt={tournament.country}
                  className="h-6 w-8 rounded object-cover shadow-sm"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          {/* Tournament Info */}
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(tournament.eventDate)}</span>
            </div>
            {tournament.playerCount && (
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>{tournament.playerCount} jugadores</span>
              </div>
            )}
            {tournament.region && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>
                  {tournament.region}
                  {tournament.country ? ` · ${tournament.country}` : ""}
                </span>
              </div>
            )}
          </div>

          {/* Winner Banner */}
          {winner && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <div className="flex-1 flex flex-col">
                  <p className="text-xs text-amber-700/70">Campeón</p>
                  <p className="font-semibold text-amber-900">
                    {winner.playerName}
                  </p>
                  {winner.archetypeName && (
                    <p className="text-xs text-amber-700/70">
                      {winner.archetypeName}
                    </p>
                  )}
                </div>
                {winner.totalPrice && parseFloat(winner.totalPrice) > 0 && (
                  <div className="text-right flex flex-col">
                    <p className="text-xs text-amber-700/70">Deck Value</p>
                    <p className="font-bold text-amber-900">
                      ${winner.totalPrice}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Top 8 Collapsible */}
        <div className="p-4">
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mb-3 flex w-full items-center justify-between rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-left shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-amber-500" />
              <div>
                <h4 className="text-sm font-semibold text-white">
                  Top {topDecks.length}
                </h4>
                <p className="text-xs text-slate-300">
                  Toca para {isExpanded ? "ocultar" : "ver"} jugadores
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-slate-300 transition-transform duration-300 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Collapsible Content */}
          <div
            className={`grid gap-3 overflow-hidden transition-all duration-500 ease-in-out ${
              isExpanded
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0">
              <div className="grid grid-cols-2 gap-3 pb-1 sm:grid-cols-4">
                {topDecks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => handlePlayerClick(deck)}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-emerald-300 hover:shadow-md active:scale-[0.98]"
                  >
                    {/* Leader Card Image */}
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
                      <LazyImage
                        src={getLeaderImageSrc(deck.leaderCard)}
                        fallbackSrc="/images/card-back.png"
                        alt={deck.leaderCard?.name || "Leader"}
                        size="small"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {/* Standing Badge - Medal style */}
                      {deck.standing && (
                        <div className={`absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold shadow-lg ${getStandingBadgeStyle(deck.standing)}`}>
                          {deck.standing}
                        </div>
                      )}
                      {/* Color indicator */}
                      {deck.leaderCard?.colors &&
                        deck.leaderCard.colors.length > 0 && (
                          <div
                            className={`absolute bottom-0 left-0 right-0 h-1.5 ${getColorClass(
                              deck.leaderCard.colors
                            )}`}
                          />
                        )}
                    </div>

                    {/* Player Info */}
                    <div className="flex flex-1 flex-col p-2.5">
                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                        {deck.playerName}
                      </p>
                      {deck.archetypeName && (
                        <p className="line-clamp-1 text-xs text-slate-500">
                          {deck.archetypeName}
                        </p>
                      )}
                      {deck.totalPrice && parseFloat(deck.totalPrice) > 0 && (
                        <p className="mt-auto pt-1 text-sm font-bold text-emerald-600">
                          ${deck.totalPrice}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* View All Link */}
          <Link
            href={`/tournaments/${tournament.id}`}
            className="mt-4 block rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-emerald-700"
          >
            Ver resultados →
          </Link>
        </div>
      </div>

      {/* Deck Drawer */}
      {selectedDeck && (
        <DeckDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          playerName={selectedDeck.playerName}
          standing={selectedDeck.standing}
          archetypeName={selectedDeck.archetypeName}
          deck={selectedDeck.deck}
          leaderCard={selectedDeck.leaderCard}
          totalPrice={selectedDeck.totalPrice}
          tournamentName={tournament.name}
          deckSourceUrl={selectedDeck.deckSourceUrl}
        />
      )}
    </>
  );
};

export default TournamentCard;
