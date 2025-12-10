"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SingleSelect from "@/components/SingleSelect";
import type { Option as SingleSelectOption } from "@/components/SingleSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  RefreshCw,
  Calendar,
  MapPin,
  Globe,
  Edit3,
  Eye,
  EyeOff,
  Save,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

interface MissingSetInfo {
  id: number;
  title: string;
  translatedTitle?: string | null;
  createdAt: string;
  isApproved?: boolean;
}

interface AdminEvent {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  content?: string | null;
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
  sets?: Array<{
    set: {
      id: number;
      title: string;
      code?: string | null;
      image?: string | null;
    };
  }>;
  cards?: Array<{
    card: {
      id: number;
      name: string;
      code: string;
      imageKey?: string | null;
      src: string;
    };
  }>;
  _count: {
    sets: number;
    cards: number;
    missingSets: number;
  };
}

type ApprovalFilter = "all" | "pending" | "approved";

const EVENT_STATUS_OPTIONS = ["UPCOMING", "ONGOING", "COMPLETED"];
const EVENT_TYPE_OPTIONS = [
  "STORE_TOURNAMENT",
  "CHAMPIONSHIP",
  "RELEASE_EVENT",
  "ONLINE",
  "OTHER",
];
const EVENT_CATEGORY_OPTIONS = [
  "BEGINNER",
  "ROOKIES",
  "INTERMEDIATE",
  "COMPETITIVE",
];
const EVENT_REGION_OPTIONS = ["GLOBAL", "NA", "EU", "LA", "ASIA", "JP"];

const AdminEventsPage = () => {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [approvalFilter, setApprovalFilter] =
    useState<ApprovalFilter>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [editEvent, setEditEvent] = useState<AdminEvent | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] =
    useState<AdminEvent | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [availableSets, setAvailableSets] = useState<
    { id: number; title: string; code?: string | null }[]
  >([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [selectedSetOption, setSelectedSetOption] = useState<string>("");
  const [selectedMissingSetOption, setSelectedMissingSetOption] =
    useState<string>("");
  const [cardOptions, setCardOptions] = useState<SingleSelectOption[]>([]);
  const [cardOptionsLoading, setCardOptionsLoading] = useState(false);
  const [selectedCardOption, setSelectedCardOption] = useState<string>("");

  const setOptions = useMemo<SingleSelectOption[]>(() => {
    return availableSets.map((set) => ({
      value: String(set.id),
      label: `${set.title}${set.code ? ` (${set.code})` : ""}`,
    }));
  }, [availableSets]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    locale: "",
    region: "",
    status: "",
    eventType: "",
    category: "",
    startDate: "",
    endDate: "",
    rawDateText: "",
    location: "",
    sourceUrl: "",
    imageUrl: "",
    eventThumbnail: "",
  });

  useEffect(() => {
    fetchEvents();
  }, [approvalFilter]);

  useEffect(() => {
    if (availableSets.length === 0) {
      fetchAvailableSets();
    }
  }, []);

  useEffect(() => {
    if (editOpen && cardOptions.length === 0) {
      fetchCardOptions();
    }
  }, [editOpen, cardOptions.length]);

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

  const fetchAvailableSets = async () => {
    try {
      setSetsLoading(true);
      const response = await fetch("/api/admin/sets");
      if (!response.ok) throw new Error("Failed to fetch sets");
      const data = await response.json();
      const normalized = (Array.isArray(data) ? data : []).map((set) => ({
        id: set.id,
        title: set.title,
        code: set.code,
      }));
      setAvailableSets(normalized);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar sets disponibles");
    } finally {
      setSetsLoading(false);
    }
  };

  const fetchCardOptions = async () => {
    try {
      setCardOptionsLoading(true);
      const params = new URLSearchParams({
        includeRelations: "false",
        includeAlternates: "false",
        limit: "5000",
      });
      const response = await fetch(`/api/admin/cards?${params}`);
      if (!response.ok) throw new Error("Failed to fetch cards");
      const data = await response.json();
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : [];
      const options: SingleSelectOption[] = items.map((card: any) => ({
        value: String(card.id),
        label: `${card.name}${card.code ? ` (${card.code})` : ""}`,
      }));
      setCardOptions(options);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar cartas disponibles");
    } finally {
      setCardOptionsLoading(false);
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

  const openEditModal = (event: AdminEvent) => {
    setEditEvent(event);
    setForm({
      title: event.title || "",
      description: event.description || "",
      locale: event.locale || "",
      region: event.region || "",
      status: event.status || "UPCOMING",
      eventType: event.eventType || "OTHER",
      category: event.category || "",
      startDate: event.startDate
        ? event.startDate.slice(0, 16)
        : "",
      endDate: event.endDate ? event.endDate.slice(0, 16) : "",
      rawDateText: event.rawDateText || "",
      location: event.location || "",
      sourceUrl: event.sourceUrl || "",
      imageUrl: event.imageUrl || "",
      eventThumbnail: event.eventThumbnail || "",
    });
    setEditOpen(true);
    fetchEventDetails(event.id);
  };

  const closeEditModal = () => {
    setEditOpen(false);
    setEditEvent(null);
    setSelectedEventDetails(null);
    setSelectedSetOption("");
    setSelectedMissingSetOption("");
    setSelectedCardOption("");
  };

  const handleFormChange = (
    field: keyof typeof form,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const fetchEventDetails = async (eventId: number) => {
    try {
      setDetailsLoading(true);
      const response = await fetch(`/api/admin/events/${eventId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch event details");
      }
      const data = await response.json();
      setSelectedEventDetails(data);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar detalles del evento");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editEvent) return;
    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        locale: form.locale,
        region: form.region,
        status: form.status,
        eventType: form.eventType,
        category: form.category || null,
        rawDateText: form.rawDateText || null,
        location: form.location || null,
        sourceUrl: form.sourceUrl || null,
        imageUrl: form.imageUrl || null,
        eventThumbnail: form.eventThumbnail || null,
      };

      payload.startDate = form.startDate
        ? new Date(form.startDate).toISOString()
        : null;
      payload.endDate = form.endDate
        ? new Date(form.endDate).toISOString()
        : null;

      const response = await fetch(`/api/admin/events/${editEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update event");
      await fetchEvents();
      if (selectedEventDetails) {
        await fetchEventDetails(editEvent.id);
      }
      showSuccessToast("Evento actualizado");
      closeEditModal();
    } catch (error) {
      console.error(error);
      showErrorToast("Error al actualizar el evento");
    }
  };

  const toggleApproval = async (event: AdminEvent) => {
    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: !event.isApproved }),
      });
      if (!response.ok) throw new Error("Failed to update approval");
      await fetchEvents();
      if (selectedEventDetails && selectedEventDetails.id === event.id) {
        await fetchEventDetails(event.id);
      }
      showSuccessToast(
        !event.isApproved ? "Evento aprobado" : "Evento marcado como borrador"
      );
    } catch (error) {
      console.error(error);
      showErrorToast("Error al actualizar estado");
    }
  };

  const handleLinkSet = async () => {
    if (!editEvent || !selectedSetOption) return;
    try {
      const payload: any = { setId: Number(selectedSetOption) };
      if (selectedMissingSetOption) {
        payload.missingSetId = Number(selectedMissingSetOption);
      }
      const response = await fetch(
        `/api/admin/events/${editEvent.id}/sets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) throw new Error("Failed to link set");
      showSuccessToast("Set vinculado");
      setSelectedSetOption("");
      setSelectedMissingSetOption("");
      await fetchEventDetails(editEvent.id);
      await fetchEvents();
    } catch (error) {
      console.error(error);
      showErrorToast("Error al vincular set");
    }
  };

  const handleRemoveSet = async (setId: number) => {
    if (!editEvent) return;
    try {
      const response = await fetch(
        `/api/admin/events/${editEvent.id}/sets/${setId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) throw new Error("Failed to unlink set");
      showSuccessToast("Set desvinculado");
      await fetchEventDetails(editEvent.id);
      await fetchEvents();
    } catch (error) {
      console.error(error);
      showErrorToast("Error al desvincular set");
    }
  };

  const handleLinkCard = async (cardId?: number) => {
    if (!editEvent) return;
    const targetId =
      cardId ??
      (selectedCardOption ? Number(selectedCardOption) : undefined);
    if (!targetId) return;
    try {
      const response = await fetch(
        `/api/admin/events/${editEvent.id}/cards`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: targetId }),
        }
      );
      if (!response.ok) throw new Error("Failed to link card");
      showSuccessToast("Carta vinculada");
      setSelectedCardOption("");
      await fetchEventDetails(editEvent.id);
      await fetchEvents();
    } catch (error) {
      console.error(error);
      showErrorToast("Error al vincular carta");
    }
  };

  const handleRemoveCard = async (cardId: number) => {
    if (!editEvent) return;
    try {
      const response = await fetch(
        `/api/admin/events/${editEvent.id}/cards/${cardId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) throw new Error("Failed to unlink card");
      showSuccessToast("Carta desvinculada");
      await fetchEventDetails(editEvent.id);
      await fetchEvents();
    } catch (error) {
      console.error(error);
      showErrorToast("Error al desvincular carta");
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Eventos</h1>
          <p className="text-muted-foreground">
            Revisa, ajusta y aprueba los eventos detectados.
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
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
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
                  <Button variant="outline" size="sm" onClick={() => openEditModal(event)}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Editar
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar evento</DialogTitle>
            {editEvent && (
              <p className="text-sm text-muted-foreground">{editEvent.title}</p>
            )}
          </DialogHeader>
          {editEvent && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => handleFormChange("title", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="locale">Locale</Label>
                  <Input
                    id="locale"
                    value={form.locale}
                    onChange={(e) => handleFormChange("locale", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Región</Label>
                  <select
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    value={form.region}
                    onChange={(e) => handleFormChange("region", e.target.value)}
                  >
                    {EVENT_REGION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Estado</Label>
                  <select
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    value={form.status}
                    onChange={(e) => handleFormChange("status", e.target.value)}
                  >
                    {EVENT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <select
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    value={form.eventType}
                    onChange={(e) =>
                      handleFormChange("eventType", e.target.value)
                    }
                  >
                    {EVENT_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Categoría</Label>
                  <select
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    value={form.category}
                    onChange={(e) =>
                      handleFormChange("category", e.target.value)
                    }
                  >
                    <option value="">Sin categoría</option>
                    {EVENT_CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Fecha inicio</Label>
                  <Input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) =>
                      handleFormChange("startDate", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Fecha fin</Label>
                  <Input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) =>
                      handleFormChange("endDate", e.target.value)
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Texto de fecha</Label>
                <Input
                  value={form.rawDateText}
                  onChange={(e) =>
                    handleFormChange("rawDateText", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>Ubicación</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    handleFormChange("location", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>URL fuente</Label>
                <Input
                  value={form.sourceUrl}
                  onChange={(e) =>
                    handleFormChange("sourceUrl", e.target.value)
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Imagen principal</Label>
                  <Input
                    value={form.imageUrl}
                    onChange={(e) =>
                      handleFormChange("imageUrl", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Thumbnail</Label>
                  <Input
                    value={form.eventThumbnail}
                    onChange={(e) =>
                      handleFormChange("eventThumbnail", e.target.value)
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    handleFormChange("description", e.target.value)
                  }
                  rows={4}
                />
              </div>
              {detailsLoading ? (
                <p className="text-sm text-muted-foreground">
                  Cargando detalles del evento...
                </p>
              ) : selectedEventDetails ? (
                <div className="space-y-6 border-t pt-4">
                  <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                      <div className="flex-1 space-y-1">
                        <Label>Set existente</Label>
                        <SingleSelect
                          options={setOptions}
                          selected={selectedSetOption || null}
                          setSelected={(value) => setSelectedSetOption(value)}
                          buttonLabel={
                            setsLoading
                              ? "Cargando sets..."
                              : "Selecciona un set"
                          }
                          isSearchable
                          isSolid
                          isFullWidth
                          isDisabled={setsLoading || setOptions.length === 0}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label>Missing set (opcional)</Label>
                        <SingleSelect
                          options={[
                            { value: "none", label: "Sin selección" },
                            ...(selectedEventDetails.missingSets || [])
                              .filter((ms) => !ms.isApproved)
                              .map((ms) => ({
                                value: String(ms.id),
                                label: ms.title,
                              })),
                          ]}
                          selected={
                            selectedMissingSetOption || selectedMissingSetOption === ""
                              ? selectedMissingSetOption || null
                              : null
                          }
                          setSelected={(value) =>
                            setSelectedMissingSetOption(
                              value === "none" ? "" : value
                            )
                          }
                          buttonLabel="Missing set"
                          isSearchable
                          isSolid
                          isFullWidth
                        />
                      </div>
                      <div>
                        <Button
                          className="w-full lg:w-auto"
                          onClick={handleLinkSet}
                          disabled={!selectedSetOption}
                        >
                          Vincular set
                        </Button>
                      </div>
                    </div>
                    {selectedEventDetails.sets &&
                    selectedEventDetails.sets.length > 0 ? (
                      <div className="space-y-2">
                        {selectedEventDetails.sets.map((entry) => (
                          <div
                            key={entry.set.id}
                            className="flex items-center justify-between rounded-md border p-2 text-sm"
                          >
                            <div>
                              <p className="font-semibold">
                                {entry.set.title}
                              </p>
                              <p className="text-muted-foreground">
                                ID: {entry.set.id}{" "}
                                {entry.set.code
                                  ? `• ${entry.set.code}`
                                  : ""}
                              </p>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                handleRemoveSet(entry.set.id)
                              }
                            >
                              Remover
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No hay sets vinculados.
                      </p>
                    )}
                  </div>
                  <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                      <div className="flex-1 space-y-1">
                        <Label>Carta existente</Label>
                        <SingleSelect
                          options={cardOptions}
                          selected={selectedCardOption || null}
                          setSelected={(value) => setSelectedCardOption(value)}
                          buttonLabel={
                            cardOptionsLoading
                              ? "Cargando cartas..."
                              : "Selecciona una carta"
                          }
                          isSearchable
                          isSolid
                          isFullWidth
                          isDisabled={
                            cardOptionsLoading || cardOptions.length === 0
                          }
                        />
                      </div>
                      <div>
                        <Button
                          className="w-full lg:w-auto"
                          onClick={() => handleLinkCard()}
                          disabled={!selectedCardOption}
                        >
                          Vincular carta
                        </Button>
                      </div>
                    </div>
                    {selectedEventDetails.cards &&
                    selectedEventDetails.cards.length > 0 ? (
                      <div className="space-y-2">
                        {selectedEventDetails.cards.map((entry) => (
                          <div
                            key={entry.card.id}
                            className="flex items-center justify-between rounded-md border p-2 text-sm"
                          >
                            <div>
                              <p className="font-semibold">
                                {entry.card.name}
                              </p>
                              <p className="text-muted-foreground">
                                ID: {entry.card.id} • {entry.card.code}
                              </p>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                handleRemoveCard(entry.card.id)
                              }
                            >
                              Remover
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No hay cartas vinculadas.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">
                      Missing sets del evento
                    </p>
                    {selectedEventDetails.missingSets &&
                    selectedEventDetails.missingSets.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedEventDetails.missingSets.map(
                          (missing) => (
                            <Badge
                              key={missing.id}
                              variant={
                                missing.isApproved
                                  ? "outline"
                                  : "secondary"
                              }
                            >
                              {missing.title}
                            </Badge>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No hay missing sets registrados.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={closeEditModal}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEventsPage;
