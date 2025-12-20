"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  HoverImagePreviewOverlay,
  useHoverImagePreview,
} from "@/components/HoverImagePreview";
import {
  RefreshCw,
  Calendar,
  MapPin,
  Globe,
  Edit3,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

interface MissingSetInfo {
  id: number;
  title: string;
  translatedTitle?: string | null;
  versionSignature?: string | null;
  images?: string[];
}

interface AdminEvent {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  locale?: string | null;
  region: string;
  status: string;
  eventType: string;
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  rawDateText?: string | null;
  location?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  eventTxt?: string | null;
  eventThumbnail?: string | null;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  missingSets: MissingSetInfo[];
  missingCards?: Array<{
    id: number;
    missingCardId: number;
    code: string;
    title: string;
    imageUrl?: string | null;
  }>;
  setDetails?: Array<{
    id: number;
    title: string;
    code?: string | null;
    images?: string[];
    cards?: Array<{
      id: number;
      title: string;
      code?: string | null;
      image?: string | null;
    }>;
  }>;
  _count: {
    sets: number;
    cards: number;
    missingSets: number;
  };
}

type ApprovalFilter = "all" | "pending" | "approved";
type UpdatedFilter = "all" | "updated" | "stale";

const AdminEventsPage = () => {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedFilter, setUpdatedFilter] = useState<UpdatedFilter>("all");
  const [syncingEventId, setSyncingEventId] = useState<number | null>(null);
  const [eventSetMediaOpen, setEventSetMediaOpen] = useState<
    Record<string, boolean>
  >({});
  const {
    preview: hoverPreview,
    showPreview,
    hidePreview,
  } = useHoverImagePreview();

  useEffect(() => {
    fetchEvents();
  }, [approvalFilter, updatedFilter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (approvalFilter !== "all") {
        params.set(
          "approved",
          approvalFilter === "approved" ? "true" : "false"
        );
      }
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      const response = await fetch(
        `/api/admin/events${params.toString() ? `?${params}` : ""}`
      );
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar eventos");
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const isUpdatedToday = (isoDate?: string) => {
      if (!isoDate) return false;
      const target = new Date(isoDate);
      const now = new Date();
      return (
        target.getFullYear() === now.getFullYear() &&
        target.getMonth() === now.getMonth() &&
        target.getDate() === now.getDate()
      );
    };

    return events
      .filter((event) => {
        const matchesSearch =
          term.length === 0 ||
          event.title.toLowerCase().includes(term) ||
          event.slug.toLowerCase().includes(term) ||
          (event.sourceUrl && event.sourceUrl.toLowerCase().includes(term));

        if (!matchesSearch) return false;

        if (updatedFilter === "updated" && !isUpdatedToday(event.updatedAt)) {
          return false;
        }
        if (updatedFilter === "stale" && isUpdatedToday(event.updatedAt)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aCompleted = a.status === "COMPLETED";
        const bCompleted = b.status === "COMPLETED";
        if (aCompleted === bCompleted) return 0;
        return aCompleted ? 1 : -1;
      });
  }, [events, searchTerm, updatedFilter]);

  const toggleApproval = async (event: AdminEvent) => {
    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: !event.isApproved }),
      });
      if (!response.ok) throw new Error("Failed to update approval");
      await fetchEvents();
      showSuccessToast(
        !event.isApproved ? "Evento aprobado" : "Evento marcado como borrador"
      );
    } catch (error) {
      console.error(error);
      showErrorToast("Error al actualizar estado");
    }
  };

  const handleSyncEvent = async (event: AdminEvent) => {
    if (!event.sourceUrl) {
      showErrorToast("Este evento no cuenta con URL fuente");
      return;
    }
    try {
      setSyncingEventId(event.id);
      const payload = {
        eventUrl: event.sourceUrl,
        locale: event.locale || "en",
        region: event.region,
        renderMode: "static" as const,
        renderWaitMs: 2000,
        dryRun: false,
      };
      const response = await fetch("/api/admin/event-scraper/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "No se pudo sincronizar el evento");
      }
      await fetchEvents();
      showSuccessToast("Evento sincronizado correctamente");
    } catch (error) {
      console.error(error);
      showErrorToast("Error al sincronizar el evento");
    } finally {
      setSyncingEventId(null);
    }
  };

  const toggleSetMedia = (key: string) => {
    setEventSetMediaOpen((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handlePreviewEnter = (src?: string | null, alt?: string) => {
    if (!src) return;
    showPreview(src, alt);
  };

  const handlePreviewLeave = () => {
    hidePreview();
  };

  const isUpdatedToday = (isoDate?: string) => {
    if (!isoDate) return false;
    const target = new Date(isoDate);
    const now = new Date();
    return (
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth() &&
      target.getDate() === now.getDate()
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-slate-900/90 text-white shadow-xl">
        <div className="relative flex flex-col gap-4 px-6 py-8 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/70">
              Admin · Events
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-white drop-shadow-lg sm:text-4xl">
              Gestión de eventos
            </h1>
            <p className="mt-2 text-sm text-white/80 sm:text-base">
              Aprueba, actualiza y navega a los detalles completos de cada
              evento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={approvalFilter === "all" ? "default" : "outline"}
              onClick={() => setApprovalFilter("all")}
            >
              Todos
            </Button>
            <Button
              variant={approvalFilter === "pending" ? "default" : "outline"}
              onClick={() => setApprovalFilter("pending")}
            >
              Pendientes
            </Button>
            <Button
              variant={approvalFilter === "approved" ? "default" : "outline"}
              onClick={() => setApprovalFilter("approved")}
            >
              Aprobados
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
          <Input
            placeholder="Buscar por título, slug o URL..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full md:w-80"
          />
          <div className="flex gap-2">
            <Button
              variant={updatedFilter === "all" ? "default" : "outline"}
              onClick={() => setUpdatedFilter("all")}
              size="sm"
            >
              Todos
            </Button>
            <Button
              variant={updatedFilter === "updated" ? "default" : "outline"}
              onClick={() => setUpdatedFilter("updated")}
              size="sm"
            >
              Actualizados hoy
            </Button>
            <Button
              variant={updatedFilter === "stale" ? "default" : "outline"}
              onClick={() => setUpdatedFilter("stale")}
              size="sm"
            >
              Sin actualizar hoy
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {filteredEvents.length} de {events.length}
          </p>
          <Button variant="outline" onClick={fetchEvents}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Cargando eventos...
          </CardContent>
        </Card>
      ) : filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay eventos para mostrar con los filtros actuales.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const thumbnail = event.eventThumbnail ?? event.imageUrl ?? null;
            const updatedToday = isUpdatedToday(event.updatedAt);

            return (
              <Card
                key={event.id}
                className="overflow-hidden border border-muted shadow-sm"
              >
                <div className="flex flex-col gap-4 p-4 md:flex-row">
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-shrink-0 md:w-56">
                        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                          {thumbnail ? (
                            <Image
                              src={thumbnail}
                              alt={`Miniatura del evento ${event.title}`}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                              Sin imagen
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col flex-1 gap-5">
                        <div>
                          <div className="flex flex-wrap gap-2 flex-col flex-1">
                            <CardTitle className="text-xl">
                              {event.title}
                            </CardTitle>

                            <div className="flex gap-2">
                              {updatedToday && (
                                <Badge className="bg-emerald-600 text-white">
                                  Actualizado hoy
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  event.isApproved ? "default" : "secondary"
                                }
                              >
                                {event.isApproved ? "Aprobado" : "Pendiente"}
                              </Badge>
                              <Badge variant="outline">{event.status}</Badge>
                              <Badge variant="outline">{event.eventType}</Badge>
                              {event.category && (
                                <Badge variant="outline">
                                  {event.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Globe className="h-4 w-4" /> {event.region}
                            </span>
                            {event.locale && (
                              <span>Locale: {event.locale.toUpperCase()}</span>
                            )}
                            {event.startDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {new Date(event.startDate).toLocaleDateString()}
                              </span>
                            )}
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {event.location}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              Última actualización:
                              <strong>
                                {new Date(event.updatedAt).toLocaleString()}
                              </strong>
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {event.sourceUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a
                                href={event.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <LinkIcon className="mr-2 h-4 w-4" />
                                Ver evento
                              </a>
                            </Button>
                          )}
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/events/${event.id}`}>
                              <Edit3 className="mr-2 h-4 w-4" />
                              Editar
                            </Link>
                          </Button>
                          <Button
                            variant={event.isApproved ? "secondary" : "default"}
                            size="sm"
                            onClick={() => toggleApproval(event)}
                          >
                            {event.isApproved ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                Ocultar
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                Aprobar
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={syncingEventId === event.id}
                            onClick={() => handleSyncEvent(event)}
                          >
                            {syncingEventId === event.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sincronizando…
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Re-sincronizar
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Información</p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/30 p-3 text-center">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Slug
                          </p>
                          <p className="mt-1 font-mono text-sm text-foreground break-all">
                            {event.slug}
                          </p>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/30 p-3 text-center">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Sets vinculados
                          </p>
                          <p className="text-2xl font-semibold leading-tight text-foreground">
                            {event._count.sets}
                          </p>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/30 p-3 text-center">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Cartas relacionadas
                          </p>
                          <p className="text-2xl font-semibold leading-tight text-foreground">
                            {event._count.cards}
                          </p>
                        </div>
                      </div>
                      {event.rawDateText && (
                        <p className="text-sm text-muted-foreground">
                          Texto original: {event.rawDateText}
                        </p>
                      )}
                    </div>

                    {(Boolean(event.setDetails?.length) ||
                      event.missingSets.length > 0 ||
                      Boolean(event.missingCards?.length)) && (
                      <div className="space-y-6 rounded-xl border bg-muted/10 p-4">
                        {event.setDetails && event.setDetails.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                Collections & matches
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {event.setDetails.length} sets vinculados
                              </span>
                            </div>
                            <div className="space-y-4">
                              {event.setDetails.map((set) => {
                                const key = `${event.id}-${set.id}`;
                                const isOpen = eventSetMediaOpen[key];
                                return (
                                  <div
                                    key={key}
                                    className="space-y-3 rounded-lg border bg-background p-3"
                                  >
                                    <div className="flex flex-col gap-1">
                                      <p className="text-base font-semibold">
                                        {set.title}
                                      </p>
                                      {set.code && (
                                        <p className="text-xs text-muted-foreground">
                                          Código: {set.code}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-muted-foreground">
                                        Assets detectados
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleSetMedia(key)}
                                      >
                                        {isOpen
                                          ? "Ocultar media"
                                          : "Mostrar media"}
                                      </Button>
                                    </div>
                                    {isOpen && (
                                      <div className="space-y-4">
                                        {set.images &&
                                          set.images.length > 0 && (
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                              {set.images.map((img, index) => (
                                                <Image
                                                  key={`${key}-img-${index}`}
                                                  src={img}
                                                  alt={`${set.title} asset ${
                                                    index + 1
                                                  }`}
                                                  width={200}
                                                  height={200}
                                                  className="h-32 w-full rounded-lg border bg-white object-contain p-2"
                                                  onMouseEnter={() =>
                                                    handlePreviewEnter(
                                                      img,
                                                      `${set.title} asset ${
                                                        index + 1
                                                      }`
                                                    )
                                                  }
                                                  onMouseLeave={
                                                    handlePreviewLeave
                                                  }
                                                />
                                              ))}
                                            </div>
                                          )}
                                        {set.cards && set.cards.length > 0 && (
                                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            {set.cards.map((card) => (
                                              <div
                                                key={`${key}-card-${card.id}`}
                                                className="flex flex-col items-center gap-2 rounded-lg border bg-white p-2 text-center"
                                              >
                                                {card.image ? (
                                                  <Image
                                                    src={card.image}
                                                    alt={card.title}
                                                    width={200}
                                                    height={280}
                                                    className="h-48 w-full rounded object-contain"
                                                    onMouseEnter={() =>
                                                      handlePreviewEnter(
                                                        card.image,
                                                        `${card.title} (${
                                                          card.code ||
                                                          "Sin código"
                                                        })`
                                                      )
                                                    }
                                                    onMouseLeave={
                                                      handlePreviewLeave
                                                    }
                                                  />
                                                ) : (
                                                  <div className="flex h-48 w-full items-center justify-center rounded border text-xs text-muted-foreground">
                                                    Sin imagen
                                                  </div>
                                                )}
                                                <div className="text-[11px] text-muted-foreground">
                                                  <p className="font-semibold text-foreground">
                                                    {card.code || "Sin código"}
                                                  </p>
                                                  <p className="line-clamp-2">
                                                    {card.title}
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {event.missingSets.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-sm font-semibold">
                              Missing sets pendientes (
                              {event.missingSets.length})
                            </p>
                            <div className="space-y-3">
                              {event.missingSets.map((missing, index) => (
                                <div
                                  key={`${missing.id}-${index}`}
                                  className="space-y-2 rounded-lg border bg-background p-3"
                                >
                                  <div>
                                    <p className="text-sm font-semibold">
                                      {missing.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {missing.versionSignature || "Sin firma"}{" "}
                                      {missing.translatedTitle
                                        ? `→ ${missing.translatedTitle}`
                                        : ""}
                                    </p>
                                  </div>
                                  {missing.images &&
                                    missing.images.length > 0 && (
                                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {missing.images
                                          .slice(0, 4)
                                          .map((img, imgIndex) => (
                                            <Image
                                              key={`${missing.id}-img-${imgIndex}`}
                                              src={img}
                                              alt={`${missing.title} preview ${
                                                imgIndex + 1
                                              }`}
                                              width={220}
                                              height={220}
                                              className="h-56 w-full rounded bg-white object-contain p-1"
                                              onMouseEnter={() =>
                                                handlePreviewEnter(
                                                  img,
                                                  `${missing.title} preview ${
                                                    imgIndex + 1
                                                  }`
                                                )
                                              }
                                              onMouseLeave={handlePreviewLeave}
                                            />
                                          ))}
                                      </div>
                                    )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {event.missingCards &&
                          event.missingCards.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold mb-2">
                                Missing cards ({event.missingCards.length})
                              </p>
                              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                {event.missingCards.map((card, index) => (
                                  <div
                                    key={`${card.code}-missing-${index}`}
                                    className="flex flex-col items-center gap-3 rounded border bg-muted/20 p-3 text-center"
                                  >
                                    {card.imageUrl ? (
                                      <Image
                                        src={card.imageUrl}
                                        alt={card.title}
                                        width={160}
                                        height={220}
                                        className="h-52 w-full rounded bg-white object-contain p-2"
                                        onMouseEnter={() =>
                                          handlePreviewEnter(
                                            card.imageUrl!,
                                            `${card.title} (${card.code})`
                                          )
                                        }
                                        onMouseLeave={handlePreviewLeave}
                                      />
                                    ) : (
                                      <div className="flex h-52 w-full items-center justify-center rounded border text-xs text-muted-foreground">
                                        Sin imagen
                                      </div>
                                    )}
                                    <div className="flex w-full flex-col">
                                      <p className="text-sm font-semibold leading-tight">
                                        {card.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {card.code || "Sin código"}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <HoverImagePreviewOverlay preview={hoverPreview} />
    </div>
  );
};

export default AdminEventsPage;
