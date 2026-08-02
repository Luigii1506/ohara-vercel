"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { proxyImage } from "@/lib/proxyImage";
import { useUser } from "@/app/context/UserContext";
import {
  Search,
  ExternalLink,
  Loader2,
  Images,
  Check,
  X,
  Undo2,
} from "lucide-react";

type Row = {
  productId: number;
  type: string; // "new" | "alt-art"
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
  gap: number;
  certainty: string; // missing | ambiguous | unlinked
  sources: string[];
  likelyMissing: boolean;
  hasEvent: boolean;
  hasTcg: boolean;
  prints: { productId: number; imageUrl: string | null; url: string | null; origin: string }[];
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
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function UsAlternatesPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useUser();

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (roleLoading || role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
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
              <a
                key={r.productId}
                href={r.url ?? `https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(r.code)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="relative aspect-[5/7] bg-slate-100 dark:bg-slate-800">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.hasTcg ? r.imageUrl : proxyImage(r.imageUrl)}
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
                    {r.hasTcg ? "TCGplayer" : "Evento"} <ExternalLink className="h-3 w-3" />
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
                    {r.hasEvent && (
                      <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        PRIZE
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
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            review(r, "have");
                          }}
                          className="flex flex-1 items-center justify-center gap-1 bg-emerald-600/90 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" /> Ya la tengo
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            review(r, "ignored");
                          }}
                          className="flex items-center justify-center gap-1 bg-slate-700/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
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
                  <div className="truncate text-[11px] text-slate-500">{r.name}</div>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    {/* Lo importante: cuántas faltan */}
                    {r.type === "new" ? (
                      <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
                        Carta nueva
                      </span>
                    ) : (
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold text-white ${
                          r.certainty === "missing" ? "bg-rose-600" : "bg-amber-500"
                        }`}
                        title={
                          r.certainty === "ambiguous"
                            ? `Faltan ${r.gap}, pero hay ${r.prints.length} versiones sin identificar — revisa cuál`
                            : `Te faltan ${r.gap} versión(es)`
                        }
                      >
                        {r.certainty === "ambiguous" ? `Faltan ${r.gap} de ${r.prints.length}?` : `Faltan ${r.gap}`}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400" title="Tú tienes / esperadas">
                      {r.ourCount}/{r.expected}
                    </span>
                  </div>
                </div>
              </a>
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
