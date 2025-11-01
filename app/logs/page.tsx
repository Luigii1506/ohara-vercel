"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  MessageSquare,
  Eye,
  Trash2,
  BarChart3,
  Crown,
  Shuffle,
  Clock,
  Medal,
  GamepadIcon,
  Swords,
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowRight,
  X,
  Minus,
} from "lucide-react";
import {
  GameLog,
  Deck,
  Card as CardType,
  GameLogStats,
  LeaderStats,
  OpponentLeaderStats,
} from "@/types";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import { getColors } from "@/helpers/functions";
import { format } from "date-fns";
import Link from "next/link";
import { BattleDashboard } from "@/components/logs/BattleDashboard";

// Componente para formulario completo basado en NewBattleForm
const GameLogForm = ({
  decks,
  leaders,
  onBack,
  onSubmit,
}: {
  decks: Deck[];
  leaders: CardType[];
  onBack: () => void;
  onSubmit: (data: any) => void;
}) => {
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [opponentName, setOpponentName] = useState("");
  const [opponentLeader, setOpponentLeader] = useState("");
  const [goFirst, setGoFirst] = useState<boolean | null>(null);
  const [result, setResult] = useState<"win" | "loss" | null>(null);
  const [finalHand, setFinalHand] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [cardSearch, setCardSearch] = useState("");
  const [leaderSearch, setLeaderSearch] = useState("");

  // Get unique cards from deck with their counts
  const getDeckCardCounts = (deck: Deck) => {
    const cardCounts: Record<string, { card: CardType; count: number }> = {};

    deck.deckCards?.forEach((deckCard) => {
      const cardId = deckCard.cardId.toString();
      if (cardCounts[cardId]) {
        cardCounts[cardId].count += deckCard.quantity;
      } else {
        cardCounts[cardId] = {
          card: deckCard.card!,
          count: deckCard.quantity,
        };
      }
    });

    return Object.values(cardCounts).filter(
      (item) => item.card.category !== "Leader"
    );
  };

  const handleCardCountChange = (cardId: string, newCount: number) => {
    const totalCards = Object.values(finalHand).reduce(
      (sum, count) => sum + count,
      0
    );
    const currentCount = finalHand[cardId] || 0;
    const countDifference = newCount - currentCount;

    // Check if adding cards would exceed 5 total
    if (totalCards + countDifference > 5) {
      return;
    }

    if (newCount === 0) {
      setFinalHand((prev) => {
        const newHand = { ...prev };
        delete newHand[cardId];
        return newHand;
      });
    } else {
      setFinalHand((prev) => ({
        ...prev,
        [cardId]: newCount,
      }));
    }
  };

  const getCardCount = (cardId: string) => {
    return finalHand[cardId] || 0;
  };

  const getTotalSelectedCards = () => {
    return Object.values(finalHand).reduce((sum, count) => sum + count, 0);
  };

  const handleSubmit = () => {
    if (!selectedDeck || !opponentLeader || goFirst === null || !result) {
      return;
    }

    const battleData = {
      deckId: selectedDeck.id,
      opponentLeaderId: opponentLeader,
      opponentName,
      isWin: result === "win" ? "true" : "false",
      wentFirst: goFirst ? "true" : "false",
      comments,
      finalHand,
      playedAt: new Date().toISOString(),
    };

    onSubmit(battleData);
  };

  const filteredCards = selectedDeck
    ? getDeckCardCounts(selectedDeck).filter(({ card }) =>
        card.name.toLowerCase().includes(cardSearch.toLowerCase())
      )
    : [];

  const canSubmit =
    selectedDeck && opponentLeader && goFirst !== null && result !== null;

  const getLeaderCard = (deck: Deck) => {
    return deck.deckCards?.find((dc) => dc.card?.category === "Leader")?.card;
  };

  // Filter leaders based on search
  const filteredLeaders = leaders.filter((leader) =>
    leader.name.toLowerCase().includes(leaderSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen p-4 w-full">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Registrar Partida
            </h1>
            <p className="text-gray-600">
              Registra los resultados de tu partida
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Deck Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seleccionar Deck</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {decks.map((deck) => {
                  const leader = getLeaderCard(deck);
                  return (
                    <div
                      key={deck.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        selectedDeck?.id === deck.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedDeck(deck)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Deck Leader Image */}
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0">
                            {leader?.src ? (
                              <img
                                src={leader.src}
                                alt={leader.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                                {deck.name
                                  .split(" ")
                                  .map((word) => word[0])
                                  .join("")}
                              </div>
                            )}
                          </div>

                          <div>
                            <h3 className="font-semibold text-lg">
                              {deck.name}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                              Leader: {leader?.name || "Sin líder"}
                            </p>
                            <div className="flex gap-1">
                              {leader?.colors?.map(
                                (color: any, index: number) => (
                                  <Badge
                                    key={index}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {color.color}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        </div>

                        <Dialog
                          open={showDeckModal && selectedDeck?.id === deck.id}
                          onOpenChange={setShowDeckModal}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDeck(deck);
                                setShowDeckModal(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{deck.name} - Cartas</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                              {getDeckCardCounts(deck).map(
                                ({ card, count }) => (
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
                                )
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Final Hand Selection */}
          {selectedDeck && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Mano Final ({getTotalSelectedCards()}/5) - Opcional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <div className="h-5 w-5 text-gray-400">🔍</div>
                  </div>
                  <Input
                    placeholder="Buscar cartas..."
                    value={cardSearch}
                    onChange={(e) => setCardSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto">
                  {filteredCards.map(({ card, count: deckCount }) => {
                    const selectedCount = getCardCount(card.id.toString());
                    const maxSelectable = Math.min(
                      deckCount,
                      5 - getTotalSelectedCards() + selectedCount
                    );

                    return (
                      <div
                        key={card.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:border-gray-300 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{card.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {card.cost}
                            </Badge>
                            {card.colors?.map((color: any, index: number) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="text-xs"
                              >
                                {color.color}
                              </Badge>
                            ))}
                            <Badge variant="outline" className="text-xs">
                              x{deckCount}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {card.category}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleCardCountChange(
                                card.id.toString(),
                                Math.max(0, selectedCount - 1)
                              )
                            }
                            disabled={selectedCount === 0}
                            className="w-8 h-8 p-0"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>

                          <span className="w-8 text-center font-medium">
                            {selectedCount}
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleCardCountChange(
                                card.id.toString(),
                                selectedCount + 1
                              )
                            }
                            disabled={selectedCount >= maxSelectable}
                            className="w-8 h-8 p-0"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Cards Summary */}
                {Object.keys(finalHand).length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium mb-2">
                      Cartas Seleccionadas:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(finalHand).map(([cardId, count]) => {
                        const card = selectedDeck.deckCards?.find(
                          (dc) => dc.cardId.toString() === cardId
                        )?.card;
                        return card ? (
                          <Badge
                            key={cardId}
                            variant="default"
                            className="flex items-center gap-1"
                          >
                            {card.name} x{count}
                            <X
                              className="w-3 h-3 cursor-pointer"
                              onClick={() => handleCardCountChange(cardId, 0)}
                            />
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Battle Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalles de la Partida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Opponent */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="opponent-name">Nombre del Oponente</Label>
                  <Input
                    id="opponent-name"
                    placeholder="Ingresa el nombre del oponente (opcional)"
                    value={opponentName}
                    onChange={(e) => setOpponentName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Líder Oponente</Label>
                  <Select
                    value={opponentLeader}
                    onValueChange={setOpponentLeader}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el líder oponente" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <div className="p-2 border-b">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <div className="h-4 w-4 text-gray-400">🔍</div>
                          </div>
                          <Input
                            placeholder="Buscar líder..."
                            value={leaderSearch}
                            onChange={(e) => setLeaderSearch(e.target.value)}
                            className="pl-10 h-8"
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredLeaders.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            No se encontraron líderes con "{leaderSearch}"
                          </div>
                        ) : (
                          filteredLeaders.map((leader) => (
                            <SelectItem
                              key={leader.id}
                              value={leader.id.toString()}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-md overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0">
                                  <img
                                    src={leader.src}
                                    alt={leader.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>{leader.name}</span>
                                  <div className="flex gap-1">
                                    {leader.colors?.map(
                                      (color: any, index: number) => (
                                        <div
                                          key={index}
                                          className="w-3 h-3 rounded-full border border-gray-300"
                                          style={{
                                            backgroundColor: getColors(
                                              color.color
                                            ),
                                          }}
                                        />
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected Leader Display */}
                {opponentLeader && (
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-4">
                      {(() => {
                        const leader = leaders.find(
                          (l) => l.id.toString() === opponentLeader
                        );
                        return leader ? (
                          <>
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0">
                              <img
                                src={leader.src}
                                alt={leader.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">
                                {leader.name}
                              </h3>
                              <div className="flex gap-2 mt-1">
                                {leader.colors?.map(
                                  (color: any, index: number) => (
                                    <Badge
                                      key={index}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {color.color}
                                    </Badge>
                                  )
                                )}
                              </div>
                            </div>
                          </>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Turn Order */}
              <div className="space-y-3">
                <Label>Orden de Turno</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={goFirst === true ? "default" : "outline"}
                    onClick={() => setGoFirst(true)}
                    className={`h-12 ${
                      goFirst === true ? "bg-blue-600 hover:bg-blue-700" : ""
                    }`}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Primero
                  </Button>
                  <Button
                    variant={goFirst === false ? "default" : "outline"}
                    onClick={() => setGoFirst(false)}
                    className={`h-12 ${
                      goFirst === false
                        ? "bg-orange-600 hover:bg-orange-700"
                        : ""
                    }`}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Segundo
                  </Button>
                </div>
              </div>

              {/* Result */}
              <div className="space-y-3">
                <Label>Resultado</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={result === "win" ? "default" : "outline"}
                    onClick={() => setResult("win")}
                    className={`h-12 ${
                      result === "win" ? "bg-green-600 hover:bg-green-700" : ""
                    }`}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Victoria
                  </Button>
                  <Button
                    variant={result === "loss" ? "destructive" : "outline"}
                    onClick={() => setResult("loss")}
                    className="h-12"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Derrota
                  </Button>
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-2">
                <Label htmlFor="comments">Comentarios (Opcional)</Label>
                <Textarea
                  id="comments"
                  placeholder="Notas sobre la partida..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="sticky bottom-4 bg-white p-4 rounded-lg border shadow-lg">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full h-12 text-lg"
              size="lg"
            >
              <Check className="w-5 h-5 mr-2" />
              Registrar Partida
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente principal
const GameLogsPage = () => {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [stats, setStats] = useState<GameLogStats | null>(null);
  const [leaderStats, setLeaderStats] = useState<LeaderStats[]>([]);
  const [opponentStats, setOpponentStats] = useState<OpponentLeaderStats[]>([]);
  const [cardPerformance, setCardPerformance] = useState<any[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [leaders, setLeaders] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [currentView, setCurrentView] = useState<"logs" | "newBattle">("logs");

  // Helper functions for view navigation
  const handleNewBattle = () => {
    setCurrentView("newBattle");
  };

  const handleBackToLogs = () => {
    setCurrentView("logs");
  };

  const handleBattleSubmit = async (battleData: any) => {
    try {
      const response = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: parseInt(battleData.deckId),
          opponentLeaderId: parseInt(battleData.opponentLeaderId),
          opponentName: battleData.opponentName || null,
          isWin: battleData.isWin === "true",
          wentFirst: battleData.wentFirst === "true",
          playedAt: battleData.playedAt || new Date().toISOString(),
          finalHand:
            battleData.finalHand && Object.keys(battleData.finalHand).length > 0
              ? (() => {
                  const finalHandArray: number[] = [];
                  Object.entries(battleData.finalHand).forEach(
                    ([cardId, quantity]) => {
                      for (let i = 0; i < (quantity as number); i++) {
                        finalHandArray.push(parseInt(cardId));
                      }
                    }
                  );
                  return finalHandArray;
                })()
              : null,
          comments: battleData.comments || null,
        }),
      });

      if (!response.ok) throw new Error("Error creating game log");

      showSuccessToast("¡Partida registrada exitosamente!");
      setCurrentView("logs");
      loadData();
    } catch (error) {
      showErrorToast("Error al registrar la partida");
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (session?.user?.id) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar logs, stats, decks y líderes en paralelo
      const [logsRes, statsRes, decksRes, leadersRes] = await Promise.all([
        fetch("/api/logs"),
        fetch("/api/logs/stats"),
        fetch(`/api/admin/decks/user/${session?.user?.id}`),
        fetch("/api/cards/leaders"),
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
        console.log("Logs data:", logsData);
      } else {
        console.error(
          "Error fetching logs:",
          logsRes.status,
          logsRes.statusText
        );
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        console.log("Stats data received:", statsData);
        setStats(statsData.stats);
        setLeaderStats(statsData.leaderStats || []);
        setOpponentStats(statsData.opponentLeaderStats || []);
        setCardPerformance(statsData.cardPerformance || []);
      } else {
        console.error(
          "Error fetching stats:",
          statsRes.status,
          statsRes.statusText
        );
        // Try to read error response
        try {
          const errorData = await statsRes.json();
          console.error("Stats error details:", errorData);
        } catch (e) {
          console.error("Could not parse stats error response");
        }
      }

      if (decksRes.ok) {
        const decksData = await decksRes.json();
        setDecks(decksData);
      } else {
        console.error(
          "Error fetching decks:",
          decksRes.status,
          decksRes.statusText
        );
      }

      if (leadersRes.ok) {
        const leadersData = await leadersRes.json();
        setLeaders(leadersData.leaders || []);
      } else {
        console.error(
          "Error fetching leaders:",
          leadersRes.status,
          leadersRes.statusText
        );
      }
    } catch (error) {
      console.error("Error loading data:", error);
      showErrorToast("Error cargando los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleLogCreated = () => {
    loadData();
  };

  const handleDeleteLog = async (logId: number) => {
    try {
      const response = await fetch(`/api/logs/${logId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Error deleting log");

      showSuccessToast("Partida eliminada exitosamente");
      loadData();
    } catch (error) {
      showErrorToast("Error al eliminar la partida");
    }
  };

  if (!session?.user?.id) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acceso Requerido</CardTitle>
            <CardDescription>
              Debes iniciar sesión para acceder a tus logs de partidas.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show new battle form if currentView is "newBattle"
  if (currentView === "newBattle") {
    return (
      <GameLogForm
        decks={decks}
        leaders={leaders}
        onBack={handleBackToLogs}
        onSubmit={handleBattleSubmit}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Swords className="h-8 w-8 text-blue-600" />
            Game Logs
          </h1>
          <p className="text-muted-foreground">
            Trackea tus partidas y obtén insights para mejorar tu juego
          </p>
        </div>
        <Button
          onClick={handleNewBattle}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Registrar Partida
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger
            value="overview"
            className="flex items-center gap-2 h-10 px-4"
          >
            <BarChart3 className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center gap-2 h-10 px-4"
          >
            <Clock className="h-4 w-4" />
            Historial
          </TabsTrigger>

          <TabsTrigger
            value="insights"
            className="flex items-center gap-2 h-10 px-4"
          >
            <TrendingUp className="h-4 w-4" />
            Insights
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 pb-8">
          <BattleDashboard
            stats={stats}
            leaderStats={leaderStats}
            logs={logs}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6 pb-8">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Batallas</CardTitle>
              <CardDescription>
                Tu cronología de partidas con detalles visuales
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-16">
                  <GamepadIcon className="h-20 w-20 text-muted-foreground mx-auto mb-6" />
                  <h3 className="text-xl font-semibold mb-2">
                    No hay partidas aún
                  </h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Comienza registrando tu primera partida para ver tu
                    historial de batallas aquí.
                  </p>
                  <br />
                  <Button
                    onClick={handleNewBattle}
                    className="mt-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Primera Partida
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {logs.map((log) => {
                    const deckLeader = log.deck?.deckCards?.find(
                      (dc) => dc.card?.category === "Leader"
                    )?.card;

                    return (
                      <div
                        key={log.id}
                        className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden"
                      >
                        {/* Header compacto con resultado y fecha */}
                        <div
                          className={`px-3 sm:px-4 py-3 flex items-center justify-between ${
                            log.isWin
                              ? "bg-green-50 border-b border-green-100"
                              : "bg-red-50 border-b border-red-100"
                          }`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <div
                              className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                log.isWin ? "bg-green-500" : "bg-red-500"
                              }`}
                            >
                              {log.isWin ? (
                                <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                              ) : (
                                <X className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span
                                className={`font-bold text-xs sm:text-sm ${
                                  log.isWin ? "text-green-700" : "text-red-700"
                                }`}
                              >
                                {log.isWin ? "VICTORIA" : "DERROTA"}
                              </span>
                              <div className="text-xs text-gray-500 truncate">
                                {format(
                                  new Date(log.playedAt),
                                  "dd/MM/yyyy HH:mm"
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            {/* Orden de turno neutro */}
                            <div
                              className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
                                log.wentFirst
                                  ? "bg-gray-200 text-gray-700 border border-gray-300"
                                  : "bg-gray-300 text-gray-800 border border-gray-400"
                              }`}
                            >
                              {log.wentFirst ? (
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

                            {log.comments && (
                              <div className="p-1 bg-gray-200 rounded-full">
                                <MessageSquare className="h-3 w-3 text-gray-600" />
                              </div>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 sm:h-7 sm:w-7 p-0"
                              asChild
                            >
                              <Link href={`/logs/${log.id}`}>
                                <Eye className="h-3 w-3" />
                              </Link>
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 sm:h-7 sm:w-7 p-0 hover:bg-red-100"
                              onClick={() => handleDeleteLog(log.id)}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
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
                                      {log.deck?.name?.substring(0, 2) || "??"}
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
                                            backgroundColor: getColors(
                                              color.color
                                            ),
                                          }}
                                          title={color.color}
                                        />
                                      ))}
                                  </div>
                                </div>
                                <h5 className="font-bold text-sm sm:text-base text-gray-900 truncate leading-tight">
                                  {log.deck?.name || "Deck Desconocido"}
                                </h5>
                                <p className="text-xs text-gray-600 truncate">
                                  {deckLeader?.name || "Sin líder"}
                                </p>
                              </div>
                            </div>

                            {/* VS - Solo en desktop */}
                            <div className="hidden sm:flex items-center justify-center px-2">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm border border-gray-300">
                                <Swords className="h-5 w-5 text-gray-600" />
                              </div>
                            </div>

                            {/* Separador en móvil */}
                            <div className="sm:hidden flex items-center justify-center py-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm border border-gray-300">
                                <Swords className="h-4 w-4 text-gray-600" />
                              </div>
                            </div>

                            {/* Oponente */}
                            <div className="flex items-center gap-3 flex-1 min-w-0 bg-gray-100 rounded-lg p-3 border border-gray-300">
                              <div className="w-12 h-16 sm:w-14 sm:h-18 rounded-lg overflow-hidden shadow-md flex-shrink-0 ring-2 ring-gray-400">
                                {log.opponentLeader?.src ? (
                                  <img
                                    src={log.opponentLeader.src}
                                    alt={log.opponentLeader.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-600 to-gray-700 text-white">
                                    <span className="font-bold text-sm">
                                      ??
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-gray-700 bg-gray-300 px-2 py-0.5 rounded-full">
                                    OPONENTE
                                  </span>
                                  <div className="flex gap-1">
                                    {log.opponentLeader?.colors
                                      ?.slice(0, 3)
                                      .map((color: any, index: number) => (
                                        <div
                                          key={index}
                                          className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                                          style={{
                                            backgroundColor: getColors(
                                              color.color
                                            ),
                                          }}
                                          title={color.color}
                                        />
                                      ))}
                                  </div>
                                </div>
                                <h5 className="font-bold text-sm sm:text-base text-gray-900 truncate leading-tight">
                                  {log.opponentLeader?.name ||
                                    "Líder Desconocido"}
                                </h5>
                                {log.opponentName ? (
                                  <p className="text-xs text-gray-600 font-medium truncate">
                                    vs {log.opponentName}
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
                          {log.comments && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                                <p className="text-xs sm:text-sm text-gray-700 line-clamp-2">
                                  {log.comments}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6 pb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Insights de Cartas en Mano Inicial
              </CardTitle>
              <CardDescription>
                Cartas que más contribuyen a tus victorias en mano inicial
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : cardPerformance.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay suficientes datos para mostrar insights de cartas.
                  <br />
                  <span className="text-sm">
                    Registra más partidas con manos iniciales para ver análisis.
                  </span>
                </p>
              ) : (
                <div className="space-y-3">
                  {cardPerformance.map((card) => (
                    <div
                      key={card.cardId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={card.cardSrc}
                          alt={card.cardName}
                          className="w-10 h-14 object-cover rounded"
                        />
                        <div>
                          <p className="font-medium">{card.cardName}</p>
                          <p className="text-sm text-muted-foreground">
                            {card.cardCategory}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg flex items-center gap-2">
                          {card.winRateWithCard.toFixed(1)}%
                          {card.winRateWithCard >= 60 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : card.winRateWithCard <= 40 ? (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          ) : null}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {card.winsWithCard}W - {card.lossesWithCard}L (
                          {card.totalGamesWithCard} partidas)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GameLogsPage;
