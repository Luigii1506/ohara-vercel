"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Eye, RefreshCw, AlertCircle, Trash2 } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";
import { setCodesOptions } from "@/helpers/constants";

interface MissingSet {
  id: number;
  title: string;
  translatedTitle?: string | null;
  versionSignature?: string | null;
  isApproved: boolean;
  images: string[];
  createdAt: string;
  updatedAt: string;
  events: MissingSetEventLink[];
}

interface MissingSetEventLink {
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
  } | null;
}

type ImageClassification =
  | "CARD"
  | "UNCUT_SHEET"
  | "PLAYMAT"
  | "SLEEVE"
  | "COVER"
  | "";

interface CardData {
  id: number;
  name: string;
  code: string;
  src: string;
  setCode: string;
}

interface CardSelection {
  setCode: string;
  cardId: number | null;
  cardData: CardData | null;
}

type ImageClassificationPayload = Record<
  string,
  {
    type: ImageClassification;
    cardId?: number;
  }
>;

interface ExistingSetPreview {
  id: number;
  title: string;
  code?: string | null;
  version?: string | null;
  image?: string | null;
}

export default function ApproveMissingSetPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [missingSet, setMissingSet] = useState<MissingSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [imageClassifications, setImageClassifications] = useState<
    Record<string, ImageClassification>
  >({});
  const [cardSelections, setCardSelections] = useState<
    Record<string, CardSelection>
  >({});
  const [availableCards, setAvailableCards] = useState<
    Record<string, CardData[]>
  >({});
  const [existingSetMatch, setExistingSetMatch] =
    useState<ExistingSetPreview | null>(null);
  const [existingSetDialogOpen, setExistingSetDialogOpen] = useState(false);
  const [pendingApprovalPayload, setPendingApprovalPayload] =
    useState<ImageClassificationPayload | null>(null);

  useEffect(() => {
    fetchMissingSet();
  }, [id]);

  const fetchMissingSet = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/missing-sets/${id}`);
      if (!response.ok) throw new Error("Failed to fetch missing set");

      const data = await response.json();
      setMissingSet(data);

      // Inicializar clasificaciones vacías para cada imagen
      const initialClassifications: Record<string, ImageClassification> = {};
      const initialCardSelections: Record<string, CardSelection> = {};

      data.images.forEach((url: string) => {
        initialClassifications[url] = "";
        initialCardSelections[url] = {
          setCode: "",
          cardId: null,
          cardData: null,
        };
      });

      setImageClassifications(initialClassifications);
      setCardSelections(initialCardSelections);
      setAvailableCards({});
    } catch (error) {
      console.error("Error fetching missing set:", error);
      showErrorToast("Error al cargar el missing set");
      router.push("/admin/missing-sets");
    } finally {
      setLoading(false);
    }
  };

  const handleClassificationChange = (
    url: string,
    value: ImageClassification
  ) => {
    setImageClassifications((prev) => ({
      ...prev,
      [url]: value,
    }));

    // Si cambia a algo que no sea CARD, limpiar la selección de carta
    if (value !== "CARD") {
      setCardSelections((prev) => ({
        ...prev,
        [url]: {
          setCode: "",
          cardId: null,
          cardData: null,
        },
      }));
    }
  };

  const handleSetCodeChange = async (imageUrl: string, setCode: string) => {
    setCardSelections((prev) => ({
      ...prev,
      [imageUrl]: {
        setCode,
        cardId: null,
        cardData: null,
      },
    }));

    // Fetch cards for this set code
    try {
      const response = await fetch(
        `/api/admin/cards/by-set?setCode=${setCode}&firstEditionOnly=true&baseCardsOnly=true`
      );
      if (!response.ok) throw new Error("Failed to fetch cards");
      const cards = await response.json();

      setAvailableCards((prev) => ({
        ...prev,
        [imageUrl]: cards,
      }));
    } catch (error) {
      console.error("Error fetching cards:", error);
      showErrorToast("Error al cargar las cartas del set");
    }
  };

  const handleCardChange = (imageUrl: string, cardId: string) => {
    const cards = availableCards[imageUrl] || [];
    const selectedCard = cards.find((c) => c.id === parseInt(cardId));

    setCardSelections((prev) => ({
      ...prev,
      [imageUrl]: {
        ...prev[imageUrl],
        cardId: parseInt(cardId),
        cardData: selectedCard || null,
      },
    }));
  };

  const allImagesClassified = useMemo(() => {
    if (!missingSet) return false;
    return missingSet.images.every((url) => {
      const classification = imageClassifications[url];

      // Debe tener una clasificación
      if (!classification || classification.length === 0) {
        return false;
      }

      // Si es CARD, debe tener setCode y cardId seleccionados
      if (classification === "CARD") {
        const cardSelection = cardSelections[url];
        return (
          cardSelection &&
          cardSelection.setCode &&
          cardSelection.cardId !== null
        );
      }

      // Para otros tipos, solo necesita la clasificación
      return true;
    });
  }, [missingSet, imageClassifications, cardSelections]);

  const approveDisabled =
    !allImagesClassified || isApproving || missingSet?.isApproved;

  const buildApprovalPayload = (): ImageClassificationPayload => {
    const payload: ImageClassificationPayload = {};

    Object.entries(imageClassifications).forEach(([url, classification]) => {
      if (classification && classification.length > 0) {
        payload[url] = {
          type: classification,
          cardId:
            classification === "CARD"
              ? cardSelections[url]?.cardId || undefined
              : undefined,
        };
      }
    });

    return payload;
  };

  const submitApproval = async (payload: ImageClassificationPayload) => {
    if (!missingSet) return;

    const response = await fetch(
      `/api/admin/missing-sets/${missingSet.id}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageClassifications: payload,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to approve missing set");
    }

    const result = await response.json();
    showSuccessToast(
      `Set "${result.setTitle}" creado exitosamente! ${result.alternatesCount} cartas alternas y ${result.attachmentsCount} attachments agregados.`
    );

    router.push("/admin/missing-sets");
  };

  const findExistingSetMatch = async (): Promise<ExistingSetPreview | null> => {
    if (!missingSet) return null;
    const searchTitle = (missingSet.translatedTitle || missingSet.title || "")
      .trim()
      .toLowerCase();
    if (!searchTitle) return null;

    try {
      const params = new URLSearchParams({
        title: searchTitle,
        limit: "5",
      });
      if (missingSet.versionSignature) {
        params.append("version", missingSet.versionSignature);
      }

      const response = await fetch(`/api/admin/sets/search?${params.toString()}`);
      if (!response.ok) return null;
      const sets = await response.json();
      if (!Array.isArray(sets) || sets.length === 0) return null;

      const exact =
        sets.find(
          (set) =>
            set.title?.trim().toLowerCase() === searchTitle ||
            set.code?.trim().toLowerCase() === searchTitle
        ) || sets[0];

      return exact
        ? {
            id: exact.id,
            title: exact.title,
            code: exact.code,
            version: exact.version,
            image: exact.image,
          }
        : null;
    } catch (error) {
      console.error("Error searching existing set:", error);
      return null;
    }
  };

  const handleApprove = async () => {
    if (!missingSet) return;

    const payload = buildApprovalPayload();

    try {
      setIsApproving(true);
      const existingMatch = await findExistingSetMatch();
      if (existingMatch) {
        setExistingSetMatch(existingMatch);
        setPendingApprovalPayload(payload);
        setExistingSetDialogOpen(true);
        return;
      }

      await submitApproval(payload);
    } catch (error) {
      console.error(error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al aprobar el set"
      );
    } finally {
      setIsApproving(false);
    }
  };

  const resetExistingSetDialog = () => {
    setExistingSetDialogOpen(false);
    setExistingSetMatch(null);
    setPendingApprovalPayload(null);
  };

  const handleConfirmExistingSet = async () => {
    if (!pendingApprovalPayload) return;
    try {
      setIsApproving(true);
      await submitApproval(pendingApprovalPayload);
      resetExistingSetDialog();
    } catch (error) {
      console.error(error);
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Error al continuar con la aprobación"
      );
    } finally {
      setIsApproving(false);
    }
  };

  const handleDelete = async () => {
    if (!missingSet) return;

    const eventLabel = primaryEvent?.title ?? "los eventos relacionados";

    if (
      !window.confirm(
        `¿Eliminar "${missingSet.title}" del evento "${eventLabel}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/missing-sets/${missingSet.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete missing set");

      showSuccessToast("Missing set eliminado exitosamente");
      router.push("/admin/missing-sets");
    } catch (error) {
      console.error(error);
      showErrorToast("Error al eliminar el missing set");
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

  if (!missingSet) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Missing set no encontrado</p>
          <Button
            onClick={() => router.push("/admin/missing-sets")}
            className="mt-4"
          >
            Volver a la lista
          </Button>
        </div>
      </div>
    );
  }

  const primaryEvent = missingSet.events[0]?.event ?? null;

  const pageTitle = missingSet.translatedTitle || missingSet.title;

  return (
    <>
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/missing-sets")}
              className="mb-2 px-0"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Missing Sets
            </Button>
            <h1 className="text-3xl font-bold leading-tight">{pageTitle}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>{missingSet.events.length} evento(s)</span>
              <span>•</span>
              <span>{missingSet.images.length} imagen(es) por clasificar</span>
              {missingSet.versionSignature && (
                <>
                  <span>•</span>
                  <span>Versión: {missingSet.versionSignature}</span>
                </>
              )}
            </div>
          </div>
          {missingSet.isApproved && (
            <Badge variant="default" className="text-sm">
              ✓ Aprobado
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Contenido principal */}
        <div className="lg:col-span-3 space-y-6">
          {/* Card de información */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Set</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Evento principal
                  </p>
                  {primaryEvent ? (
                    <div className="space-y-1 flex flex-col">
                      <p className="text-lg font-semibold leading-tight">
                        {primaryEvent.title}
                      </p>
                      {primaryEvent.slug && (
                        <p className="text-sm text-muted-foreground break-all">
                          {primaryEvent.slug}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Este missing set no está vinculado a ningún evento.
                    </p>
                  )}
                  {missingSet.events.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Vinculado a {missingSet.events.length} evento(s)
                    </p>
                  )}
                </div>
              </div>

              {primaryEvent && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase text-muted-foreground mb-1">
                      Región
                    </div>
                    <p className="text-lg font-semibold">
                      {primaryEvent.region || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase text-muted-foreground mb-1">
                      Fecha de inicio
                    </div>
                    <p className="text-lg font-semibold">
                      {primaryEvent.startDate
                        ? new Date(primaryEvent.startDate).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card de imágenes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Imágenes del Set ({missingSet.images.length})
                </CardTitle>
                {allImagesClassified && (
                  <Badge variant="default" className="gap-1">
                    ✓ Todas clasificadas
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {missingSet.images.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No se detectaron imágenes para este set.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {missingSet.images.map((image, index) => (
                    <div key={index} className="space-y-2 flex flex-col">
                      <div className="pt-3 pb-3 group relative aspect-[2/3] max-h-72 rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow">
                        <a
                          href={image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full h-full"
                        >
                          <img
                            src={image}
                            alt={`${missingSet.title} - Imagen ${index + 1}`}
                            className="mx-auto h-full w-auto object-contain group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </a>
                      </div>

                      {/* Selector de clasificación */}
                      <div className="space-y-2">
                        <div className="space-y-1 flex flex-col">
                          <Select
                            value={imageClassifications[image] || ""}
                            onValueChange={(value) =>
                              handleClassificationChange(
                                image,
                                value as ImageClassification
                              )
                            }
                          >
                            <SelectTrigger
                              className={
                                !imageClassifications[image]
                                  ? "border-destructive"
                                  : ""
                              }
                            >
                              <SelectValue placeholder="Selecciona tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CARD">Card</SelectItem>
                              <SelectItem value="UNCUT_SHEET">
                                Uncut Sheet
                              </SelectItem>
                              <SelectItem value="PLAYMAT">Playmat</SelectItem>
                              <SelectItem value="SLEEVE">Sleeve</SelectItem>
                              <SelectItem value="COVER">Cover</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Selectores adicionales para CARD */}
                        {imageClassifications[image] === "CARD" && (
                          <div className="space-y-2 pt-2 border-t">
                            {/* Selector de Set Code */}
                            <div className="space-y-1 flex flex-col">
                              <label className="text-xs font-medium text-muted-foreground">
                                Código del Set
                              </label>
                              <Select
                                value={cardSelections[image]?.setCode || ""}
                                onValueChange={(value) =>
                                  handleSetCodeChange(image, value)
                                }
                              >
                                <SelectTrigger
                                  className={
                                    !cardSelections[image]?.setCode
                                      ? "border-destructive"
                                      : ""
                                  }
                                >
                                  <SelectValue placeholder="Selecciona set..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {setCodesOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Selector de Carta */}
                            {cardSelections[image]?.setCode && (
                              <div className="space-y-1 flex flex-col">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Carta
                                </label>
                                <Select
                                  value={
                                    cardSelections[image]?.cardId?.toString() ||
                                    ""
                                  }
                                  onValueChange={(value) =>
                                    handleCardChange(image, value)
                                  }
                                >
                                  <SelectTrigger
                                    className={
                                      !cardSelections[image]?.cardId
                                        ? "border-destructive"
                                        : ""
                                    }
                                  >
                                    <SelectValue placeholder="Selecciona carta..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(availableCards[image] || []).map(
                                      (card) => (
                                        <SelectItem
                                          key={card.id}
                                          value={card.id.toString()}
                                        >
                                          {card.code} - {card.name}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Preview de la carta seleccionada */}
                            {cardSelections[image]?.cardData && (
                              <div className="space-y-1 flex flex-col">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Preview
                                </label>
                                <div className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-primary">
                                  <img
                                    src={cardSelections[image].cardData!.src}
                                    alt={cardSelections[image].cardData!.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <p className="text-xs text-center text-muted-foreground">
                                  {cardSelections[image].cardData!.code} -{" "}
                                  {cardSelections[image].cardData!.name}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna lateral - Acciones */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!allImagesClassified && !missingSet.isApproved && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-destructive">
                      Debes clasificar todas las imágenes antes de aprobar el
                      set.
                    </p>
                  </div>
                </div>
              )}

              {missingSet.events.length === 0 && (
                <div className="p-3 bg-muted border rounded-lg text-xs text-muted-foreground">
                  Este missing set no está vinculado a ningún evento.
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                variant="default"
                disabled={approveDisabled}
                onClick={handleApprove}
              >
                {isApproving ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-5 w-5" />
                    Aprobar Set
                  </>
                )}
              </Button>

              <Button
                className="w-full"
                size="lg"
                variant="destructive"
                onClick={handleDelete}
                disabled={isApproving}
              >
                <Trash2 className="mr-2 h-5 w-5" />
                Eliminar Set
              </Button>

              <div className="pt-4 border-t space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">
                    Progreso de clasificación
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Clasificadas
                      </span>
                      <span className="font-medium">
                        {
                          Object.values(imageClassifications).filter(
                            (c) => c && c.length > 0
                          ).length
                        }{" "}
                        / {missingSet.images.length}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${
                            missingSet.images.length > 0
                              ? (Object.values(imageClassifications).filter(
                                  (c) => c && c.length > 0
                                ).length /
                                  missingSet.images.length) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Resumen de clasificaciones */}
                {Object.values(imageClassifications).some(
                  (c) => c && c.length > 0
                ) && (
                  <div>
                    <p className="text-sm font-medium mb-2">Resumen</p>
                    <div className="space-y-1 flex flex-col text-xs">
                      {Object.entries(
                        Object.values(imageClassifications).reduce(
                          (acc, classification) => {
                            if (classification && classification.length > 0) {
                              acc[classification] =
                                (acc[classification] || 0) + 1;
                            }
                            return acc;
                          },
                          {} as Record<string, number>
                        )
                      ).map(([type, count]) => (
                        <div
                          key={type}
                          className="flex justify-between items-center"
                        >
                          <span className="text-muted-foreground">
                            {type === "CARD"
                              ? "Cards"
                              : type === "UNCUT_SHEET"
                              ? "Uncut Sheets"
                              : type === "PLAYMAT"
                              ? "Playmats"
                              : type === "SLEEVE"
                              ? "Sleeves"
                              : "Covers"}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    <Dialog
      open={existingSetDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetExistingSetDialog();
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Set existente encontrado</DialogTitle>
          <DialogDescription>
            Ya existe un set con un título similar. Revisa la información antes
            de continuar.
          </DialogDescription>
        </DialogHeader>
        {existingSetMatch && missingSet && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs uppercase text-muted-foreground">
                Set existente
              </p>
              {existingSetMatch.image && (
                <img
                  src={existingSetMatch.image}
                  alt={existingSetMatch.title}
                  className="w-full rounded-md border object-cover"
                />
              )}
              <div>
                <p className="text-lg font-semibold leading-tight">
                  {existingSetMatch.title}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {existingSetMatch.code && (
                    <Badge variant="outline">{existingSetMatch.code}</Badge>
                  )}
                  {existingSetMatch.version && (
                    <Badge variant="secondary">
                      Versión {existingSetMatch.version}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs uppercase text-muted-foreground">
                Nuevo set a crear
              </p>
              {missingSet.images[0] && (
                <img
                  src={missingSet.images[0]}
                  alt={missingSet.title}
                  className="w-full rounded-md border object-cover"
                />
              )}
              <div>
                <p className="text-lg font-semibold leading-tight">
                  {missingSet.translatedTitle || missingSet.title}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {missingSet.versionSignature && (
                    <Badge variant="secondary">
                      Versión {missingSet.versionSignature}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {missingSet.events.length} evento(s)
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={resetExistingSetDialog}
            disabled={isApproving}
          >
            Revisar de nuevo
          </Button>
          <Button onClick={handleConfirmExistingSet} disabled={isApproving}>
            Continuar y crear nuevo set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
