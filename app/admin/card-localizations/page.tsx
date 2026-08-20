"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Globe2,
  Languages,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Sparkles,
} from "lucide-react";

import { useUser } from "@/app/context/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

type QueueItem = {
  id: number;
  name: string;
  code: string;
  setCode: string;
  src: string;
  imageKey?: string | null;
  region?: string | null;
  updatedAt?: string;
  preview?: string | null;
  translationSources: string[];
  statusCounts: {
    draft: number;
    reviewed: number;
    approved: number;
    needsReview: number;
  };
  rowCount: number;
};

type QueueResponse = {
  items: QueueItem[];
  page: number;
  pageSize: number;
  totalCards: number;
  totalPages: number;
  stats: {
    totalRows: number;
    draftRows: number;
    reviewedRows: number;
    approvedRows: number;
    needsReviewRows: number;
    aiRows: number;
    glossaryRows: number;
    humanRows: number;
  };
};

type LocalizationEntry = {
  id: number;
  cardId: number;
  language: string;
  contentType: "NAME" | "TRIGGER" | "EFFECT" | "TEXT";
  sourceKey: string;
  sourceRecordId: number | null;
  sourceOrder: number;
  sourceText: string;
  translatedText: string;
  translationSource: "GLOSSARY" | "AI" | "HUMAN" | "IMPORTED";
  status: "DRAFT" | "REVIEWED" | "APPROVED" | "NEEDS_REVIEW";
  notes?: string | null;
};

type CardLocalizationResponse = {
  card: {
    id: number;
    name: string;
    triggerCard: string | null;
    effects: Array<{ id: number; cardId: number; effect: string }>;
    texts: Array<{ id: number; cardId: number; text: string }>;
  };
  localizations: LocalizationEntry[];
};

type EditableEntry = {
  sourceKey: string;
  translatedText: string;
  status: LocalizationEntry["status"];
  notes: string;
  translationSource: LocalizationEntry["translationSource"];
};

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "APPROVED", label: "Approved" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
] as const;

const SOURCE_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "GLOSSARY", label: "Glossary" },
  { value: "AI", label: "AI" },
  { value: "HUMAN", label: "Human" },
  { value: "IMPORTED", label: "Imported" },
] as const;

const CONTENT_OPTIONS = [
  { value: "all", label: "Todo" },
  { value: "NAME", label: "Name" },
  { value: "TRIGGER", label: "Trigger" },
  { value: "EFFECT", label: "Effect" },
  { value: "TEXT", label: "Text" },
] as const;

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "DRAFT", label: "Draft" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "APPROVED", label: "Approved" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
] as const;

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusBadgeClass(status: LocalizationEntry["status"]) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "REVIEWED":
      return "bg-sky-100 text-sky-700";
    case "NEEDS_REVIEW":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function sourceBadgeClass(source: LocalizationEntry["translationSource"]) {
  switch (source) {
    case "AI":
      return "bg-fuchsia-100 text-fuchsia-700";
    case "HUMAN":
      return "bg-emerald-100 text-emerald-700";
    case "IMPORTED":
      return "bg-indigo-100 text-indigo-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function AdminCardLocalizationsPage() {
  const router = useRouter();
  const { role, loading: userLoading } = useUser();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [contentFilter, setContentFilter] = useState("all");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueResponse["stats"] | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CardLocalizationResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState<"glossary" | "ai" | null>(null);
  const [editedEntries, setEditedEntries] = useState<Record<string, EditableEntry>>({});

  useEffect(() => {
    if (!userLoading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, router, userLoading]);

  const loadQueue = async () => {
    setQueueLoading(true);
    try {
      const params = new URLSearchParams({
        language: "es",
        pageSize: "36",
      });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter !== "all") params.set("translationSource", sourceFilter);
      if (contentFilter !== "all") params.set("contentType", contentFilter);

      const response = await fetch(`/api/admin/card-localizations?${params.toString()}`);
      if (!response.ok) {
        throw new Error("No se pudo cargar la cola de localizaciones");
      }

      const data = (await response.json()) as QueueResponse;
      setQueue(data.items);
      setStats(data.stats);
      setSelectedCardId((current) => {
        if (current && data.items.some((item) => item.id === current)) return current;
        return data.items[0]?.id ?? null;
      });
    } catch (error) {
      console.error(error);
      showErrorToast((error as Error).message);
    } finally {
      setQueueLoading(false);
    }
  };

  const loadDetail = async (cardId: number) => {
    setDetailLoading(true);
    try {
      const response = await fetch(
        `/api/admin/cards/${cardId}/localizations?language=es`
      );
      if (!response.ok) {
        throw new Error("No se pudo cargar el detalle de la carta");
      }

      const data = (await response.json()) as CardLocalizationResponse;
      setDetail(data);
      setEditedEntries(
        Object.fromEntries(
          data.localizations.map((entry) => [
            entry.sourceKey,
            {
              sourceKey: entry.sourceKey,
              translatedText: entry.translatedText,
              status: entry.status,
              notes: entry.notes ?? "",
              translationSource: entry.translationSource,
            },
          ])
        )
      );
    } catch (error) {
      console.error(error);
      showErrorToast((error as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (role === "ADMIN") {
      loadQueue();
    }
  }, [role]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (role === "ADMIN") {
        loadQueue();
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search, statusFilter, sourceFilter, contentFilter, role]);

  useEffect(() => {
    if (selectedCardId) {
      loadDetail(selectedCardId);
    } else {
      setDetail(null);
      setEditedEntries({});
    }
  }, [selectedCardId]);

  const orderedEntries = useMemo(() => {
    return [...(detail?.localizations ?? [])].sort((left, right) => {
      if (left.sourceOrder !== right.sourceOrder) {
        return left.sourceOrder - right.sourceOrder;
      }
      return left.id - right.id;
    });
  }, [detail]);

  const updateEditedEntry = (
    sourceKey: string,
    patch: Partial<EditableEntry>
  ) => {
    setEditedEntries((current) => ({
      ...current,
      [sourceKey]: {
        ...current[sourceKey],
        ...patch,
      },
    }));
  };

  const saveEntries = async (entries: LocalizationEntry[]) => {
    if (!detail) return;

    setSaving(true);
    try {
      const payloadEntries = entries.map((entry) => {
        const edited = editedEntries[entry.sourceKey];
        return {
          sourceKey: entry.sourceKey,
          translatedText: edited?.translatedText ?? entry.translatedText,
          status: edited?.status ?? entry.status,
          notes: edited?.notes ?? entry.notes ?? "",
          translationSource:
            edited?.translationSource ?? entry.translationSource,
        };
      });

      const response = await fetch(
        `/api/admin/cards/${detail.card.id}/localizations`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: "es",
            entries: payloadEntries,
          }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "No se pudo guardar la traducción");
      }

      showSuccessToast("Localizaciones guardadas");
      await Promise.all([loadDetail(detail.card.id), loadQueue()]);
    } catch (error) {
      console.error(error);
      showErrorToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!detail) return;
    await saveEntries(detail.localizations);
  };

  const handleApproveAll = async () => {
    if (!detail) return;

    setEditedEntries((current) =>
      Object.fromEntries(
        detail.localizations.map((entry) => [
          entry.sourceKey,
          {
            sourceKey: entry.sourceKey,
            translatedText:
              current[entry.sourceKey]?.translatedText ?? entry.translatedText,
            status: "APPROVED",
            notes: current[entry.sourceKey]?.notes ?? entry.notes ?? "",
            translationSource:
              current[entry.sourceKey]?.translationSource ??
              entry.translationSource,
          },
        ])
      )
    );

    await saveEntries(
      detail.localizations.map((entry) => ({
        ...entry,
        status: "APPROVED",
      }))
    );
  };

  const regenerate = async (mode: "glossary" | "ai") => {
    if (!detail) return;
    setRegenerating(mode);
    try {
      const response = await fetch(
        `/api/admin/cards/${detail.card.id}/localizations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: "es",
            mode,
            overwriteDrafts: true,
          }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "No se pudo regenerar la traducción");
      }

      showSuccessToast(
        mode === "ai"
          ? "Traducción con IA regenerada"
          : "Draft regenerado con glosario"
      );
      await Promise.all([loadDetail(detail.card.id), loadQueue()]);
    } catch (error) {
      console.error(error);
      showErrorToast((error as Error).message);
    } finally {
      setRegenerating(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 w-full">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Card Localizations
            </h1>
            <p className="text-sm text-slate-600">
              Revisa, edita y aprueba textos en español para cartas y proxies.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadQueue} disabled={queueLoading}>
              {queueLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Recargar cola
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Filas ES
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {stats?.totalRows ?? "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Draft
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-amber-700">
              {stats?.draftRows ?? "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                AI
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-fuchsia-700">
              {stats?.aiRows ?? "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-emerald-700">
              {stats?.approvedRows ?? "—"}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Queue</CardTitle>
              <div className="grid gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Buscar por nombre, code o set"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={contentFilter} onValueChange={setContentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Content" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {queueLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando cola...
                </div>
              ) : queue.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No hay cartas para esos filtros.
                </div>
              ) : (
                queue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedCardId(item.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedCardId === item.id
                        ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{item.name}</div>
                        <div
                          className={`text-xs ${
                            selectedCardId === item.id
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          {item.code} · {item.setCode}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          selectedCardId === item.id
                            ? "border-slate-600 text-slate-100"
                            : ""
                        }
                      >
                        {item.rowCount}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.translationSources.map((source) => (
                        <Badge
                          key={source}
                          className={
                            selectedCardId === item.id
                              ? "bg-slate-700 text-slate-100"
                              : source === "AI"
                                ? "bg-fuchsia-100 text-fuchsia-700"
                                : "bg-slate-100 text-slate-700"
                          }
                        >
                          {source}
                        </Badge>
                      ))}
                    </div>
                    {item.preview ? (
                      <p
                        className={`mt-2 line-clamp-2 text-xs ${
                          selectedCardId === item.id
                            ? "text-slate-300"
                            : "text-slate-500"
                        }`}
                      >
                        {item.preview}
                      </p>
                    ) : null}
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle className="text-base">
                    {detail?.card.name ?? "Selecciona una carta"}
                  </CardTitle>
                  {detail ? (
                    <p className="text-sm text-slate-500">
                      {detail.card.id} · Revisión ES
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => regenerate("glossary")}
                    disabled={!detail || regenerating !== null}
                  >
                    {regenerating === "glossary" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Languages className="mr-2 h-4 w-4" />
                    )}
                    Regenerar glosario
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => regenerate("ai")}
                    disabled={!detail || regenerating !== null}
                  >
                    {regenerating === "ai" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Regenerar IA
                  </Button>
                  <Button onClick={handleSaveAll} disabled={!detail || saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Guardar todo
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleApproveAll}
                    disabled={!detail || saving}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Aprobar todo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando detalle...
                </div>
              ) : !detail ? (
                <div className="py-16 text-center text-sm text-slate-500">
                  Elige una carta para revisar sus localizaciones.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:flex-row">
                    <img
                      src={queue.find((item) => item.id === detail.card.id)?.src || "/assets/images/backcard.webp"}
                      alt={detail.card.name}
                      className="h-44 w-32 rounded-lg border border-slate-200 object-cover"
                    />
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{detail.card.name}</Badge>
                        <Badge variant="outline">
                          <Globe2 className="mr-1 h-3 w-3" />
                          es
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        Revisa texto base, traducción, fuente y estado por cada
                        fragmento de la carta.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {orderedEntries.map((entry) => {
                      const edited = editedEntries[entry.sourceKey];
                      return (
                        <div
                          key={entry.sourceKey}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{entry.contentType}</Badge>
                              <Badge className={sourceBadgeClass(entry.translationSource)}>
                                {entry.translationSource}
                              </Badge>
                              <Badge className={statusBadgeClass(edited?.status ?? entry.status)}>
                                {edited?.status ?? entry.status}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Select
                                value={edited?.status ?? entry.status}
                                onValueChange={(value) =>
                                  updateEditedEntry(entry.sourceKey, {
                                    status: value as LocalizationEntry["status"],
                                  })
                                }
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                onClick={() => saveEntries([entry])}
                                disabled={saving}
                              >
                                <Save className="mr-2 h-4 w-4" />
                                Guardar
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Texto original</Label>
                              <div className="min-h-[132px] whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                {entry.sourceText}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Texto traducido</Label>
                              <Textarea
                                value={edited?.translatedText ?? entry.translatedText}
                                onChange={(event) =>
                                  updateEditedEntry(entry.sourceKey, {
                                    translatedText: event.target.value,
                                  })
                                }
                                className="min-h-[132px]"
                              />
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            <Label>Notas</Label>
                            <Input
                              value={edited?.notes ?? ""}
                              onChange={(event) =>
                                updateEditedEntry(entry.sourceKey, {
                                  notes: event.target.value,
                                })
                              }
                              placeholder="Notas editoriales o cambios pendientes"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
