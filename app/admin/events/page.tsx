"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Calendar,
  MapPin,
  Globe,
  Edit3,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

interface MissingSetInfo {
  id: number;
  title: string;
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
  eventThumbnail?: string | null;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  missingSets: MissingSetInfo[];
  _count: {
    sets: number;
    cards: number;
    missingSets: number;
  };
}

type ApprovalFilter = "all" | "pending" | "approved";

const AdminEventsPage = () => {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [approvalFilter, setApprovalFilter] =
    useState<ApprovalFilter>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [approvalFilter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (approvalFilter !== "all") {
        params.set("approved", approvalFilter === "approved" ? "true" : "false");
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
    if (!searchTerm.trim()) return events;
    const term = searchTerm.toLowerCase();
    return events.filter(
      (event) =>
        event.title.toLowerCase().includes(term) ||
        event.slug.toLowerCase().includes(term) ||
        (event.sourceUrl && event.sourceUrl.toLowerCase().includes(term))
    );
  }, [events, searchTerm]);

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

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Eventos</h1>
          <p className="text-muted-foreground">
            Revisa, aprueba y navega a la vista detallada para editar eventos.
          </p>
        </div>
        <div className="flex gap-2">
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

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="Buscar por título, slug o URL..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full md:w-1/2"
        />
        <Button variant="outline" onClick={fetchEvents}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refrescar
        </Button>
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
          {filteredEvents.map((event) => (
            <Card key={event.id} className="border border-muted shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl">{event.title}</CardTitle>
                    <Badge
                      variant={event.isApproved ? "default" : "secondary"}
                    >
                      {event.isApproved ? "Aprobado" : "Pendiente"}
                    </Badge>
                    <Badge variant="outline">{event.status}</Badge>
                    <Badge variant="outline">{event.eventType}</Badge>
                    {event.category && (
                      <Badge variant="outline">{event.category}</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
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
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Información</p>
                    <p className="text-sm text-muted-foreground">
                      Slug: <span className="font-mono">{event.slug}</span>
                    </p>
                    {event.rawDateText && (
                      <p className="text-sm text-muted-foreground">
                        Texto original: {event.rawDateText}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Sets vinculados: {event._count.sets} • Cartas:{" "}
                      {event._count.cards}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Medios</p>
                    {(event.imageUrl || event.eventThumbnail) ? (
                      <div className="flex gap-2">
                        {event.imageUrl && (
                          <a
                            href={event.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary underline"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Imagen principal
                          </a>
                        )}
                        {event.eventThumbnail && (
                          <a
                            href={event.eventThumbnail}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary underline"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Thumbnail
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Sin imágenes registradas.
                      </p>
                    )}
                  </div>
                </div>
                {event.missingSets.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold">
                      Missing sets pendientes
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {event.missingSets.map((missing) => (
                        <Badge key={missing.id} variant="secondary">
                          {missing.title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminEventsPage;
