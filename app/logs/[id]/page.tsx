"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  Trophy,
  X,
  Calendar,
  Clock,
  User,
  MessageSquare,
  Crown,
  Users,
  Trash2,
  Pencil,
  Eye,
  Swords,
  ArrowLeft,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { getColors } from "@/helpers/functions";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import { GameLog } from "@/types";
import Link from "next/link";

const GameLogDetail = () => {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [gameLog, setGameLog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);

  useEffect(() => {
    if (session?.user?.id && params.id) {
      loadGameLog();
    }
  }, [session, params.id]);

  const loadGameLog = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/logs/${params.id}`);

      if (!response.ok) {
        if (response.status === 404) {
          showErrorToast("Partida no encontrada");
          router.push("/logs");
          return;
        }
        throw new Error("Error loading game log");
      }

      const data = await response.json();
      setGameLog(data);
    } catch (error) {
      console.error("Error loading game log:", error);
      showErrorToast("Error al cargar los datos de la partida");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/logs/${params.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Error deleting game log");

      showSuccessToast("Partida eliminada correctamente");
      router.push("/logs");
    } catch (error) {
      console.error("Error deleting game log:", error);
      showErrorToast("Error al eliminar la partida");
    }
  };

  const handleViewCard = (card: any) => {
    setSelectedCard(card);
    setShowCardModal(true);
  };

  if (!session?.user?.id) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Acceso Requerido</CardTitle>
            <CardDescription>
              Debes iniciar sesión para acceder a los detalles de la partida.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <Card className="max-w-lg w-full flex flex-col items-center p-8">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 bg-gray-400 rounded-full mb-4"></div>
            <div className="h-6 w-48 bg-gray-400 rounded mb-2"></div>
            <div className="h-4 w-32 bg-gray-400 rounded"></div>
          </div>
          <p className="text-gray-500 mt-4 text-center">
            Cargando detalles de la partida...
          </p>
        </Card>
      </div>
    );
  }

  if (!gameLog) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <Card className="max-w-lg w-full flex flex-col items-center p-8">
          <CardHeader>
            <CardTitle>Partida no encontrada</CardTitle>
            <CardDescription>
              No se pudo encontrar la información de esta partida.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/logs">Volver a Game Logs</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Obtener el líder del deck
  const deckLeader = gameLog.deckLeader;

  // Formatear fecha y hora
  const formattedDate = format(new Date(gameLog.playedAt), "dd/MM/yyyy");
  const formattedTime = format(new Date(gameLog.playedAt), "HH:mm");

  return (
    <div className="flex items-center justify-center min-h-[90vh] py-8 px-2 w-full">
      <div className="max-h-full overflow-y-auto w-full max-w-3xl rounded-2xl border-0  flex flex-col">
        <Card className="w-full max-w-3xl shadow-xl rounded-2xl border-0  flex flex-col">
          <CardHeader className="flex flex-col items-center gap-2 pb-2">
            <div className="flex w-full justify-between items-center mb-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/logs">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará
                      permanentemente esta partida de tu historial.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Swords className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-center">
                Detalle de Partida
              </h1>
              <div className="flex gap-2 mt-2">
                <Badge
                  className={`text-lg py-1 px-4 ${
                    gameLog.isWin ? "bg-green-600" : "bg-red-600"
                  }`}
                >
                  {gameLog.isWin ? (
                    <Trophy className="mr-2 h-5 w-5" />
                  ) : (
                    <X className="mr-2 h-5 w-5" />
                  )}
                  {gameLog.isWin ? "Victoria" : "Derrota"}
                </Badge>
                <Badge variant="outline" className="text-sm">
                  {gameLog.wentFirst ? (
                    <Crown className="mr-1 h-3 w-3" />
                  ) : (
                    <Users className="mr-1 h-3 w-3" />
                  )}
                  {gameLog.wentFirst ? "Primer Jugador" : "Segundo Jugador"}
                </Badge>
              </div>
              <div className="flex gap-4 text-gray-600 text-sm mt-2">
                <div className="flex items-center">
                  <Calendar className="mr-1 h-4 w-4" />
                  {formattedDate}
                </div>
                <div className="flex items-center">
                  <Clock className="mr-1 h-4 w-4" />
                  {formattedTime}
                </div>
              </div>
            </div>
          </CardHeader>
          <Separator className="my-2" />
          <CardContent className="flex flex-col flex-1">
            <Tabs
              value={selectedTab}
              onValueChange={setSelectedTab}
              className="flex flex-col flex-1"
            >
              <TabsList className="grid grid-cols-3 w-full mb-6">
                <TabsTrigger value="overview">Resumen</TabsTrigger>
                <TabsTrigger value="deck">Mi Deck</TabsTrigger>
                <TabsTrigger value="hand">Mano Final</TabsTrigger>
              </TabsList>
              {/* Tab de Resumen */}
              <TabsContent value="overview" className="flex-1 overflow-y-auto">
                <div className="flex flex-col md:flex-row gap-8 w-full justify-center items-center">
                  {/* Mi Deck */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-20 h-28 rounded-lg overflow-hidden mb-2">
                      {deckLeader?.src ? (
                        <img
                          src={deckLeader.src}
                          alt={deckLeader.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white">
                          <span className="font-bold text-2xl">
                            {gameLog.deck.name.substring(0, 2)}
                          </span>
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-center">
                      {gameLog.deck.name}
                    </h3>
                    <p className="text-gray-600 text-center">
                      {deckLeader?.name || "Sin líder"}
                    </p>
                    <div className="flex gap-1 mt-2">
                      {deckLeader?.colors?.map((color: any, index: number) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          style={{
                            backgroundColor: getColors(color.color),
                            color: color.color === "Yellow" ? "black" : "white",
                          }}
                        >
                          {color.color}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {/* Oponente */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-20 h-28 rounded-lg overflow-hidden mb-2">
                      {gameLog.opponentLeader?.src ? (
                        <img
                          src={gameLog.opponentLeader.src}
                          alt={gameLog.opponentLeader.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center text-white">
                          <span className="font-bold text-2xl">?</span>
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-center">
                      {gameLog.opponentLeader?.name || "Desconocido"}
                    </h3>
                    {gameLog.opponentName && (
                      <div className="flex items-center text-gray-600">
                        <User className="h-3 w-3 mr-1" />
                        {gameLog.opponentName}
                      </div>
                    )}
                    <div className="flex gap-1 mt-2">
                      {gameLog.opponentLeader?.colors?.map(
                        (color: any, index: number) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            style={{
                              backgroundColor: getColors(color.color),
                              color:
                                color.color === "Yellow" ? "black" : "white",
                            }}
                          >
                            {color.color}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                </div>
                {/* Comentarios y estadísticas */}
                <div className="flex flex-col md:flex-row gap-8 w-full mt-8 justify-center items-stretch">
                  {gameLog.comments && (
                    <div className="flex-1 bg-gray-50 p-4 rounded-lg flex flex-col items-center justify-center mb-4 md:mb-0">
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col items-center">
                          <p className="text-sm font-medium text-gray-700">
                            Comentarios
                          </p>
                          <p className="text-sm text-gray-600">
                            {gameLog.comments}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 bg-gray-50 p-4 rounded-lg flex flex-col items-center justify-center">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="h-5 w-5" />
                      <span className="font-semibold text-lg">
                        Estadísticas Rápidas
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 w-full">
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-500 mb-1">
                          Resultado
                        </span>
                        <span
                          className={`text-2xl font-bold ${
                            gameLog.isWin ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {gameLog.isWin ? "Victoria" : "Derrota"}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-500 mb-1">
                          Orden
                        </span>
                        <span className="text-2xl font-bold">
                          {gameLog.wentFirst ? "Primero" : "Segundo"}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-500 mb-1">
                          Fecha
                        </span>
                        <span className="text-2xl font-bold">
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              {/* Tab de Deck */}
              <TabsContent value="deck" className="flex-1 overflow-y-auto">
                <div className="h-full overflow-y-auto">
                  <h2 className="font-bold text-xl mb-5 text-center">
                    Composición del Deck
                  </h2>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 justify-center">
                    {gameLog.deck.deckCards.map((deckCard: any) => (
                      <div
                        key={deckCard.id}
                        className="relative cursor-pointer"
                        onClick={() => handleViewCard(deckCard.card)}
                      >
                        <div className="aspect-[2.5/3.5] bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-md">
                          {deckCard.card.src ? (
                            <img
                              src={deckCard.card.src}
                              alt={deckCard.card.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                              <div className="text-center p-2">
                                <p className="font-bold text-sm">
                                  {deckCard.card.name}
                                </p>
                                <p className="text-xs opacity-90">
                                  {deckCard.card.category}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                          {deckCard.quantity}
                        </div>
                        <div className="mt-2 text-center">
                          <p className="text-xs font-medium truncate">
                            {deckCard.card.name}
                          </p>
                          <div className="flex justify-center gap-1 mt-1">
                            <Badge variant="outline" className="text-xs px-1">
                              {deckCard.card.cost}
                            </Badge>
                            {deckCard.card.colors?.map(
                              (color: any, index: number) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className="text-xs px-1"
                                  style={{
                                    backgroundColor: getColors(color.color),
                                    color:
                                      color.color === "Yellow"
                                        ? "black"
                                        : "white",
                                  }}
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
                </div>
              </TabsContent>
              {/* Tab de Mano Final */}
              <TabsContent value="hand" className="flex-1 overflow-y-auto">
                <div className="h-full overflow-y-auto">
                  <h2 className="font-bold text-xl mb-5 text-center">
                    Mano Final
                  </h2>

                  {gameLog.finalHand && gameLog.finalHand.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 justify-center">
                      {gameLog.finalHand.map((card: any) => (
                        <div
                          key={card.id}
                          className="cursor-pointer"
                          onClick={() => handleViewCard(card)}
                        >
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
                          <div className="mt-2 text-center">
                            <p className="text-xs font-medium truncate">
                              {card.name}
                            </p>
                            <div className="flex justify-center gap-1 mt-1">
                              <Badge variant="outline" className="text-xs px-1">
                                {card.cost}
                              </Badge>
                              {card.colors?.map((color: any, index: number) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className="text-xs px-1"
                                  style={{
                                    backgroundColor: getColors(color.color),
                                    color:
                                      color.color === "Yellow"
                                        ? "black"
                                        : "white",
                                  }}
                                >
                                  {color.color}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p>No se registró la mano final para esta partida</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      {/* Modal de vista detallada de carta */}
      <Dialog open={showCardModal} onOpenChange={setShowCardModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedCard?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center">
            <div className="w-48 h-64 rounded-lg overflow-hidden mb-4">
              {selectedCard?.src ? (
                <img
                  src={selectedCard.src}
                  alt={selectedCard.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white">
                  <div className="text-center p-4">
                    <p className="font-bold">{selectedCard?.name}</p>
                    <p className="opacity-90">{selectedCard?.category}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="w-full space-y-3">
              <div className="flex justify-center gap-2">
                <Badge variant="outline">Coste: {selectedCard?.cost}</Badge>
                <Badge variant="outline">
                  Poder: {selectedCard?.power || "N/A"}
                </Badge>
                <Badge variant="outline">Tipo: {selectedCard?.category}</Badge>
              </div>
              <div className="flex justify-center gap-1">
                {selectedCard?.colors?.map((color: any, index: number) => (
                  <Badge
                    key={index}
                    style={{
                      backgroundColor: getColors(color.color),
                      color: color.color === "Yellow" ? "black" : "white",
                    }}
                  >
                    {color.color}
                  </Badge>
                ))}
              </div>
              {selectedCard?.effects && selectedCard.effects.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Efectos:</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedCard.effects.map((effect: any) => (
                      <li key={effect.id} className="text-sm">
                        {effect.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GameLogDetail;
