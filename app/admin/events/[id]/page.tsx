"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SingleSelect from "@/components/SingleSelect";
import type { Option as SingleSelectOption } from "@/components/SingleSelect";
import EventCardPicker from "@/components/event/EventCardPicker";
import {
  Save,
  RefreshCw,
  Calendar,
  MapPin,
  Globe,
  Image as ImageIcon,
  ArrowLeft,
  Link as LinkIcon,
  Trash2,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

interface MissingSet {
  id: number;
  title: string;
  translatedTitle?: string | null;
  isApproved?: boolean;
}

interface EventSetEntry {
  set: {
    id: number;
    title: string;
    code?: string | null;
  };
}

interface EventCardEntry {
  card: {
    id: number;
    name: string;
    code: string;
  };
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
  missingSets: MissingSet[];
  sets: EventSetEntry[];
  cards: EventCardEntry[];
}

interface PageParams {
  params: { id: string };
}

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

const AdminEventDetailPage = ({ params }: PageParams) => {
  const eventId = Number(params.id);
  const router = useRouter();

  const [eventData, setEventData] = useState<AdminEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableSets, setAvailableSets] = useState<
    { id: number; title: string; code?: string | null }[]
  >([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [selectedSetOption, setSelectedSetOption] = useState<string>("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    locale: "",
    region: "GLOBAL",
    status: "UPCOMING",
    eventType: "OTHER",
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
    fetchEventDetails();
  }, [eventId]);

  useEffect(() => {
    fetchAvailableSets();
  }, []);

  useEffect(() => {
    if (eventData) {
      setForm({
        title: eventData.title || "",
        description: eventData.description || "",
        locale: eventData.locale || "",
        region: eventData.region || "GLOBAL",
        status: eventData.status || "UPCOMING",
        eventType: eventData.eventType || "OTHER",
        category: eventData.category || "",
        startDate: eventData.startDate ? eventData.startDate.slice(0, 16) : "",
        endDate: eventData.endDate ? eventData.endDate.slice(0, 16) : "",
        rawDateText: eventData.rawDateText || "",
        location: eventData.location || "",
        sourceUrl: eventData.sourceUrl || "",
        imageUrl: eventData.imageUrl || "",
        eventThumbnail: eventData.eventThumbnail || "",
      });
    }
  }, [eventData]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/events/${eventId}`);
      if (!response.ok) throw new Error("Failed to fetch event");
      const data = await response.json();
      setEventData(data);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar el evento");
      router.push("/admin/events");
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

  const handleFormChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!eventData) return;
    try {
      setSaving(true);
      const payload: any = {
        ...form,
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

      const response = await fetch(`/api/admin/events/${eventData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update event");
      await fetchEventDetails();
      showSuccessToast("Evento actualizado");
    } catch (error) {
      console.error(error);
      showErrorToast("Error al actualizar el evento");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkSet = async () => {
    if (!eventData || !selectedSetOption) return;
    try {
      const payload = { setId: Number(selectedSetOption) };
      const response = await fetch(`/api/admin/events/${eventData.id}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to link set");
      showSuccessToast("Set vinculado");
      setSelectedSetOption("");
      await fetchEventDetails();
    } catch (error) {
      console.error(error);
      showErrorToast("Error al vincular set");
    }
  };

  const handleRemoveSet = async (setId: number) => {
    if (!eventData) return;
    try {
      const response = await fetch(
        `/api/admin/events/${eventData.id}/sets/${setId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) throw new Error("Failed to unlink set");
      showSuccessToast("Set desvinculado");
      await fetchEventDetails();
    } catch (error) {
      console.error(error);
      showErrorToast("Error al desvincular set");
    }
  };

  const handleLinkCard = async (cardId?: number) => {
    if (!eventData) return;
    const targetId = cardId ?? undefined;
    if (!targetId) return;
    try {
      const response = await fetch(`/api/admin/events/${eventData.id}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: targetId }),
      });
      if (!response.ok) throw new Error("Failed to link card");
      showSuccessToast("Carta vinculada");
      await fetchEventDetails();
    } catch (error) {
      console.error(error);
      showErrorToast("Error al vincular carta");
    }
  };

  const handleRemoveCard = async (cardId: number) => {
    if (!eventData) return;
    try {
      const response = await fetch(
        `/api/admin/events/${eventData.id}/cards/${cardId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) throw new Error("Failed to unlink card");
      showSuccessToast("Carta desvinculada");
      await fetchEventDetails();
    } catch (error) {
      console.error(error);
      showErrorToast("Error al desvincular carta");
    }
  };

  const setOptions = useMemo<SingleSelectOption[]>(() => {
    const linkedSetIds = new Set(
      eventData?.sets.map((entry) => entry.set.id) ?? []
    );

    return availableSets
      .filter((set) => !linkedSetIds.has(set.id))
      .map((set) => ({
        value: String(set.id),
        label: `${set.title}${set.code ? ` (${set.code})` : ""}`,
      }));
  }, [availableSets, eventData?.sets]);

  const resolveSetLabel = (value: string) => {
    if (!value) return "";
    return setOptions.find((option) => option.value === value)?.label ?? value;
  };

  if (loading || !eventData) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Cargando evento...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 px-0">
            <Link href="/admin/events" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a eventos
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{eventData.title}</h1>
          <p className="text-muted-foreground">
            Slug: <span className="font-mono">{eventData.slug}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchEventDetails}
            disabled={saving}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refrescar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Guardar cambios
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Información general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => handleFormChange("title", e.target.value)}
                />
              </div>
              <div>
                <Label>Locale</Label>
                <Input
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
                  onChange={(e) => handleFormChange("category", e.target.value)}
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
                  onChange={(e) => handleFormChange("endDate", e.target.value)}
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
                onChange={(e) => handleFormChange("location", e.target.value)}
              />
            </div>
            <div>
              <Label>URL fuente</Label>
              <Input
                value={form.sourceUrl}
                onChange={(e) => handleFormChange("sourceUrl", e.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Imagen principal</Label>
                <Input
                  value={form.imageUrl}
                  onChange={(e) => handleFormChange("imageUrl", e.target.value)}
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
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Medios y enlaces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {eventData.sourceUrl ? (
              <p>
                <a
                  href={eventData.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary underline"
                >
                  <LinkIcon className="h-4 w-4" />
                  Ver página del evento
                </a>
              </p>
            ) : (
              <p>Sin URL del evento.</p>
            )}
            <div className="flex gap-4">
              {eventData.imageUrl && (
                <a
                  href={eventData.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary underline"
                >
                  <ImageIcon className="h-4 w-4" />
                  Imagen principal
                </a>
              )}
              {eventData.eventThumbnail && (
                <a
                  href={eventData.eventThumbnail}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary underline"
                >
                  <ImageIcon className="h-4 w-4" />
                  Thumbnail
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <Globe className="h-4 w-4" /> Región: {eventData.region}
              </span>
              {eventData.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Inicio: {new Date(eventData.startDate).toLocaleString()}
                </span>
              )}
              {eventData.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {eventData.location}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sets vinculados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Agregar set existente</Label>
                <Badge variant="secondary" className="text-xs">
                  {setOptions.length} disponibles
                </Badge>
              </div>
              <SingleSelect
                options={setOptions}
                selected={selectedSetOption || null}
                setSelected={(value) => setSelectedSetOption(value)}
                buttonLabel={
                  setsLoading ? "Cargando sets..." : "Selecciona un set"
                }
                displaySelectedAs={(value) =>
                  resolveSetLabel(value) ||
                  (setsLoading ? "Cargando sets..." : "Selecciona un set")
                }
                isSearchable
                isSolid
                isFullWidth
                isDisabled={setsLoading || setOptions.length === 0}
              />
              <Button
                className="w-full"
                onClick={handleLinkSet}
                disabled={!selectedSetOption}
              >
                Vincular set
              </Button>
            </div>

            {eventData.sets.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {eventData.sets.map((entry) => (
                  <div
                    key={entry.set.id}
                    className="rounded-xl border bg-background p-4 shadow-sm"
                  >
                    <div className="space-y-2">
                      <p className="text-lg font-semibold leading-tight">
                        {entry.set.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono">
                          ID #{entry.set.id}
                        </span>
                        {entry.set.code && (
                          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                            Código {entry.set.code}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4 inline-flex items-center gap-2 justify-start text-sm text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveSet(entry.set.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Remover set
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay sets vinculados.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cartas vinculadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EventCardPicker
              onCardSelected={(cardId) => handleLinkCard(cardId)}
            />

            {eventData.cards.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {eventData.cards.map((entry) => (
                  <div
                    key={entry.card.id}
                    className="rounded-xl border bg-background p-4 shadow-sm"
                  >
                    <div className="space-y-2">
                      <p className="text-lg font-semibold leading-tight">
                        {entry.card.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono">
                          ID #{entry.card.id}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                          Código {entry.card.code}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4 inline-flex items-center gap-2 justify-start text-sm text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveCard(entry.card.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Remover carta
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Missing sets del evento</CardTitle>
          </CardHeader>
          <CardContent>
            {eventData.missingSets.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {eventData.missingSets.map((missing) => (
                  <div
                    key={missing.id}
                    className="rounded-xl border bg-background p-4 shadow-sm"
                  >
                    <p className="text-lg font-semibold leading-tight">
                      {missing.title}
                    </p>
                    {missing.translatedTitle && (
                      <p className="text-sm text-muted-foreground">
                        {missing.translatedTitle}
                      </p>
                    )}
                    <div className="mt-3 text-xs text-muted-foreground">
                      ID #{missing.id}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay missing sets registrados.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminEventDetailPage;
