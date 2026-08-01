"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/app/context/UserContext";
import {
  RefreshCw,
  Search,
  Check,
  X,
  ExternalLink,
  Layers,
  Globe2,
  PackageSearch,
  Sparkles,
  ClipboardCheck,
  EyeOff,
  Images,
  Loader2,
} from "lucide-react";

type Gap = {
  id: number;
  code: string;
  setCode: string | null;
  name: string | null;
  kind: "MISSING_ALL" | "REGION_PARITY";
  presentRegions: string[];
  missingRegions: string[];
  source: string;
  tcgUrl: string | null;
  imageUrl: string | null;
  cardType: string | null;
  rarity: string | null;
  resolved: boolean;
  ignored: boolean;
  lastSeenAt: string;
};

type Stats = {
  totalOpen: number;
  missingAll: number;
  regionParity: number;
  newUsMissing: number;
  resolved: number;
  ignored: number;
  byRegion: Record<string, number>;
  bySet: { setCode: string; count: number }[];
  lastRun: string | null;
  regions: string[];
};

const REGION_COLORS: Record<string, string> = {
  US: "bg-blue-500",
  JP: "bg-rose-500",
  CN: "bg-red-600",
  KR: "bg-violet-500",
  FR: "bg-sky-500",
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function CatalogGapsDashboard() {
  const router = useRouter();
  const { role, loading: roleLoading } = useUser();

  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<Gap[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Filtros
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("open");
  const [missingRegion, setMissingRegion] = useState("");
  const [setCode, setSetCode] = useState("");
  const [source, setSource] = useState("");
  const [newUs, setNewUs] = useState(false);
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounced(searchRaw, 300);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!roleLoading && role !== "ADMIN") router.push("/unauthorized");
  }, [role, roleLoading, router]);

  const buildUrl = useCallback(() => {
    const p = new URLSearchParams();
    p.set("kind", kind);
    p.set("status", status);
    if (missingRegion) p.set("missingRegion", missingRegion);
    if (setCode) p.set("setCode", setCode);
    if (source) p.set("source", source);
    if (newUs) p.set("newUs", "1");
    if (search) p.set("search", search);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return `/api/admin/catalog-gaps?${p.toString()}`;
  }, [kind, status, missingRegion, setCode, source, newUs, search, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(buildUrl());
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset page al cambiar filtros
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [kind, status, missingRegion, setCode, source, newUs, search]);

  const flashMsg = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 3500);
  };

  const runReconcile = async () => {
    setReconciling(true);
    try {
      const res = await fetch("/api/admin/catalog-gaps/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json();
      if (data.summary) {
        const s = data.summary;
        flashMsg(
          `Reconciliado: ${s.missingAll} sin región + ${s.regionParity} de paridad · ${s.created} nuevos, ${s.resolved} resueltos`
        );
      } else {
        flashMsg(data.error ?? "Error al reconciliar");
      }
      await load();
    } catch (e: any) {
      flashMsg(e?.message ?? "Error al reconciliar");
    } finally {
      setReconciling(false);
    }
  };

  const patchGap = async (id: number, body: Partial<Gap>) => {
    // Optimista
    setRows((r) => r.filter((g) => g.id !== id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    try {
      await fetch(`/api/admin/catalog-gaps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      // refrescar stats en background
      load();
    } catch {
      load();
    }
  };

  const bulk = async (action: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setRows((r) => r.filter((g) => !selected.has(g.id)));
    setSelected(new Set());
    try {
      await fetch("/api/admin/catalog-gaps/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      flashMsg(`${ids.length} huecos actualizados`);
      load();
    } catch {
      load();
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };
  const toggleOne = (id: number) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const maxRegion = useMemo(
    () => Math.max(1, ...Object.values(stats?.byRegion ?? {})),
    [stats]
  );

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
        {/* Tabs */}
        <div className="mb-5 flex items-center gap-1 text-sm">
          <span className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white dark:bg-white dark:text-slate-900">
            <Layers className="h-4 w-4" />
            Catálogo base
          </span>
          <Link
            href="/admin/catalog-gaps/us-alternates"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Images className="h-4 w-4" />
            Alternas US
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400">
              <PackageSearch className="h-4 w-4" />
              Cobertura de catálogo
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              ¿Qué me falta?
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Huecos detectados comparando el catálogo maestro y tus cartas por
              región. <strong>Sin región</strong> = contenido que no tienes en
              ninguna parte; <strong>paridad</strong> = lo tienes en una región
              pero falta en otras.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={runReconcile}
              disabled={reconciling}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${reconciling ? "animate-spin" : ""}`} />
              {reconciling ? "Reconciliando…" : "Reconciliar ahora"}
            </button>
            {stats?.lastRun && (
              <span className="text-xs text-slate-400">
                Última corrida: {new Date(stats.lastRun).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {flash && (
          <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm text-teal-800 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-200">
            {flash}
          </div>
        )}

        {/* Hero: Nuevas US (la prioridad) */}
        <button
          onClick={() => {
            setNewUs(true);
            setStatus("open");
            setKind("all");
            setMissingRegion("");
            setSetCode("");
            setSource("");
          }}
          className={`mt-6 flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left transition ${
            newUs
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
              : "border-blue-200 bg-gradient-to-r from-blue-50 to-white hover:border-blue-400 dark:border-blue-900 dark:from-blue-950/30 dark:to-slate-900"
          }`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Prioridad · cartas nuevas del mercado US
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Cartas que <strong>TCGplayer tiene y tú no</strong> en US — el
              contenido nuevo que más te importa.
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
              {stats?.newUsMissing ?? "—"}
            </div>
            <div className="text-xs font-medium text-blue-500">
              {newUs ? "viendo ahora →" : "ver todas →"}
            </div>
          </div>
        </button>

        {/* Stat cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Huecos abiertos"
            value={stats?.totalOpen}
            icon={<Layers className="h-4 w-4" />}
            active={!newUs && kind === "all" && status === "open"}
            onClick={() => {
              setNewUs(false);
              setKind("all");
              setStatus("open");
            }}
          />
          <StatCard
            label="Sin región (nuevo)"
            value={stats?.missingAll}
            icon={<Sparkles className="h-4 w-4" />}
            tone="rose"
            active={!newUs && kind === "MISSING_ALL"}
            onClick={() => {
              setNewUs(false);
              setKind("MISSING_ALL");
              setStatus("open");
            }}
          />
          <StatCard
            label="Paridad regional"
            value={stats?.regionParity}
            icon={<Globe2 className="h-4 w-4" />}
            tone="amber"
            active={!newUs && kind === "REGION_PARITY"}
            onClick={() => {
              setNewUs(false);
              setKind("REGION_PARITY");
              setStatus("open");
            }}
          />
          <StatCard
            label="Resueltos"
            value={stats?.resolved}
            icon={<ClipboardCheck className="h-4 w-4" />}
            tone="emerald"
            active={!newUs && status === "resolved"}
            onClick={() => {
              setNewUs(false);
              setStatus("resolved");
            }}
          />
          <StatCard
            label="Ignorados"
            value={stats?.ignored}
            icon={<EyeOff className="h-4 w-4" />}
            tone="slate"
            active={!newUs && status === "ignored"}
            onClick={() => {
              setNewUs(false);
              setStatus("ignored");
            }}
          />
        </div>

        {/* Region coverage + top sets */}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Faltantes por región{" "}
              <span className="font-normal text-slate-400">(clic para filtrar)</span>
            </h3>
            <div className="mt-3 space-y-2">
              {(stats?.regions ?? []).map((r) => {
                const n = stats?.byRegion?.[r] ?? 0;
                const pct = Math.round((n / maxRegion) * 100);
                return (
                  <button
                    key={r}
                    onClick={() => setMissingRegion(missingRegion === r ? "" : r)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      missingRegion === r ? "ring-2 ring-teal-500" : ""
                    }`}
                  >
                    <span className="w-8 font-mono text-xs font-semibold">{r}</span>
                    <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <span
                        className={`absolute inset-y-0 left-0 rounded-full ${REGION_COLORS[r] ?? "bg-slate-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-14 text-right font-mono text-sm tabular-nums">
                      {n.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Sets con más huecos
            </h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(stats?.bySet ?? []).slice(0, 18).map((s) => (
                <button
                  key={s.setCode}
                  onClick={() => setSetCode(setCode === s.setCode ? "" : s.setCode)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition ${
                    setCode === s.setCode
                      ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {s.setCode}
                  <span className="text-slate-400">{s.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters bar */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              placeholder="Buscar código o nombre…"
              className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <FilterSelect
            value={kind}
            onChange={setKind}
            options={[
              ["all", "Todos los tipos"],
              ["MISSING_ALL", "Sin región"],
              ["REGION_PARITY", "Paridad regional"],
            ]}
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            options={[
              ["open", "Abiertos"],
              ["resolved", "Resueltos"],
              ["ignored", "Ignorados"],
              ["all", "Todos"],
            ]}
          />
          <FilterSelect
            value={missingRegion}
            onChange={(v) => {
              setNewUs(false);
              setMissingRegion(v);
            }}
            options={[
              ["", "Cualquier región"],
              ...(stats?.regions ?? []).map((r) => [r, `Falta en ${r}`] as [string, string]),
            ]}
          />
          <FilterSelect
            value={source}
            onChange={(v) => {
              setNewUs(false);
              setSource(v);
            }}
            options={[
              ["", "Cualquier fuente"],
              ["tcgplayer", "TCGplayer"],
              ["dotgg", "DotGG"],
            ]}
          />
          {(missingRegion || setCode || source || newUs || search || kind !== "all" || status !== "open") && (
            <button
              onClick={() => {
                setKind("all");
                setStatus("open");
                setMissingRegion("");
                setSetCode("");
                setSource("");
                setNewUs(false);
                setSearchRaw("");
              }}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Limpiar
            </button>
          )}
          <span className="ml-auto text-sm text-slate-400">
            {total.toLocaleString()} resultados
          </span>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm dark:border-teal-900 dark:bg-teal-950/40">
            <span className="font-semibold text-teal-700 dark:text-teal-300">
              {selected.size} seleccionados
            </span>
            <button onClick={() => bulk("resolve")} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
              Marcar resueltos
            </button>
            <button onClick={() => bulk("ignore")} className="rounded-md bg-slate-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700">
              Ignorar
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
              Deseleccionar
            </button>
          </div>
        )}

        {/* Table */}
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-teal-600" />
                </th>
                <th className="px-3 py-2.5">Código</th>
                <th className="px-3 py-2.5">Nombre</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Tenemos</th>
                <th className="px-3 py-2.5">Falta en</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-slate-400">
                    Sin huecos con estos filtros. 🎉
                  </td>
                </tr>
              ) : (
                rows.map((g) => (
                  <tr
                    key={g.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(g.id)}
                        onChange={() => toggleOne(g.id)}
                        className="h-4 w-4 accent-teal-600"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {g.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.imageUrl}
                            alt={g.code}
                            className="h-11 w-8 rounded object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-11 w-8 items-center justify-center rounded bg-slate-100 text-slate-300 dark:bg-slate-800">
                            <PackageSearch className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-mono text-xs font-semibold">{g.code}</div>
                          {g.source === "tcgplayer" && (
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-blue-100 px-1 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              TCGplayer
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      <div className="truncate">{g.name ?? <span className="text-slate-400">—</span>}</div>
                      {(g.cardType || g.rarity) && (
                        <div className="text-[11px] text-slate-400">
                          {[g.cardType, g.rarity].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {g.kind === "MISSING_ALL" ? (
                        <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          Sin región
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          Paridad
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <RegionChips regions={g.presentRegions} tone="present" />
                    </td>
                    <td className="px-3 py-2.5">
                      <RegionChips regions={g.missingRegions} tone="missing" />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={
                            g.tcgUrl ??
                            `https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(g.code)}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          title={g.tcgUrl ? "Ver en TCGplayer" : "Buscar en TCGplayer"}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        {!g.resolved && (
                          <button
                            onClick={() => patchGap(g.id, { resolved: true })}
                            title="Marcar resuelto"
                            className="rounded-md p-1.5 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        {!g.ignored && (
                          <button
                            onClick={() => patchGap(g.id, { ignored: true })}
                            title="Ignorar (no aplica)"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
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

function StatCard({
  label,
  value,
  icon,
  tone = "teal",
  active,
  onClick,
}: {
  label: string;
  value?: number;
  icon: ReactNode;
  tone?: "teal" | "rose" | "amber" | "emerald" | "slate";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    teal: "text-teal-600 dark:text-teal-400",
    rose: "text-rose-600 dark:text-rose-400",
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    slate: "text-slate-500 dark:text-slate-400",
  };
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-white p-4 text-left transition dark:bg-slate-900 ${
        active
          ? "border-teal-500 ring-1 ring-teal-500"
          : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
      }`}
    >
      <div className={`flex items-center gap-1.5 text-xs font-medium ${tones[tone]}`}>
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">
        {value === undefined ? "—" : value.toLocaleString()}
      </div>
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function RegionChips({
  regions,
  tone,
}: {
  regions: string[];
  tone: "present" | "missing";
}) {
  if (!regions?.length)
    return <span className="text-xs text-slate-300 dark:text-slate-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {regions.map((r) => (
        <span
          key={r}
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
            tone === "present"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}
