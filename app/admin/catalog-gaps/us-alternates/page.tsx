"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { proxyImage } from "@/lib/proxyImage";
import { useUser } from "@/app/context/UserContext";
import { altArtOptions } from "@/helpers/constants";
import {
  Search,
  ExternalLink,
  Loader2,
  Images,
  Check,
  X,
  Plus,
  Undo2,
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from "lucide-react";

type Row = {
  productId: number;
  origin: string; // "tcgplayer" | "events"
  type: string; // "new" | "alt-art"
  variant: string | null; // reprint | parallel | manga | prize | null
  code: string;
  setCode: string;
  name: string;
  rarity: string | null;
  cardType: string | null;
  imageUrl: string | null;
  url: string | null;
  ourCount: number;
  tcgTotal: number;
  dotggTotal: number;
  expected: number;
  sources: string[];
  likelyMissing: boolean;
  refKey: string;
  status: string | null;
};

type Stats = {
  totalCandidates: number;
  likelyMissing: number;
  corroborated: number;
  fromEvents: number;
  newCards: number;
  altArts: number;
  reviewed: number;
  codesAffected: number;
  bySet: { setCode: string; count: number }[];
  byRarity: { rarity: string; count: number }[];
  health?: SyncHealth;
};

type SyncHealth = {
  status: "healthy" | "warning" | "stale";
  lastCatalogSyncAt: string | null;
  lastGapRunAt: string | null;
  catalogAgeHours: number | null;
  gapAgeHours: number | null;
  gapLagHours: number | null;
  catalogItemCount: number;
  openGapCount: number;
  issues: string[];
};

type EventSuggestion = {
  code: string;
  cardTitle: string;
  eventTitle: string;
  suggestedAlternateArt: string;
  suggestedSetTitle: string;
  isGenericPack: boolean;
  existingSetId: number | null;
  existingSetTitle: string | null;
  siblingCount: number;
};

type SetOption = { id: number; title: string; code: string | null };

type CompareSetOption = {
  setId: number | null;
  title: string;
  code: string | null;
  sources: string[];
  matchedBy: string | null;
  existsInDb?: boolean;
};

type ComparePayload = {
  productId: number;
  code: string;
  productName: string | null;
  tcgplayer: {
    groupName: string | null;
    groupAbbreviation: string | null;
    suggestedSets: {
      setId: number | null;
      title: string;
      code: string | null;
      matchedBy: string | null;
    }[];
  };
  limitless: {
    cardUrl: string;
    pageTitle: string | null;
    matchedPrint: {
      setId: number | null;
      title: string;
      code: string | null;
      matchedBy: string | null;
      productId: number | null;
      tcgUrl: string | null;
      usdPrice: string | null;
    } | null;
    prints: {
      title: string;
      productId: number | null;
      tcgUrl: string | null;
      usdPrice: string | null;
      matchedProduct: boolean;
    }[];
  };
  setOptions: CompareSetOption[];
  conflicts: {
    set: boolean;
  };
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAge(hours?: number | null) {
  if (hours == null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

export default function UsAlternatesPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useUser();

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  // Modal de revisión: comparar el candidato con las cartas que ya tengo.
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [haveCards, setHaveCards] = useState<any[]>([]);
  const [haveLoading, setHaveLoading] = useState(false);
  // Preview grande al pasar el mouse sobre una miniatura — para distinguir
  // alternas parecidas sin tener que adivinar por la imagen chiquita.
  const [hoverCard, setHoverCard] = useState<any | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareData, setCompareData] = useState<ComparePayload | null>(null);
  const [selectedSetKey, setSelectedSetKey] = useState<string | null>(null);

  // Picker de set + arte alterno para cartas de EVENTO (prize cards): elegir
  // el set sugerido (el pack real, ej. "CS 26-27 Event Pack"), uno existente
  // buscándolo, o crear uno nuevo — y corregir el arte alterno detectado.
  const [eventSuggestion, setEventSuggestion] = useState<EventSuggestion | null>(null);
  const [eventSuggestionLoading, setEventSuggestionLoading] = useState(false);
  const [eventAltArt, setEventAltArt] = useState("");
  const [eventSetMode, setEventSetMode] = useState<"suggested" | "existing" | "new">("suggested");
  const [eventExistingSetId, setEventExistingSetId] = useState<number | null>(null);
  const [eventNewSetTitle, setEventNewSetTitle] = useState("");
  const [pickSetRaw, setPickSetRaw] = useState("");
  const pickSetQuery = useDebounced(pickSetRaw, 300);
  const [setSearchResults, setSetSearchResults] = useState<SetOption[]>([]);
  const [setSearchLoading, setSetSearchLoading] = useState(false);
  // Recuerda el set elegido la última vez para cada "pack" (mc.title) — así,
  // si vienes procesando 8 cartas del mismo "CS 26-27 Event Pack" seguidas,
  // la siguiente ya abre con ese mismo set preseleccionado.
  const [lastSetByPack, setLastSetByPack] = useState<Record<string, SetOption>>({});

  const [onlyMissing, setOnlyMissing] = useState(true);
  const [onlyCorroborated, setOnlyCorroborated] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showReviewed, setShowReviewed] = useState(false);
  const [setCode, setSetCode] = useState("");
  const [rarity, setRarity] = useState("");
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounced(searchRaw, 300);
  const [page, setPage] = useState(1);
  const pageSize = 60;

  useEffect(() => {
    if (!roleLoading && role !== "ADMIN") router.push("/unauthorized");
  }, [role, roleLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (onlyMissing) p.set("onlyMissing", "1");
      if (onlyCorroborated) p.set("corroborated", "1");
      if (sourceFilter) p.set("source", sourceFilter);
      if (typeFilter) p.set("type", typeFilter);
      if (showReviewed) p.set("showReviewed", "1");
      if (setCode) p.set("setCode", setCode);
      if (rarity) p.set("rarity", rarity);
      if (search) p.set("search", search);
      p.set("page", String(page));
      p.set("pageSize", String(pageSize));
      const res = await fetch(`/api/admin/catalog-gaps/us-alternates?${p.toString()}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [onlyMissing, onlyCorroborated, sourceFilter, typeFilter, showReviewed, setCode, rarity, search, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [onlyMissing, onlyCorroborated, sourceFilter, typeFilter, showReviewed, setCode, rarity, search]);

  const review = async (r: Row, status: "have" | "ignored" | "none") => {
    // Optimista: si estamos ocultando revisadas, quitar la fila.
    if (!showReviewed && status !== "none") {
      setRows((rs) => rs.filter((x) => x.refKey !== r.refKey));
    } else {
      setRows((rs) =>
        rs.map((x) => (x.refKey === r.refKey ? { ...x, status: status === "none" ? null : status } : x))
      );
    }
    try {
      await fetch("/api/admin/catalog-gaps/us-alternates/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refKey: r.refKey, code: r.code, status }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Al abrir el modal, trae las cartas que YA tengo con ese código.
  useEffect(() => {
    if (!detailRow) {
      setHaveCards([]);
      return;
    }
    let cancelled = false;
    setHaveLoading(true);
    fetch(`/api/admin/cards/by-code/${encodeURIComponent(detailRow.code)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (cancelled) return;
        // Solo US (region null = US legacy). Las demás regiones no aplican aquí.
        const list = Array.isArray(d) ? d : [];
        setHaveCards(
          list.filter((c: any) => c?.region === "US" || c?.region == null)
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHaveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailRow]);

  useEffect(() => {
    if (!detailRow || detailRow.origin !== "tcgplayer") {
      setCompareData(null);
      setSelectedSetKey(null);
      setCompareLoading(false);
      return;
    }

    let cancelled = false;
    setCompareLoading(true);
    fetch(
      `/api/admin/catalog-gaps/us-alternates/compare?productId=${detailRow.productId}&code=${encodeURIComponent(
        detailRow.code
      )}`
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("compare failed"))))
      .then((data: ComparePayload) => {
        if (cancelled) return;
        setCompareData(data);
        const preferred =
          data.setOptions.find((option) => option.sources.includes("limitless")) ??
          data.setOptions[0] ??
          null;
        const defaultKey = preferred
          ? preferred.setId != null
            ? `id:${preferred.setId}`
            : `title:${preferred.title}::${preferred.code ?? ""}`
          : null;
        setSelectedSetKey(defaultKey);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(error);
          setCompareData(null);
          setSelectedSetKey(null);
        }
      })
      .finally(() => {
        if (!cancelled) setCompareLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailRow]);

  // Sugerencia de set + arte alterno para cartas de EVENTO.
  useEffect(() => {
    if (!detailRow || detailRow.origin !== "events") {
      setEventSuggestion(null);
      setEventAltArt("");
      setEventSetMode("suggested");
      setEventExistingSetId(null);
      setEventNewSetTitle("");
      setPickSetRaw("");
      setSetSearchResults([]);
      return;
    }

    let cancelled = false;
    setEventSuggestionLoading(true);
    const missingCardId = -detailRow.productId;
    fetch(`/api/admin/catalog-gaps/us-alternates/event-suggestions?missingCardId=${missingCardId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("suggestion failed"))))
      .then((data: EventSuggestion) => {
        if (cancelled) return;
        setEventSuggestion(data);
        setEventAltArt(data.suggestedAlternateArt);
        // Si ya procesamos otra carta de este mismo pack, reusa ese set.
        const remembered = lastSetByPack[data.cardTitle];
        if (remembered) {
          setEventSetMode("existing");
          setEventExistingSetId(remembered.id);
          setEventNewSetTitle(remembered.title);
        } else {
          setEventSetMode("suggested");
          setEventExistingSetId(data.existingSetId);
          setEventNewSetTitle(data.suggestedSetTitle);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(error);
          setEventSuggestion(null);
        }
      })
      .finally(() => {
        if (!cancelled) setEventSuggestionLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailRow]);

  // Buscar sets existentes mientras el operador escribe (para "elegir set existente").
  useEffect(() => {
    if (eventSetMode !== "existing" || !pickSetQuery.trim()) {
      setSetSearchResults([]);
      return;
    }
    let cancelled = false;
    setSetSearchLoading(true);
    fetch(`/api/admin/sets/search?title=${encodeURIComponent(pickSetQuery.trim())}&limit=8`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setSetSearchResults(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSetSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setSetSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventSetMode, pickSetQuery]);

  // "Ya la tengo, ES ESTA": linkea el candidato a una carta existente.
  const linkToCard = async (r: Row, cardId: number) => {
    setBusy((b) => new Set(b).add(r.refKey));
    try {
      const isEvent = r.origin === "events";
      const payload = isEvent
        ? { origin: "events", missingCardId: -r.productId, cardId }
        : { origin: "tcgplayer", productId: r.productId, cardId };
      const res = await fetch("/api/admin/catalog-gaps/us-alternates/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRows((rs) => rs.filter((x) => x.refKey !== r.refKey));
        setDetailRow(null);
        setMsg(`✓ ${r.code} linkeada a una carta que ya tenías`);
      } else {
        setMsg(`✕ ${r.code}: ${data.error ?? "no se pudo linkear"}`);
      }
    } catch (e: any) {
      setMsg(`✕ ${r.code}: ${e?.message ?? "error"}`);
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(r.refKey);
        return n;
      });
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const createAlternate = async (
    r: Row,
    overrideSet?: { setId: number | null; title: string; code: string | null } | null,
    eventOverride?: { setId: number | null; setTitle: string | null; alternateArt: string | null } | null
  ) => {
    setBusy((b) => new Set(b).add(r.refKey));
    try {
      // Eventos: crear desde el MissingCard (productId es -missingCardId).
      const isEvent = r.origin === "events";
      const endpoint = isEvent
        ? "/api/admin/catalog-gaps/us-alternates/create-from-event"
        : "/api/admin/catalog-gaps/us-alternates/create";
      const payload = isEvent
        ? {
            missingCardId: -r.productId,
            ...(eventOverride?.setId != null ? { overrideSetId: Number(eventOverride.setId) } : {}),
            ...(eventOverride?.setId == null && eventOverride?.setTitle
              ? { overrideSetTitle: eventOverride.setTitle }
              : {}),
            ...(eventOverride?.alternateArt
              ? { overrideAlternateArt: eventOverride.alternateArt }
              : {}),
          }
        : {
            productId: r.productId,
            ...(overrideSet?.setId != null
              ? { overrideSetId: Number(overrideSet.setId) }
              : {}),
            ...(overrideSet?.setId == null && overrideSet?.title
              ? {
                  overrideSetTitle: overrideSet.title,
                  overrideSetCode: overrideSet.code,
                }
              : {}),
          };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.cardId) {
        setRows((rs) => rs.filter((x) => x.refKey !== r.refKey));
        const detail = isEvent
          ? `${data.alternateArt}${data.setTitle ? ` · ${data.setTitle}` : ""}`
          : data.mode === "new-base"
            ? "carta nueva completa"
            : "alterna";
        setMsg(`✓ ${r.code} creada (${detail})`);
        if (isEvent && data.setId && data.setTitle && eventSuggestion) {
          setLastSetByPack((m) => ({
            ...m,
            [eventSuggestion.cardTitle]: { id: data.setId, title: data.setTitle, code: null },
          }));
        }
      } else {
        setMsg(`✕ ${r.code}: ${data.error ?? "no se pudo crear"}`);
      }
    } catch (e: any) {
      setMsg(`✕ ${r.code}: ${e?.message ?? "error"}`);
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(r.refKey);
        return n;
      });
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (roleLoading || role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {msg && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {msg}
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
          <Images className="h-4 w-4" />
          Cobertura US
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Cartas US que me faltan
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Todo lo que <strong>TCGplayer, DotGG o los eventos</strong> reportan
          para US y no está en tu catálogo: <strong>cartas nuevas</strong> que no
          tienes y <strong>alt-arts</strong> de cartas que sí tienes.
        </p>

        {stats?.health && (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 ${
              stats.health.status === "healthy"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
                : stats.health.status === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
            }`}
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="pt-0.5">
                {stats.health.status === "healthy" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold">
                    {stats.health.status === "healthy"
                      ? "Mirror y reconciliación al día"
                      : stats.health.status === "warning"
                        ? "Cobertura con retraso leve"
                        : "Cobertura desactualizada"}
                  </div>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide dark:bg-slate-900/40">
                    {stats.health.catalogItemCount.toLocaleString()} productos
                  </span>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide dark:bg-slate-900/40">
                    {stats.health.openGapCount.toLocaleString()} gaps abiertos
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    Mirror: {formatDateTime(stats.health.lastCatalogSyncAt)} · hace{" "}
                    {formatAge(stats.health.catalogAgeHours)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    Reconcile: {formatDateTime(stats.health.lastGapRunAt)} · hace{" "}
                    {formatAge(stats.health.gapAgeHours)}
                  </span>
                  {stats.health.gapLagHours != null && stats.health.gapLagHours > 0 && (
                    <span>Lag entre sync y reconcile: {formatAge(stats.health.gapLagHours)}</span>
                  )}
                </div>
                {stats.health.issues.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs">
                    {stats.health.issues.map((issue) => (
                      <div key={issue}>{issue}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filtro rápido por tipo */}
        <div className="mt-5 flex flex-wrap gap-2">
          <TypeBtn active={typeFilter === ""} onClick={() => setTypeFilter("")} label="Todo" value={stats?.likelyMissing} />
          <TypeBtn active={typeFilter === "new"} onClick={() => setTypeFilter("new")} label="Cartas nuevas" value={stats?.newCards} tone="blue" />
          <TypeBtn active={typeFilter === "alt-art"} onClick={() => setTypeFilter("alt-art")} label="Alt-arts" value={stats?.altArts} tone="rose" />
          <TypeBtn active={typeFilter === "" && false} onClick={() => setSourceFilter(sourceFilter === "events" ? "" : "events")} label="Solo prize (eventos)" value={stats?.fromEvents} tone="violet" activeOverride={sourceFilter === "events"} />
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Total faltantes" value={stats?.likelyMissing} tone="rose" />
          <Stat label="Corroboradas 2+" value={stats?.corroborated} tone="emerald" />
          <Stat label="De eventos (prize)" value={stats?.fromEvents} tone="violet" />
          <Stat label="Códigos afectados" value={stats?.codesAffected} tone="amber" />
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-medium text-slate-500">Por rareza</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {(stats?.byRarity ?? []).slice(0, 6).map((r) => (
                <span
                  key={r.rarity}
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {r.rarity} {r.count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Top sets */}
        {stats?.bySet && stats.bySet.length > 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap gap-1.5">
              {stats.bySet.slice(0, 20).map((s) => (
                <button
                  key={s.setCode}
                  onClick={() => setSetCode(setCode === s.setCode ? "" : s.setCode)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition ${
                    setCode === s.setCode
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {s.setCode}
                  <span className="text-slate-400">{s.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              placeholder="Buscar código o nombre…"
              className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Todas las rarezas</option>
            {(stats?.byRarity ?? []).map((r) => (
              <option key={r.rarity} value={r.rarity}>
                {r.rarity} ({r.count})
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Cualquier fuente</option>
            <option value="tcgplayer">TCGplayer</option>
            <option value="dotgg">DotGG</option>
            <option value="events">Eventos (prize)</option>
          </select>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(e) => setOnlyMissing(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            Solo donde faltan
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <input
              type="checkbox"
              checked={onlyCorroborated}
              onChange={(e) => setOnlyCorroborated(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            Solo corroboradas 2+
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <input
              type="checkbox"
              checked={showReviewed}
              onChange={(e) => setShowReviewed(e.target.checked)}
              className="h-4 w-4 accent-slate-600"
            />
            Ver revisadas {stats?.reviewed ? `(${stats.reviewed})` : ""}
          </label>
          {(setCode || rarity || search || sourceFilter || !onlyMissing || onlyCorroborated) && (
            <button
              onClick={() => {
                setSetCode("");
                setRarity("");
                setSearchRaw("");
                setSourceFilter("");
                setOnlyMissing(true);
                setOnlyCorroborated(false);
              }}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Limpiar
            </button>
          )}
          <span className="ml-auto text-sm text-slate-400">
            {total.toLocaleString()} impresiones
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            Sin alt-arts faltantes con estos filtros. 🎉
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {rows.map((r) => (
              <div
                key={r.productId}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailRow(r)}
                  onKeyDown={(e) => e.key === "Enter" && setDetailRow(r)}
                  className="relative aspect-[5/7] cursor-pointer bg-slate-100 dark:bg-slate-800"
                  title="Revisar: comparar con lo que ya tengo y linkear"
                >
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.origin === "events" ? proxyImage(r.imageUrl) : r.imageUrl}
                      alt={r.code}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <Images className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                    Revisar <Search className="h-3 w-3" />
                  </div>
                  <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
                    {r.type === "new" && (
                      <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        NUEVA
                      </span>
                    )}
                    {r.rarity && (
                      <span className="rounded bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-800">
                        {r.rarity}
                      </span>
                    )}
                    {r.variant === "prize" && (
                      <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        PRIZE
                      </span>
                    )}
                    {r.variant === "reprint" && (
                      <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        REPRINT
                      </span>
                    )}
                    {r.variant === "parallel" && (
                      <span className="rounded bg-fuchsia-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        PARALLEL
                      </span>
                    )}
                    {r.variant === "manga" && (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        MANGA
                      </span>
                    )}
                    {r.status === "have" && (
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        YA LA TENGO
                      </span>
                    )}
                    {r.status === "ignored" && (
                      <span className="rounded bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        IGNORADA
                      </span>
                    )}
                  </div>

                  {/* Acciones de triage */}
                  <div className="absolute inset-x-0 bottom-0 flex opacity-0 transition group-hover:opacity-100">
                    {r.status ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          review(r, "none");
                        }}
                        className="flex flex-1 items-center justify-center gap-1 bg-slate-800/90 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Deshacer
                      </button>
                    ) : (
                      <>
                        {r.origin === "tcgplayer" || r.origin === "events" ? (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              createAlternate(r);
                            }}
                            disabled={busy.has(r.refKey)}
                            className="flex flex-1 items-center justify-center gap-1 bg-blue-600/95 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
                            title={
                              r.origin === "events"
                                ? "Crear la alterna con la imagen del evento (tipo y set automáticos)"
                                : "Crear la alterna en tu catálogo (set desde TCGplayer)"
                            }
                          >
                            {busy.has(r.refKey) ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            {busy.has(r.refKey)
                              ? "Creando…"
                              : r.type === "new"
                                ? "Crear carta"
                                : "Crear alterna"}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              review(r, "have");
                            }}
                            className="flex flex-1 items-center justify-center gap-1 bg-emerald-600/90 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" /> Ya la tengo
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            review(r, "have");
                          }}
                          className="flex items-center justify-center gap-1 bg-emerald-600/80 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          title="Ya la tengo (solo marcar, no crear)"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            review(r, "ignored");
                          }}
                          className="flex items-center justify-center gap-1 bg-slate-700/90 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                          title="Ignorar"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-mono text-xs font-semibold">{r.code}</span>
                    {/* Puntos de fuente: qué fuentes lo corroboran */}
                    <span className="flex shrink-0 items-center gap-0.5" title={`Fuentes: ${r.sources.join(", ") || "—"}`}>
                      {r.sources.includes("tcgplayer") && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                      {r.sources.includes("dotgg") && <span className="h-2 w-2 rounded-full bg-fuchsia-500" />}
                      {r.sources.includes("events") && <span className="h-2 w-2 rounded-full bg-violet-500" />}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-slate-500" title={r.name}>{r.name}</div>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-400">
                      {r.type === "new" ? "No la tienes" : "Sin linkear en tu catálogo"}
                    </span>
                    {/* Fuentes que la corroboran */}
                    <span className="flex shrink-0 items-center gap-0.5" title={`Fuentes: ${r.sources.join(", ") || "—"}`}>
                      {r.sources.includes("tcgplayer") && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                      {r.sources.includes("dotgg") && <span className="h-2 w-2 rounded-full bg-fuchsia-500" />}
                      {r.sources.includes("events") && <span className="h-2 w-2 rounded-full bg-violet-500" />}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Anterior
            </button>
            <span className="text-slate-500">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Modal de revisión: comparar con lo que ya tengo y linkear/crear */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetailRow(null)}
        >
          {/* Preview grande al hacer hover sobre una miniatura de "cartas que ya
              tengo" — fixed y por encima de todo para que no lo tape el scroll
              del modal ni quede recortado por su overflow. */}
          {hoverCard && (
            <div className="pointer-events-none fixed right-4 top-1/2 z-[60] w-64 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:right-8 sm:w-72">
              <div className="overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                {hoverCard.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hoverCard.src}
                    alt={hoverCard.alternateArt || "base"}
                    className="w-full"
                  />
                ) : (
                  <div className="aspect-[5/7] w-full" />
                )}
              </div>
              <div className="mt-2 space-y-0.5 text-xs">
                <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  {hoverCard.code}
                </div>
                <div className="font-semibold text-slate-700 dark:text-slate-200">
                  {hoverCard.isFirstEdition ? "Base" : hoverCard.alternateArt || "Alterna"}
                </div>
                {Array.isArray(hoverCard.sets) && hoverCard.sets.length > 0 && (
                  <div className="text-slate-500 dark:text-slate-400">
                    {hoverCard.sets.map((s: any) => s.set?.title).filter(Boolean).join(" · ")}
                  </div>
                )}
                <div className="flex flex-wrap gap-1 pt-1">
                  {hoverCard.rarity && (
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {hoverCard.rarity}
                    </span>
                  )}
                  {hoverCard.region && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {hoverCard.region}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm font-bold">{detailRow.code}</div>
                <div className="text-sm text-slate-500">{detailRow.name}</div>
              </div>
              <button
                onClick={() => setDetailRow(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
              {/* Candidato */}
              <div>
                <div className="aspect-[5/7] overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {detailRow.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={
                        detailRow.origin === "events"
                          ? proxyImage(detailRow.imageUrl)
                          : detailRow.imageUrl
                      }
                      alt={detailRow.code}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <Images className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-slate-700">
                    {detailRow.origin === "events" ? "Evento (prize)" : "TCGplayer"}
                  </span>
                  {detailRow.rarity && (
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                      {detailRow.rarity}
                    </span>
                  )}
                  {detailRow.variant && (
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                      {detailRow.variant}
                    </span>
                  )}
                </div>
                {detailRow.url && (
                  <a
                    href={detailRow.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    Ver fuente <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Cartas que ya tengo */}
              <div>
                <h3 className="text-sm font-semibold">
                  Cartas que ya tengo con{" "}
                  <span className="font-mono">{detailRow.code}</span>
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Compara la imagen. Si alguna es esta misma versión, linkéala; si
                  no, crea una nueva alterna.
                </p>

                {detailRow.origin === "tcgplayer" && (
                  <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Comparación de Fuentes
                      </h4>
                      {compareData?.conflicts.set && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Conflicto de set
                        </span>
                      )}
                    </div>

                    {compareLoading ? (
                      <div className="py-4 text-center">
                        <Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" />
                      </div>
                    ) : compareData ? (
                      <div className="mt-3 space-y-3 text-xs">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-800/60">
                            <div className="font-semibold text-slate-700 dark:text-slate-200">
                              TCGplayer
                            </div>
                            <div className="mt-1 text-slate-500">
                              Grupo: {compareData.tcgplayer.groupName ?? "—"}
                            </div>
                            <div className="text-slate-500">
                              Code grupo: {compareData.tcgplayer.groupAbbreviation ?? "—"}
                            </div>
                            <div className="mt-1 text-slate-500">
                              Sets sugeridos:{" "}
                              {compareData.tcgplayer.suggestedSets.length
                                ? compareData.tcgplayer.suggestedSets
                                    .map((set) => set.title)
                                    .join(" · ")
                                : "—"}
                            </div>
                          </div>
                          <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-800/60">
                            <div className="font-semibold text-slate-700 dark:text-slate-200">
                              Limitless
                            </div>
                            <div className="mt-1 text-slate-500">
                              Match por productId:{" "}
                              {compareData.limitless.matchedPrint?.title ?? "No encontrado"}
                            </div>
                            <div className="text-slate-500">
                              Card page:{" "}
                              <a
                                href={compareData.limitless.cardUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                abrir
                              </a>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold text-slate-700 dark:text-slate-200">
                            Elegir set canónico para crear
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {compareData.setOptions.map((option, index) => {
                              const optionKey =
                                option.setId != null
                                  ? `id:${option.setId}`
                                  : `title:${option.title}::${option.code ?? ""}`;
                              return (
                                <label
                                  key={`${option.setId ?? "missing"}-${option.title}-${index}`}
                                  className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 hover:border-blue-400 dark:border-slate-700"
                                >
                                  <input
                                    type="radio"
                                    name="canonical-set"
                                    checked={selectedSetKey === optionKey}
                                    onChange={() => setSelectedSetKey(optionKey)}
                                    className="mt-0.5 h-4 w-4 accent-blue-600"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-medium text-slate-800 dark:text-slate-100">
                                      {option.title}
                                      {option.code ? ` (${option.code})` : ""}
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                      {option.sources.map((source) => (
                                        <span
                                          key={source}
                                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                        >
                                          {source}
                                        </span>
                                      ))}
                                      {option.matchedBy && (
                                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                          match {option.matchedBy}
                                        </span>
                                      )}
                                      {option.setId == null && (
                                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                          se creara al confirmar
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">
                        No se pudo cargar la comparación de fuentes.
                      </div>
                    )}
                  </div>
                )}

                {detailRow.origin === "events" && (
                  <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Set y arte alterno
                    </h4>

                    {eventSuggestionLoading ? (
                      <div className="py-4 text-center">
                        <Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" />
                      </div>
                    ) : eventSuggestion ? (
                      <div className="mt-3 space-y-3 text-xs">
                        {eventSuggestion.siblingCount > 0 && (
                          <div className="rounded-md bg-blue-50 px-2 py-1.5 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                            💡 {eventSuggestion.siblingCount} carta
                            {eventSuggestion.siblingCount === 1 ? "" : "s"} más pendiente
                            {eventSuggestion.siblingCount === 1 ? "" : "s"} del mismo pack (
                            <span className="font-medium">{eventSuggestion.cardTitle}</span>) —
                            el set que elijas acá te queda recordado para esas también.
                          </div>
                        )}

                        <div>
                          <label className="font-semibold text-slate-700 dark:text-slate-200">
                            Arte alterno
                          </label>
                          <select
                            value={eventAltArt}
                            onChange={(e) => setEventAltArt(e.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                          >
                            {/* La detección automática a veces da un valor dinámico (ej.
                                "Top 64") que no está en la lista fija — se agrega para no
                                perderlo, en vez de forzar a elegir otra cosa. */}
                            {eventAltArt && !altArtOptions.some((o) => o.value === eventAltArt) && (
                              <option value={eventAltArt}>{eventAltArt} (detectado)</option>
                            )}
                            {altArtOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="font-semibold text-slate-700 dark:text-slate-200">Set</div>
                          <div className="mt-1.5 space-y-1.5">
                            {!eventSuggestion.isGenericPack && (
                              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 hover:border-blue-400 dark:border-slate-700">
                                <input
                                  type="radio"
                                  name="event-set-mode"
                                  checked={eventSetMode === "suggested"}
                                  onChange={() => {
                                    setEventSetMode("suggested");
                                    setEventExistingSetId(eventSuggestion.existingSetId);
                                    setEventNewSetTitle(eventSuggestion.suggestedSetTitle);
                                  }}
                                  className="mt-0.5 h-4 w-4 accent-blue-600"
                                />
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-800 dark:text-slate-100">
                                    Sugerido: {eventSuggestion.suggestedSetTitle}
                                  </div>
                                  <span
                                    className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      eventSuggestion.existingSetId
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                        : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                    }`}
                                  >
                                    {eventSuggestion.existingSetId ? "ya existe" : "se creará"}
                                  </span>
                                </div>
                              </label>
                            )}

                            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 hover:border-blue-400 dark:border-slate-700">
                              <input
                                type="radio"
                                name="event-set-mode"
                                checked={eventSetMode === "existing"}
                                onChange={() => setEventSetMode("existing")}
                                className="mt-0.5 h-4 w-4 accent-blue-600"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-slate-800 dark:text-slate-100">
                                  Elegir set existente
                                </div>
                                {eventSetMode === "existing" && (
                                  <div className="mt-1.5">
                                    <input
                                      value={pickSetRaw}
                                      onChange={(e) => setPickSetRaw(e.target.value)}
                                      placeholder="Buscar por nombre…"
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                                    />
                                    {setSearchLoading ? (
                                      <div className="py-2 text-center">
                                        <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin text-slate-400" />
                                      </div>
                                    ) : setSearchResults.length > 0 ? (
                                      <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                                        {setSearchResults.map((s) => (
                                          <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => {
                                              setEventExistingSetId(s.id);
                                              setPickSetRaw(s.title);
                                              setSetSearchResults([]);
                                            }}
                                            className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                              eventExistingSetId === s.id
                                                ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                                : ""
                                            }`}
                                          >
                                            {s.title}
                                            {s.code ? ` (${s.code})` : ""}
                                          </button>
                                        ))}
                                      </div>
                                    ) : pickSetQuery.trim() ? (
                                      <div className="mt-1 text-slate-400">Sin resultados.</div>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            </label>

                            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 hover:border-blue-400 dark:border-slate-700">
                              <input
                                type="radio"
                                name="event-set-mode"
                                checked={eventSetMode === "new"}
                                onChange={() => setEventSetMode("new")}
                                className="mt-0.5 h-4 w-4 accent-blue-600"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-slate-800 dark:text-slate-100">
                                  Crear set nuevo
                                </div>
                                {eventSetMode === "new" && (
                                  <div className="mt-1.5 flex gap-1.5">
                                    <input
                                      value={eventNewSetTitle}
                                      onChange={(e) => setEventNewSetTitle(e.target.value)}
                                      placeholder="Nombre del set nuevo"
                                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                                    />
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">
                        No se pudo calcular una sugerencia de set.
                      </div>
                    )}
                  </div>
                )}

                {haveLoading ? (
                  <div className="py-8 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : haveCards.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400 dark:border-slate-700">
                    No tienes ninguna carta con este código.
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {haveCards.map((c: any) => (
                      <div
                        key={c.id}
                        onMouseEnter={() => setHoverCard(c)}
                        onMouseLeave={() => setHoverCard((cur: any) => (cur?.id === c.id ? null : cur))}
                        className={`rounded-lg border p-1.5 text-center dark:border-slate-700 ${
                          hoverCard?.id === c.id
                            ? "border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900"
                            : "border-slate-200"
                        }`}
                      >
                        {c.src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.src}
                            alt={c.alternateArt || "base"}
                            className="w-full rounded"
                            loading="lazy"
                          />
                        ) : (
                          <div className="aspect-[5/7] rounded bg-slate-200" />
                        )}
                        <div className="mt-1 truncate text-[10px] font-medium text-slate-600 dark:text-slate-300">
                          {c.isFirstEdition ? "Base" : c.alternateArt || "Alterna"}
                        </div>
                        <button
                          onClick={() => linkToCard(detailRow, Number(c.id))}
                          disabled={busy.has(detailRow.refKey)}
                          className="mt-1 w-full rounded bg-emerald-600 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Es esta
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const r = detailRow;
                      const overrideSet =
                        compareData?.setOptions.find((option) => {
                          const optionKey =
                            option.setId != null
                              ? `id:${option.setId}`
                              : `title:${option.title}::${option.code ?? ""}`;
                          return optionKey === selectedSetKey;
                        }) ?? null;
                      const eventOverride =
                        r.origin === "events"
                          ? {
                              setId: eventSetMode === "new" ? null : eventExistingSetId,
                              setTitle:
                                eventSetMode === "new"
                                  ? eventNewSetTitle.trim() || null
                                  : eventSetMode === "suggested"
                                    ? eventSuggestion?.suggestedSetTitle ?? null
                                    : null,
                              alternateArt: eventAltArt.trim() || null,
                            }
                          : null;
                      setDetailRow(null);
                      createAlternate(r, overrideSet, eventOverride);
                    }}
                    disabled={
                      busy.has(detailRow.refKey) ||
                      (detailRow.origin === "events" &&
                        ((eventSetMode === "existing" && !eventExistingSetId) ||
                          (eventSetMode === "new" && !eventNewSetTitle.trim())))
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {detailRow.type === "new" ? "Crear carta nueva" : "Crear nueva alterna"}
                  </button>
                  <button
                    onClick={() => {
                      const r = detailRow;
                      setDetailRow(null);
                      review(r, "ignored");
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" /> Ignorar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TypeBtn({
  label,
  value,
  active,
  onClick,
  tone = "slate",
  activeOverride,
}: {
  label: string;
  value?: number;
  active: boolean;
  onClick: () => void;
  tone?: "slate" | "blue" | "rose" | "violet";
  activeOverride?: boolean;
}) {
  const on = activeOverride ?? active;
  const tones: Record<string, string> = {
    slate: "border-slate-800 bg-slate-900 text-white dark:bg-white dark:text-slate-900",
    blue: "border-blue-500 bg-blue-600 text-white",
    rose: "border-rose-500 bg-rose-600 text-white",
    violet: "border-violet-500 bg-violet-600 text-white",
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
        on
          ? tones[tone]
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      }`}
    >
      {label}
      {value !== undefined && (
        <span className={on ? "opacity-80" : "text-slate-400"}>{value.toLocaleString()}</span>
      )}
    </button>
  );
}

function Stat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value?: number;
  tone?: "rose" | "amber" | "slate" | "emerald" | "violet";
}) {
  const tones: Record<string, string> = {
    rose: "text-rose-600 dark:text-rose-400",
    amber: "text-amber-600 dark:text-amber-400",
    slate: "text-slate-500 dark:text-slate-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    violet: "text-violet-600 dark:text-violet-400",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className={`text-xs font-medium ${tones[tone]}`}>{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">
        {value === undefined ? "—" : value.toLocaleString()}
      </div>
    </div>
  );
}
