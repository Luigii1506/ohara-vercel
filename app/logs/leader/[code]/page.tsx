"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  Shield,
  Sword,
  BarChart3,
  Crown,
  Users,
  Calendar,
  MessageSquare,
  Eye,
  GamepadIcon,
  Swords,
  X,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { GameLog, Deck, Card as CardType, LeaderStats } from "@/types";
import { format } from "date-fns";
import { getColors } from "@/helpers/functions";
import Link from "next/link";

interface LeaderDetailStats {
  leaderName: string;
  leaderSrc: string;
  leaderCode: string;
  totalGames: number;
  wins: number;
  winRate: number;
  decks: {
    deckId: number;
    deckName: string;
    wins: number;
    totalGames: number;
    winRate: number;
    deckCards?: any[];
  }[];
  opponentMatchups: {
    opponentName: string;
    opponentSrc: string;
    wins: number;
    total: number;
    winRate: number;
    firstPlayerWins: number;
    firstPlayerTotal: number;
    secondPlayerWins: number;
    secondPlayerTotal: number;
  }[];
  cardPerformance: {
    cardId: number;
    cardName: string;
    cardSrc: string;
    winsWithCard: number;
    totalGamesWithCard: number;
    winRateWithCard: number;
  }[];
  recentBattles: GameLog[];
  firstPlayerStats: {
    wins: number;
    total: number;
    winRate: number;
  };
  secondPlayerStats: {
    wins: number;
    total: number;
    winRate: number;
  };
}

export default function LeaderDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const leaderCode = params.code as string;

  const [leaderStats, setLeaderStats] = useState<LeaderDetailStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [showAllDecks, setShowAllDecks] = useState(false);
  const [showAllMatchups, setShowAllMatchups] = useState(false);
  const [showAllCards, setShowAllCards] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<any>(null);
  const [showDeckModal, setShowDeckModal] = useState(false);

  useEffect(() => {
    if (session?.user?.id && leaderCode) {
      loadLeaderStats();
    }
  }, [session, leaderCode]);

  const loadLeaderStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/logs/leader/${leaderCode}`);
      if (response.ok) {
        const data = await response.json();
        setLeaderStats(data);
      } else {
        console.error("Error fetching leader stats:", response.status);
      }
    } catch (error) {
      console.error("Error loading leader stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique cards from deck with their counts
  const getDeckCardCounts = (deckCards: any[]) => {
    const cardCounts: Record<string, { card: any; count: number }> = {};

    deckCards?.forEach((deckCard) => {
      const cardId = deckCard.cardId.toString();
      if (cardCounts[cardId]) {
        cardCounts[cardId].count += deckCard.quantity;
      } else {
        cardCounts[cardId] = {
          card: deckCard.card,
          count: deckCard.quantity,
        };
      }
    });

    return Object.values(cardCounts).filter(
      (item) => item.card.category !== "Leader"
    );
  };

  if (!session?.user?.id) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acceso Requerido</CardTitle>
            <CardDescription>
              Debes iniciar sesión para acceder a las estadísticas de líderes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8 w-full">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!leaderStats) {
    return (
      <div className="container mx-auto px-4 py-8 w-full">
        <div className="text-center py-16">
          <GamepadIcon className="h-20 w-20 text-muted-foreground mx-auto mb-6" />
          <h3 className="text-xl font-semibold mb-2">Líder no encontrado</h3>
          <p className="text-muted-foreground mb-8">
            No se encontraron estadísticas para este líder.
          </p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 w-full">
      <Card className="max-w-none shadow-lg">
        <CardHeader className="pb-4 sm:pb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-4">
              <img
                src={leaderStats.leaderSrc}
                alt={leaderStats.leaderName}
                className="w-16 h-20 object-cover rounded-lg shadow-lg"
              />
              <div>
                <CardTitle className="text-2xl sm:text-3xl font-bold">
                  {leaderStats.leaderName}
                </CardTitle>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 sm:space-y-8">
          {/* Main Stats Grid - Mismo estilo que BattleDashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <p className="text-blue-700 text-xs sm:text-sm font-medium">
                    Total
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-900">
                    {leaderStats.totalGames}
                  </p>
                  <p className="text-xs text-blue-600 hidden sm:block">
                    Partidas
                  </p>
                </div>
                <Target className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 sm:p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <p className="text-green-700 text-xs sm:text-sm font-medium">
                    Victorias
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-green-900">
                    {leaderStats.wins}
                  </p>
                  <p className="text-xs text-green-600 hidden sm:block">
                    Ganadas
                  </p>
                </div>
                <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-3 sm:p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <p className="text-red-700 text-xs sm:text-sm font-medium">
                    Derrotas
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-red-900">
                    {leaderStats.totalGames - leaderStats.wins}
                  </p>
                  <p className="text-xs text-red-600 hidden sm:block">
                    Perdidas
                  </p>
                </div>
                <Sword className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-3 sm:p-4 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <p className="text-yellow-700 text-xs sm:text-sm font-medium">
                    Win Rate
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-yellow-900">
                    {leaderStats.winRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-yellow-600 hidden sm:block">
                    Efectividad
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Detailed Stats - Layout responsivo */}
          <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8">
            {/* Mis Decks */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  <h3 className="text-base sm:text-lg font-semibold">
                    Mis Decks con {leaderStats.leaderName}
                  </h3>
                </div>
              </div>

              {leaderStats.decks.length === 0 ? (
                <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg">
                  <p className="text-muted-foreground text-sm">
                    No hay decks disponibles
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderStats.decks
                    .slice(0, showAllDecks ? leaderStats.decks.length : 3)
                    .map((deck) => (
                      <div
                        key={deck.deckId}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-gray-900">
                                {deck.deckName}
                              </span>
                              <p className="text-sm text-gray-600">
                                {deck.totalGames} partidas
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                deck.winRate >= 50 ? "default" : "secondary"
                              }
                              className="text-sm font-semibold"
                            >
                              {deck.winRate.toFixed(1)}%
                            </Badge>
                            {deck.deckCards && (
                              <Dialog
                                open={
                                  showDeckModal &&
                                  selectedDeck?.deckId === deck.deckId
                                }
                                onOpenChange={setShowDeckModal}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedDeck(deck);
                                      setShowDeckModal(true);
                                    }}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>
                                      {deck.deckName} - Cartas
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                                    {getDeckCardCounts(
                                      deck.deckCards || []
                                    ).map(({ card, count }) => (
                                      <div key={card.id} className="relative">
                                        <div className="aspect-[2.5/3.5] bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-md">
                                          {card.src ? (
                                            <img
                                              src={card.src}
                                              alt={card.name}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                                              <div className="text-center p-2">
                                                <p className="font-bold text-sm">
                                                  {card.name}
                                                </p>
                                                <p className="text-xs opacity-90">
                                                  {card.category}
                                                </p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                          {count}
                                        </div>
                                        <div className="mt-2 text-center">
                                          <p className="text-xs font-medium truncate">
                                            {card.name}
                                          </p>
                                          <div className="flex justify-center gap-1 mt-1">
                                            <Badge
                                              variant="outline"
                                              className="text-xs px-1"
                                            >
                                              {card.cost}
                                            </Badge>
                                            {card.colors?.map(
                                              (color: any, index: number) => (
                                                <Badge
                                                  key={index}
                                                  variant="secondary"
                                                  className="text-xs px-1"
                                                >
                                                  {color.color}
                                                </Badge>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </div>
                        <Progress value={deck.winRate} className="h-2 mb-2" />
                        <p className="text-sm text-gray-600">
                          {deck.wins}W - {deck.totalGames - deck.wins}L
                        </p>
                      </div>
                    ))}
                  {leaderStats.decks.length > 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllDecks(!showAllDecks)}
                      className="w-full text-xs sm:text-sm"
                    >
                      {showAllDecks ? (
                        <>
                          Mostrar menos <ChevronDown className="w-3 h-3 ml-1" />
                        </>
                      ) : (
                        <>
                          Ver todos los decks ({leaderStats.decks.length}){" "}
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Matchups vs Oponentes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  <h3 className="text-base sm:text-lg font-semibold">
                    Matchups vs Oponentes
                  </h3>
                </div>
              </div>

              {leaderStats.opponentMatchups.length === 0 ? (
                <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg">
                  <p className="text-muted-foreground text-sm">
                    No hay suficientes datos de matchups
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderStats.opponentMatchups
                    .slice(
                      0,
                      showAllMatchups ? leaderStats.opponentMatchups.length : 3
                    )
                    .map((matchup, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-3">
                            <img
                              src={matchup.opponentSrc}
                              alt={matchup.opponentName}
                              className="w-10 h-14 object-cover rounded-lg shadow-sm"
                            />
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-gray-900">
                                {matchup.opponentName}
                              </span>
                              <p className="text-sm text-gray-600">
                                {matchup.total} enfrentamientos
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              matchup.winRate >= 60
                                ? "default"
                                : matchup.winRate <= 40
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-sm font-semibold"
                          >
                            {matchup.winRate.toFixed(1)}%
                          </Badge>
                        </div>
                        <Progress
                          value={matchup.winRate}
                          className="h-2 mb-2"
                        />
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                            <div className="flex items-center gap-1 mb-1">
                              <Crown className="h-3 w-3 text-yellow-600" />
                              <span className="font-medium text-yellow-700">
                                1º Jugador
                              </span>
                            </div>
                            <p className="text-yellow-800">
                              {matchup.firstPlayerTotal > 0 ? (
                                <>
                                  {matchup.firstPlayerWins}W -{" "}
                                  {matchup.firstPlayerTotal -
                                    matchup.firstPlayerWins}
                                  L
                                  <span className="block">
                                    (
                                    {(
                                      (matchup.firstPlayerWins /
                                        matchup.firstPlayerTotal) *
                                      100
                                    ).toFixed(1)}
                                    %)
                                  </span>
                                </>
                              ) : (
                                "Sin datos"
                              )}
                            </p>
                          </div>
                          <div className="bg-blue-50 p-2 rounded border border-blue-200">
                            <div className="flex items-center gap-1 mb-1">
                              <Users className="h-3 w-3 text-blue-600" />
                              <span className="font-medium text-blue-700">
                                2º Jugador
                              </span>
                            </div>
                            <p className="text-blue-800">
                              {matchup.secondPlayerTotal > 0 ? (
                                <>
                                  {matchup.secondPlayerWins}W -{" "}
                                  {matchup.secondPlayerTotal -
                                    matchup.secondPlayerWins}
                                  L
                                  <span className="block">
                                    (
                                    {(
                                      (matchup.secondPlayerWins /
                                        matchup.secondPlayerTotal) *
                                      100
                                    ).toFixed(1)}
                                    %)
                                  </span>
                                </>
                              ) : (
                                "Sin datos"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  {leaderStats.opponentMatchups.length > 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllMatchups(!showAllMatchups)}
                      className="w-full text-xs sm:text-sm"
                    >
                      {showAllMatchups ? (
                        <>
                          Mostrar menos <ChevronDown className="w-3 h-3 ml-1" />
                        </>
                      ) : (
                        <>
                          Ver todos los matchups (
                          {leaderStats.opponentMatchups.length}){" "}
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Turn Order Analysis */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              <h3 className="text-base sm:text-lg font-semibold">
                Análisis de Orden de Turno
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-600" />
                  <h4 className="font-semibold">Jugando Primero</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Win Rate:</span>
                    <span className="font-semibold">
                      {leaderStats.firstPlayerStats.winRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={leaderStats.firstPlayerStats.winRate} />
                  <p className="text-sm text-muted-foreground">
                    {leaderStats.firstPlayerStats.wins}W -{" "}
                    {leaderStats.firstPlayerStats.total -
                      leaderStats.firstPlayerStats.wins}
                    L ({leaderStats.firstPlayerStats.total} partidas)
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h4 className="font-semibold">Jugando Segundo</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Win Rate:</span>
                    <span className="font-semibold">
                      {leaderStats.secondPlayerStats.winRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={leaderStats.secondPlayerStats.winRate} />
                  <p className="text-sm text-muted-foreground">
                    {leaderStats.secondPlayerStats.wins}W -{" "}
                    {leaderStats.secondPlayerStats.total -
                      leaderStats.secondPlayerStats.wins}
                    L ({leaderStats.secondPlayerStats.total} partidas)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Card Performance */}
          {leaderStats.cardPerformance.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                <h3 className="text-base sm:text-lg font-semibold">
                  Rendimiento de Cartas
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {leaderStats.cardPerformance
                  .slice(
                    0,
                    showAllCards ? leaderStats.cardPerformance.length : 5
                  )
                  .map((card) => (
                    <div
                      key={card.cardId}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <img
                            src={card.cardSrc}
                            alt={card.cardName}
                            className="w-8 h-12 object-cover rounded shadow-sm"
                          />
                          <div>
                            <span className="font-semibold text-gray-900">
                              {card.cardName}
                            </span>
                            <p className="text-sm text-gray-600">
                              {card.totalGamesWithCard} partidas
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              card.winRateWithCard >= 60
                                ? "default"
                                : card.winRateWithCard <= 40
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-sm font-semibold"
                          >
                            {card.winRateWithCard.toFixed(1)}%
                          </Badge>
                          {card.winRateWithCard >= 60 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : card.winRateWithCard <= 40 ? (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          ) : null}
                        </div>
                      </div>
                      <Progress
                        value={card.winRateWithCard}
                        className="h-2 mb-2"
                      />
                      <p className="text-sm text-gray-600">
                        {card.winsWithCard}W -{" "}
                        {card.totalGamesWithCard - card.winsWithCard}L
                      </p>
                    </div>
                  ))}
                {leaderStats.cardPerformance.length > 5 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllCards(!showAllCards)}
                    className="w-full text-xs sm:text-sm"
                  >
                    {showAllCards ? (
                      <>
                        Mostrar menos <ChevronDown className="w-3 h-3 ml-1" />
                      </>
                    ) : (
                      <>
                        Ver todas las cartas (
                        {leaderStats.cardPerformance.length}){" "}
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Recent Battles */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              <h3 className="text-base sm:text-lg font-semibold">
                Batallas Recientes
              </h3>
            </div>

            {leaderStats.recentBattles.length === 0 ? (
              <div className="text-center py-16">
                <GamepadIcon className="h-20 w-20 text-muted-foreground mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-2">
                  No hay batallas recientes
                </h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  No se encontraron batallas recientes con este líder.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {leaderStats.recentBattles.slice(0, 6).map((battle) => (
                  <div
                    key={battle.id}
                    className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden"
                  >
                    {/* Header compacto con resultado y fecha */}
                    <div
                      className={`px-3 sm:px-4 py-3 flex items-center justify-between ${
                        battle.isWin
                          ? "bg-green-50 border-b border-green-100"
                          : "bg-red-50 border-b border-red-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div
                          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            battle.isWin ? "bg-green-500" : "bg-red-500"
                          }`}
                        >
                          {battle.isWin ? (
                            <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                          ) : (
                            <X className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span
                            className={`font-bold text-xs sm:text-sm ${
                              battle.isWin ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {battle.isWin ? "VICTORIA" : "DERROTA"}
                          </span>
                          <div className="text-xs text-gray-500 truncate">
                            {format(
                              new Date(battle.playedAt),
                              "dd/MM/yyyy HH:mm"
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        {/* Orden de turno neutro */}
                        <div
                          className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
                            battle.wentFirst
                              ? "bg-gray-200 text-gray-700 border border-gray-300"
                              : "bg-gray-300 text-gray-800 border border-gray-400"
                          }`}
                        >
                          {battle.wentFirst ? (
                            <>
                              <Crown className="h-3 w-3 mr-1 inline" />
                              <span className="hidden xs:inline">1º</span>
                              <span className="xs:hidden">1</span>
                            </>
                          ) : (
                            <>
                              <Users className="h-3 w-3 mr-1 inline" />
                              <span className="hidden xs:inline">2º</span>
                              <span className="xs:hidden">2</span>
                            </>
                          )}
                        </div>

                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/logs/${battle.id}`}>
                            <Eye className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {battle.deck?.name}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          vs {battle.opponentLeader?.name}
                        </span>
                      </div>
                      {battle.opponentName && (
                        <p className="text-xs text-gray-600 mb-2">
                          Oponente: {battle.opponentName}
                        </p>
                      )}
                      {battle.comments && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                            <p className="text-xs sm:text-sm text-gray-700 line-clamp-2">
                              {battle.comments}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
