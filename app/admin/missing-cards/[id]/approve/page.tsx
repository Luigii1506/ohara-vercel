"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, AlertCircle, Check, Plus } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";
import CreateAlternateCardPanel from "./components/CreateAlternateCardPanel";

interface MissingCard {
  id: number;
  code: string;
  title: string;
  imageUrl: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  events: MissingCardEventLink[];
}

interface MissingCardEventLink {
  linkId: number;
  eventId: number;
  event: {
    id: number;
    title: string;
    slug?: string | null;
    region?: string | null;
    eventType?: string | null;
    startDate?: string | null;
    sourceUrl?: string | null;
    locale?: string | null;
  };
}

interface CardOption {
  id: number;
  code: string;
  name: string;
  src: string;
  isFirstEdition: boolean;
  alias?: string | null;
  sets?: Array<{
    set: {
      title: string;
      code?: string | null;
      version?: string | null;
    };
  }>;
}

export default function ApproveMissingCardPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [missingCard, setMissingCard] = useState<MissingCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [cardOptions, setCardOptions] = useState<CardOption[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showCreateAlternateForm, setShowCreateAlternateForm] =
    useState(false);

  useEffect(() => {
    fetchMissingCard();
  }, [id]);

  useEffect(() => {
    if (missingCard) {
      fetchCardOptions();
    }
  }, [missingCard]);

  const fetchMissingCard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/missing-cards/${id}`);
      if (!response.ok) throw new Error("Failed to fetch missing card");

      const data = await response.json();
      setMissingCard(data);
    } catch (error) {
      console.error("Error fetching missing card:", error);
      showErrorToast("Error al cargar el missing card");
      router.push("/admin/missing-cards");
    } finally {
      setLoading(false);
    }
  };

  const fetchCardOptions = async () => {
    if (!missingCard) return;

    try {
      setLoadingCards(true);
      const response = await fetch(
        `/api/admin/cards/by-code/${encodeURIComponent(missingCard.code)}`
      );
      if (!response.ok) throw new Error("Failed to fetch cards");

      const data = await response.json();
      setCardOptions(data);

      // Auto-seleccionar si solo hay una opción
      if (data.length === 1) {
        setSelectedCardId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching card options:", error);
      showErrorToast("Error al buscar cartas con código " + missingCard.code);
    } finally {
      setLoadingCards(false);
    }
  };

  const selectedCard = useMemo(() => {
    if (!selectedCardId) return null;
    return cardOptions.find((card) => card.id === selectedCardId) ?? null;
  }, [selectedCardId, cardOptions]);

  const handleApprove = async () => {
    if (!missingCard || !selectedCardId) return;

    try {
      setIsApproving(true);

      const response = await fetch(
        `/api/admin/missing-cards/${missingCard.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cardId: selectedCardId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve missing card");
      }

      const result = await response.json();
      showSuccessToast(
        `EventCards creados exitosamente para ${result.eventsProcessed} evento(s) con la carta ${result.cardCode}`
      );
      router.push("/admin/missing-cards");
    } catch (error) {
      console.error("Error approving:", error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al aprobar"
      );
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreateAlternateAndApprove = async (newCardId: number) => {
    if (!missingCard) return;

    try {
      setIsApproving(true);

      const response = await fetch(
        `/api/admin/missing-cards/${missingCard.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cardId: newCardId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve missing card");
      }

      const result = await response.json();
      showSuccessToast(
        `Carta alterna creada y EventCards generados para ${result.eventsProcessed} evento(s) con la carta ${result.cardCode}`
      );
      setShowCreateAlternateForm(false);
      router.push("/admin/missing-cards");
    } catch (error) {
      console.error("Error approving:", error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al aprobar"
      );
    } finally {
      setIsApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!missingCard) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Missing card no encontrado</p>
        </div>
      </div>
    );
  }

  const canApprove = selectedCardId && !isApproving && !missingCard.isApproved;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/missing-cards")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Missing Cards
        </Button>

        <h1 className="text-3xl font-bold mb-2">Aprobar Missing Card</h1>
        <p className="text-muted-foreground">
          Selecciona la carta correcta de la base de datos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Info del Missing Card */}
        <div className="lg:col-span-1 space-y-4">
          {/* Card con imagen detectada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Carta Detectada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-center">
                <img
                  src={missingCard.imageUrl}
                  alt={missingCard.title}
                  className="w-full max-w-[200px] rounded border"
                />
              </div>
              <div>
                <Badge variant="secondary" className="font-mono mb-2">
                  {missingCard.code}
                </Badge>
                <p className="text-sm font-medium">{missingCard.title}</p>
              </div>
            </CardContent>
          </Card>

          {/* Eventos afectados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Eventos Afectados ({missingCard.events.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {missingCard.events.map((eventLink) => (
                <div
                  key={eventLink.linkId}
                  className="p-2 border rounded-lg bg-muted/50 flex flex-col"
                >
                  <p className="text-sm font-medium">{eventLink.event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {eventLink.event.slug}
                  </p>
                </div>
              ))}
              <div className="pt-2 border-t mt-3">
                <p className="text-xs text-muted-foreground">
                  Al aprobar, se creará un EventCard para cada uno de estos{" "}
                  {missingCard.events.length} evento(s)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contenido principal */}
        <div className="lg:col-span-3 space-y-6">
          {/* Selección de carta */}
          {!showCreateAlternateForm && (
            <Card>
              <CardHeader>
                <CardTitle>Selecciona la Carta Correcta</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Encuentra y selecciona la carta que corresponde al código{" "}
                  <span className="font-mono font-semibold">
                    {missingCard.code}
                  </span>
                </p>
              </CardHeader>
              <CardContent>
                {loadingCards ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : cardOptions.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No se encontraron cartas con el código{" "}
                      <span className="font-mono font-semibold">
                        {missingCard.code}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Verifica que la carta exista en la base de datos
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cardOptions.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className={`relative rounded-lg border-2 p-3 transition-all hover:shadow-lg ${
                          selectedCardId === card.id
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {selectedCardId === card.id && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="h-4 w-4" />
                          </div>
                        )}

                        <div className="flex flex-col items-center space-y-2">
                          <img
                            src={card.src}
                            alt={card.name}
                            className="w-full max-w-[150px] rounded"
                          />

                          <div className="text-center w-full">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <Badge
                                variant="secondary"
                                className="font-mono text-xs"
                              >
                                {card.code}
                              </Badge>
                              {card.isFirstEdition && (
                                <Badge variant="default" className="text-xs">
                                  1st
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm font-medium line-clamp-2">
                              {card.name}
                            </p>

                            {card.alias && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                {card.alias}
                              </p>
                            )}

                            {card.sets && card.sets.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {card.sets[0].set.title}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Vista previa de la carta seleccionada */}
          {!showCreateAlternateForm && selectedCard && (
            <Card>
              <CardHeader>
                <CardTitle>Carta Seleccionada</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <img
                      src={selectedCard.src}
                      alt={selectedCard.name}
                      className="w-48 rounded border"
                    />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="font-mono">
                          {selectedCard.code}
                        </Badge>
                        {selectedCard.isFirstEdition && (
                          <Badge variant="default">First Edition</Badge>
                        )}
                      </div>
                      <h3 className="text-xl font-bold">{selectedCard.name}</h3>
                      {selectedCard.alias && (
                        <p className="text-sm text-muted-foreground">
                          {selectedCard.alias}
                        </p>
                      )}
                    </div>

                    {selectedCard.sets && selectedCard.sets.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-1">Sets:</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedCard.sets.map((cardSet, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs"
                            >
                              {cardSet.set.title}
                              {cardSet.set.version &&
                                ` (${cardSet.set.version})`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botones de acción / Crear alterna */}
        <Card className={showCreateAlternateForm ? "relative" : undefined}>
          {showCreateAlternateForm ? (
            <CreateAlternateCardPanel
              missingCard={missingCard}
              onCancel={() => setShowCreateAlternateForm(false)}
              onSuccess={handleCreateAlternateAndApprove}
              isLocked={isApproving}
            />
          ) : (
              <CardContent className="pt-6">
                {!canApprove && (
                  <div className="mb-4">
                    {!selectedCardId && (
                      <div className="p-3 bg-amber-100 border border-amber-200 rounded-lg">
                        <div className="flex gap-2 items-start">
                          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-700">
                            Selecciona una carta para continuar
                          </p>
                        </div>
                      </div>
                    )}
                    {missingCard.isApproved && (
                      <div className="p-3 bg-muted border rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          Esta carta ya fue aprobada
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={!canApprove}
                    onClick={handleApprove}
                  >
                    {isApproving ? (
                      <>
                        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-5 w-5" />
                        Aprobar y Crear EventCards para{" "}
                        {missingCard.events.length} Evento(s)
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    disabled={isApproving || missingCard.isApproved}
                    onClick={() => setShowCreateAlternateForm(true)}
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Crear Carta Alterna y Aprobar
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
