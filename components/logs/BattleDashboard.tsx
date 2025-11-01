"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  Sword,
  Shield,
  BarChart3,
  GamepadIcon,
  Crown,
  Users,
  ChevronRight,
  ChevronDown,
  X,
  MessageSquare,
} from "lucide-react";
import { GameLog, GameLogStats, LeaderStats } from "@/types";
import { format } from "date-fns";
import { getColors } from "@/helpers/functions";
import Link from "next/link";

interface BattleDashboardProps {
  stats: GameLogStats | null;
  leaderStats: LeaderStats[];
  logs: GameLog[];
}

export function BattleDashboard({
  stats,
  leaderStats,
  logs,
}: BattleDashboardProps) {
  const [showAllOpponents, setShowAllOpponents] = useState(false);
  const [showAllLeaders, setShowAllLeaders] = useState(false);

  console.log("BattleDashboard props:", {
    stats: stats ? "Present" : "Missing",
    leaderStats: leaderStats ? `${leaderStats.length} items` : "Missing",
    logs: logs ? `${logs.length} items` : "Missing",
  });

  const recentBattles = logs?.slice(0, 4) || [];

  // Calcular estadísticas de primer/segundo jugador para la visualización
  const firstSecondStats = useMemo(() => {
    if (!stats)
      return {
        first: { wins: 0, total: 0, winRate: 0 },
        second: { wins: 0, total: 0, winRate: 0 },
      };

    return {
      first: {
        wins: stats.firstPlayerWins,
        total: stats.firstPlayerGames,
        winRate: stats.firstPlayerWinRate,
      },
      second: {
        wins: stats.secondPlayerWins,
        total: stats.secondPlayerGames,
        winRate: stats.secondPlayerWinRate,
      },
    };
  }, [stats]);

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <GamepadIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No hay datos disponibles</h3>
            <p className="text-muted-foreground">
              Registra algunas partidas para ver tus estadísticas aquí.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4 sm:pb-6">
        <CardTitle className="text-xl sm:text-2xl font-bold text-center flex items-center justify-center gap-2 sm:gap-3">
          <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
          Dashboard de Batallas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 sm:space-y-8">
        {/* Main Stats Grid - Responsivo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 sm:p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-start">
                <p className="text-blue-700 text-xs sm:text-sm font-medium">
                  Total
                </p>
                <p className="text-xl sm:text-2xl font-bold text-blue-900">
                  {stats.totalGames}
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
                  {stats.wins}
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
                  {stats.losses}
                </p>
                <p className="text-xs text-red-600 hidden sm:block">Perdidas</p>
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
                  {stats.winRate.toFixed(1)}%
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
          {/* Leader Performance - Scroll horizontal en móvil */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <h3 className="text-base sm:text-lg font-semibold">
                  Mis Líderes
                </h3>
              </div>
            </div>

            {leaderStats.length === 0 ? (
              <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg">
                <p className="text-muted-foreground text-sm">
                  No hay estadísticas de líderes disponibles
                </p>
              </div>
            ) : (
              <>
                {(() => {
                  // Agrupar estadísticas por código de líder
                  const leadersByCode = leaderStats.reduce(
                    (acc: any, leader) => {
                      // Buscar el líder en los logs para obtener el código
                      const leaderCard = logs
                        .find((log) =>
                          log.deck?.deckCards?.some(
                            (dc) =>
                              dc.card?.category === "Leader" &&
                              dc.card?.name === leader.leaderName
                          )
                        )
                        ?.deck?.deckCards?.find(
                          (dc) => dc.card?.category === "Leader"
                        )?.card;

                      const leaderCode =
                        (leaderCard as any)?.code || leader.leaderName;

                      if (!acc[leaderCode]) {
                        acc[leaderCode] = {
                          leaderName: leader.leaderName,
                          leaderSrc: leader.leaderSrc,
                          leaderCode: leaderCode,
                          totalGames: 0,
                          wins: 0,
                          decks: [],
                        };
                      }

                      acc[leaderCode].totalGames += leader.totalGames;
                      acc[leaderCode].wins += leader.wins;
                      acc[leaderCode].decks.push({
                        deckId: leader.deckId,
                        deckName: leader.deckName,
                        wins: leader.wins,
                        totalGames: leader.totalGames,
                        winRate: leader.winRate,
                      });

                      return acc;
                    },
                    {}
                  );

                  // Calcular win rate para cada líder agrupado
                  const groupedLeaders = Object.values(leadersByCode)
                    .map((leader: any) => ({
                      ...leader,
                      winRate:
                        leader.totalGames > 0
                          ? (leader.wins / leader.totalGames) * 100
                          : 0,
                    }))
                    .sort((a: any, b: any) => b.totalGames - a.totalGames);

                  return (
                    <>
                      {/* Móvil: Scroll horizontal */}
                      <div className="lg:hidden">
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                          {groupedLeaders.map((leader: any) => (
                            <div
                              key={leader.leaderCode}
                              className="bg-gray-50 rounded-lg p-3 min-w-[280px] border border-gray-200"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <img
                                  src={leader.leaderSrc}
                                  alt={leader.leaderName}
                                  className="w-8 h-12 object-cover rounded-lg shadow-sm flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="font-semibold text-gray-900 text-sm block truncate">
                                    {leader.leaderName}
                                  </span>
                                  <p className="text-xs text-gray-600 truncate">
                                    {leader.decks.length} deck
                                    {leader.decks.length !== 1 ? "s" : ""}
                                  </p>
                                </div>
                                <Badge
                                  variant={
                                    leader.winRate >= 50
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs font-semibold flex-shrink-0"
                                >
                                  {leader.winRate.toFixed(1)}%
                                </Badge>
                              </div>
                              <Progress
                                value={leader.winRate}
                                className="h-2 mb-2"
                              />
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-600">
                                  {leader.wins}W -{" "}
                                  {leader.totalGames - leader.wins}L (
                                  {leader.totalGames} partidas)
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  asChild
                                >
                                  <Link
                                    href={`/logs/leader/${leader.leaderCode}`}
                                  >
                                    Ver detalles
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Desktop: Layout vertical */}
                      <div className="hidden lg:block space-y-3">
                        {groupedLeaders
                          .slice(0, showAllLeaders ? groupedLeaders.length : 3)
                          .map((leader: any) => (
                            <div
                              key={leader.leaderCode}
                              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={leader.leaderSrc}
                                    alt={leader.leaderName}
                                    className="w-10 h-14 object-cover rounded-lg shadow-sm"
                                  />
                                  <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-gray-900">
                                      {leader.leaderName}
                                    </span>
                                    <p className="text-sm text-gray-600">
                                      {leader.decks.length} deck
                                      {leader.decks.length !== 1 ? "s" : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      leader.winRate >= 50
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="text-sm font-semibold"
                                  >
                                    {leader.winRate.toFixed(1)}%
                                  </Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    asChild
                                  >
                                    <Link
                                      href={`/logs/leader/${leader.leaderCode}`}
                                    >
                                      Ver detalles
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                              <Progress
                                value={leader.winRate}
                                className="h-2 mb-2"
                              />
                              <p className="text-sm text-gray-600">
                                {leader.wins}W -{" "}
                                {leader.totalGames - leader.wins}L (
                                {leader.totalGames} partidas)
                              </p>
                            </div>
                          ))}
                        {groupedLeaders.length > 3 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllLeaders(!showAllLeaders)}
                            className="w-full text-xs sm:text-sm"
                          >
                            {showAllLeaders ? (
                              <>
                                Mostrar menos{" "}
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </>
                            ) : (
                              <>
                                Ver todos los líderes ({groupedLeaders.length}){" "}
                                <ChevronRight className="w-3 h-3 ml-1" />
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>

          {/* Análisis de Oponentes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                <h3 className="text-base sm:text-lg font-semibold">
                  Análisis de Oponentes
                </h3>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg">
                <p className="text-muted-foreground text-sm">
                  No hay datos de oponentes disponibles
                </p>
              </div>
            ) : (
              <>
                {(() => {
                  const opponentCounts = logs.reduce((acc: any, log) => {
                    const opponentId = log.opponentLeader?.id;
                    const opponentName =
                      log.opponentLeader?.name || "Desconocido";
                    if (opponentId) {
                      if (!acc[opponentId]) {
                        acc[opponentId] = {
                          name: opponentName,
                          src: log.opponentLeader?.src,
                          total: 0,
                          wins: 0,
                        };
                      }
                      acc[opponentId].total++;
                      if (log.isWin) acc[opponentId].wins++;
                    }
                    return acc;
                  }, {});

                  const topOpponents = Object.values(opponentCounts).sort(
                    (a: any, b: any) => b.total - a.total
                  );

                  return topOpponents.length > 0 ? (
                    <>
                      {/* Móvil: Scroll horizontal */}
                      <div className="lg:hidden">
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                          {topOpponents.map((opponent: any, index) => (
                            <div
                              key={index}
                              className="bg-gray-50 rounded-lg p-3 min-w-[280px] border border-gray-200"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <img
                                  src={opponent.src || "/placeholder.svg"}
                                  alt={opponent.name}
                                  className="w-8 h-12 object-cover rounded-lg shadow-sm flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="font-semibold text-gray-900 text-sm block truncate">
                                    {opponent.name}
                                  </span>
                                  <p className="text-xs text-gray-600 truncate">
                                    {opponent.total} enfrentamientos
                                  </p>
                                </div>
                                <Badge
                                  variant={
                                    (opponent.wins / opponent.total) * 100 >= 50
                                      ? "default"
                                      : "destructive"
                                  }
                                  className="text-xs font-semibold flex-shrink-0"
                                >
                                  {(
                                    (opponent.wins / opponent.total) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </Badge>
                              </div>
                              <Progress
                                value={(opponent.wins / opponent.total) * 100}
                                className="h-2 mb-2"
                              />
                              <div className="flex flex-col gap-1">
                                <p className="text-xs text-gray-600">
                                  {opponent.wins}W -{" "}
                                  {opponent.total - opponent.wins}L (
                                  {opponent.total} partidas)
                                </p>
                                {opponent.total >= 3 && (
                                  <span
                                    className={`text-xs ${
                                      (opponent.wins / opponent.total) * 100 >=
                                      60
                                        ? "text-green-600"
                                        : (opponent.wins / opponent.total) *
                                            100 <=
                                          40
                                        ? "text-red-600"
                                        : "text-yellow-600"
                                    }`}
                                  >
                                    {(opponent.wins / opponent.total) * 100 >=
                                    60
                                      ? "• Dominas"
                                      : (opponent.wins / opponent.total) *
                                          100 <=
                                        40
                                      ? "• Difícil"
                                      : "• Equilibrado"}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Desktop: Layout vertical */}
                      <div className="hidden lg:block space-y-3">
                        {topOpponents
                          .slice(0, showAllOpponents ? topOpponents.length : 3)
                          .map((opponent: any, index) => (
                            <div
                              key={index}
                              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={opponent.src || "/placeholder.svg"}
                                    alt={opponent.name}
                                    className="w-10 h-14 object-cover rounded-lg shadow-sm"
                                  />
                                  <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-gray-900">
                                      {opponent.name}
                                    </span>
                                    <p className="text-sm text-gray-600">
                                      {opponent.total} enfrentamientos
                                    </p>
                                  </div>
                                </div>
                                <Badge
                                  variant={
                                    (opponent.wins / opponent.total) * 100 >= 50
                                      ? "default"
                                      : "destructive"
                                  }
                                  className="text-sm font-semibold"
                                >
                                  {(
                                    (opponent.wins / opponent.total) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </Badge>
                              </div>
                              <Progress
                                value={(opponent.wins / opponent.total) * 100}
                                className="h-2 mb-2"
                              />
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <p className="text-sm text-gray-600">
                                  {opponent.wins}W -{" "}
                                  {opponent.total - opponent.wins}L (
                                  {opponent.total} partidas)
                                </p>
                                {opponent.total >= 3 && (
                                  <span
                                    className={`text-sm ${
                                      (opponent.wins / opponent.total) * 100 >=
                                      60
                                        ? "text-green-600"
                                        : (opponent.wins / opponent.total) *
                                            100 <=
                                          40
                                        ? "text-red-600"
                                        : "text-yellow-600"
                                    }`}
                                  >
                                    {(opponent.wins / opponent.total) * 100 >=
                                    60
                                      ? "• Dominas"
                                      : (opponent.wins / opponent.total) *
                                          100 <=
                                        40
                                      ? "• Difícil"
                                      : "• Equilibrado"}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        {topOpponents.length > 3 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setShowAllOpponents(!showAllOpponents)
                            }
                            className="w-full text-xs sm:text-sm"
                          >
                            {showAllOpponents ? (
                              <>
                                Mostrar menos{" "}
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </>
                            ) : (
                              <>
                                Ver todos los oponentes ({topOpponents.length}){" "}
                                <ChevronRight className="w-3 h-3 ml-1" />
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg">
                      <p className="text-muted-foreground text-sm">
                        Registra más partidas para ver análisis de oponentes
                      </p>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Recent Battles - Mismo estilo que Historial de Batallas */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            <h3 className="text-base sm:text-lg font-semibold">
              Batallas Recientes
            </h3>
          </div>

          {recentBattles.length === 0 ? (
            <div className="text-center py-16">
              <GamepadIcon className="h-20 w-20 text-muted-foreground mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-2">
                No hay partidas aún
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Comienza registrando tu primera partida para ver tu historial de
                batallas aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {recentBattles.map((battle) => {
                const deckLeader = battle.deck?.deckCards?.find(
                  (dc) => dc.card?.category === "Leader"
                )?.card;

                return (
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

                        {battle.comments && (
                          <div className="p-1 bg-gray-200 rounded-full">
                            <MessageSquare className="h-3 w-3 text-gray-600" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contenido principal responsivo */}
                    <div className="p-3 sm:p-4">
                      {/* Layout móvil: vertical, Desktop: horizontal */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        {/* Mi Deck */}
                        <div className="flex items-center gap-3 flex-1 min-w-0 bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="w-12 h-16 sm:w-14 sm:h-18 rounded-lg overflow-hidden shadow-md flex-shrink-0 ring-2 ring-gray-300">
                            {deckLeader?.src ? (
                              <img
                                src={deckLeader.src}
                                alt={deckLeader.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-500 to-gray-600 text-white">
                                <span className="font-bold text-sm">
                                  {battle.deck?.name?.substring(0, 2) || "??"}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-700 bg-gray-200 px-2 py-0.5 rounded-full">
                                MI DECK
                              </span>
                              <div className="flex gap-1">
                                {deckLeader?.colors
                                  ?.slice(0, 3)
                                  .map((color: any, index: number) => (
                                    <div
                                      key={index}
                                      className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                                      style={{
                                        backgroundColor: getColors(color.color),
                                      }}
                                      title={color.color}
                                    />
                                  ))}
                              </div>
                            </div>
                            <h5 className="font-bold text-sm sm:text-base text-gray-900 truncate leading-tight">
                              {battle.deck?.name || "Deck Desconocido"}
                            </h5>
                            <p className="text-xs text-gray-600 truncate">
                              {deckLeader?.name || "Sin líder"}
                            </p>
                          </div>
                        </div>

                        {/* VS - Solo en desktop */}
                        <div className="hidden sm:flex items-center justify-center px-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm border border-gray-300">
                            <Sword className="h-5 w-5 text-gray-600" />
                          </div>
                        </div>

                        {/* Separador en móvil */}
                        <div className="sm:hidden flex items-center justify-center py-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm border border-gray-300">
                            <Sword className="h-4 w-4 text-gray-600" />
                          </div>
                        </div>

                        {/* Oponente */}
                        <div className="flex items-center gap-3 flex-1 min-w-0 bg-gray-100 rounded-lg p-3 border border-gray-300">
                          <div className="w-12 h-16 sm:w-14 sm:h-18 rounded-lg overflow-hidden shadow-md flex-shrink-0 ring-2 ring-gray-400">
                            {battle.opponentLeader?.src ? (
                              <img
                                src={battle.opponentLeader.src}
                                alt={battle.opponentLeader.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-600 to-gray-700 text-white">
                                <span className="font-bold text-sm">??</span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-700 bg-gray-300 px-2 py-0.5 rounded-full">
                                OPONENTE
                              </span>
                              <div className="flex gap-1">
                                {battle.opponentLeader?.colors
                                  ?.slice(0, 3)
                                  .map((color: any, index: number) => (
                                    <div
                                      key={index}
                                      className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                                      style={{
                                        backgroundColor: getColors(color.color),
                                      }}
                                      title={color.color}
                                    />
                                  ))}
                              </div>
                            </div>
                            <h5 className="font-bold text-sm sm:text-base text-gray-900 truncate leading-tight">
                              {battle.opponentLeader?.name ||
                                "Líder Desconocido"}
                            </h5>
                            {battle.opponentName ? (
                              <p className="text-xs text-gray-600 font-medium truncate">
                                vs {battle.opponentName}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-600 truncate">
                                Jugador anónimo
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Comentarios compactos */}
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
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
