"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Calendar,
  Users,
  MapPin,
  ExternalLink,
  ArrowLeft,
  Award,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import DeckDrawer from "@/components/tournaments/DeckDrawer";
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
  country: string | null;
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

interface TournamentDetailClientProps {
  tournament: Tournament;
}

// Get flag image URL from country code
const getFlagUrl = (countryCode: string | null): string | null => {
  if (!countryCode) return null;
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
};

const TournamentDetailClient: React.FC<TournamentDetailClientProps> = ({
  tournament,
}) => {
  const [selectedDeck, setSelectedDeck] = useState<TournamentDeck | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const handlePlayerClick = (deck: TournamentDeck) => {
    setSelectedDeck(deck);
    setIsDrawerOpen(true);
  };

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

  // Calculate stats
  const archetypeStats = tournament.decks.reduce((map, deck) => {
    const key = deck.archetypeName || deck.leaderCard?.name || "Desconocido";
    const current = map.get(key) || { name: key, count: 0, wins: 0 };
    current.count += 1;
    if (deck.standing === 1) current.wins += 1;
    map.set(key, current);
    return map;
  }, new Map<string, { name: string; count: number; wins: number }>());

  const topArchetypes = Array.from(archetypeStats.values())
    .map((stat) => ({
      ...stat,
      winRate: stat.count > 0 ? (stat.wins / stat.count) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const averagePrice =
    tournament.decks.length > 0
      ? tournament.decks.reduce(
          (sum, deck) => sum + parseFloat(deck.totalPrice || "0"),
          0
        ) / tournament.decks.length
      : 0;

  const winner = tournament.decks.find((d) => d.standing === 1);

  return (
    <div className="min-h-screen bg-slate-50 w-full">
      {/* Header - Desktop only */}
      <div className="hidden border-b border-slate-200 bg-white/95 backdrop-blur md:block md:sticky md:top-0 md:z-20">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition-all hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a torneos</span>
          </Link>
        </div>
      </div>

      {/* Mobile Floating Back Button */}
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 md:hidden">
        <Link
          href="/tournaments"
          className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur-sm transition-all active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a torneos</span>
        </Link>
      </div>

      {/* Hero Section */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
          {/* Top row: Source badge + Flag */}
          <div className="flex items-start justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {tournament.source.name}
              </span>
              {tournament.format && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {tournament.format}
                </span>
              )}
            </div>

            {/* Country Flag */}
            {tournament.country && (
              <div className="flex-shrink-0">
                <img
                  src={getFlagUrl(tournament.country) || ""}
                  alt={tournament.country}
                  className="h-7 w-10 rounded object-cover shadow-sm"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <h1 className="mt-3 text-xl font-bold text-slate-900 sm:mt-4 sm:text-3xl lg:text-4xl">
            {tournament.name}
          </h1>

          {/* Tournament Info */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>{formatDate(tournament.eventDate)}</span>
            </div>
            {tournament.playerCount && (
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-400" />
                <span>{tournament.playerCount} jugadores</span>
              </div>
            )}
            {tournament.region && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>{tournament.region}</span>
              </div>
            )}
          </div>

          {/* Winner Banner - Amber style like TournamentCard */}
          {winner && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:mt-6">
              <div className="flex items-center gap-3">
                <Award className="h-6 w-6 flex-shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0 flex flex-col">
                  <p className="text-xs font-medium text-amber-700/70">
                    Campeón
                  </p>
                  <p className="truncate text-lg font-bold text-amber-900">
                    {winner.playerName}
                  </p>
                  {winner.archetypeName && (
                    <p className="truncate text-sm text-amber-700/80">
                      {winner.archetypeName}
                    </p>
                  )}
                </div>
                {winner.totalPrice && parseFloat(winner.totalPrice) > 0 && (
                  <div className="flex-shrink-0 text-right flex flex-col">
                    <p className="text-xs font-medium text-amber-700/70">
                      Deck Value
                    </p>
                    <p className="text-xl font-bold text-amber-900">
                      ${winner.totalPrice}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Decks</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {tournament.decks.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Leaders</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {archetypeStats.size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:pb-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Decks List */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                Todos los Decks
              </h2>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600">
                {tournament.decks.length} decks
              </span>
            </div>

            <div className="space-y-3">
              {tournament.decks.map((deck) => (
                <button
                  key={deck.id}
                  onClick={() => handlePlayerClick(deck)}
                  className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100 active:scale-[0.99] sm:p-4"
                >
                  <div className="flex items-center gap-3">
                    {/* Standing Badge */}
                    {deck.standing && (
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border sm:h-12 sm:w-12 ${
                          deck.standing === 1
                            ? "border-amber-200 bg-amber-100"
                            : deck.standing <= 3
                            ? "border-slate-300 bg-slate-100"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <span
                          className={`text-sm font-bold sm:text-base ${
                            deck.standing === 1
                              ? "text-amber-700"
                              : "text-slate-600"
                          }`}
                        >
                          #{deck.standing}
                        </span>
                      </div>
                    )}

                    {/* Leader Image */}
                    {deck.leaderCard && (
                      <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-lg shadow-md sm:h-16 sm:w-12">
                        <LazyImage
                          src={getLeaderImageSrc(deck.leaderCard)}
                          fallbackSrc="/images/card-back.png"
                          alt={deck.leaderCard.name}
                          size="small"
                          className="h-full w-full"
                        />
                        {deck.leaderCard.colors &&
                          deck.leaderCard.colors.length > 0 && (
                            <div
                              className={`absolute bottom-0 left-0 right-0 h-1 ${getColorClass(
                                deck.leaderCard.colors
                              )}`}
                            />
                          )}
                      </div>
                    )}

                    {/* Player Info */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <p className="truncate text-sm font-bold text-slate-900 sm:text-base">
                        {deck.playerName}
                      </p>
                      {deck.archetypeName && (
                        <p className="truncate text-xs text-emerald-600 sm:text-sm">
                          {deck.archetypeName}
                        </p>
                      )}
                      {deck.leaderCard && (
                        <p className="truncate text-xs text-slate-500">
                          {deck.leaderCard.name}
                        </p>
                      )}
                    </div>

                    {/* Price */}
                    {deck.totalPrice && parseFloat(deck.totalPrice) > 0 && (
                      <div className="flex-shrink-0 text-right flex flex-col">
                        <p className="text-xs text-slate-400">Precio</p>
                        <p className="text-base font-bold text-emerald-600 sm:text-lg">
                          ${deck.totalPrice}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar Stats - Hidden on mobile */}
          <div className="hidden space-y-6 lg:block">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Meta del Torneo
              </h3>
              <div className="space-y-4">
                {topArchetypes.map((archetype, index) => (
                  <div key={archetype.name}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium text-slate-800">
                          {archetype.name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {archetype.count}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.min(
                            (archetype.count / tournament.decks.length) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
    </div>
  );
};

export default TournamentDetailClient;
