"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import {
  Search,
  Loader2,
  ShieldCheck,
  Check,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

type Row = {
  cardId: number;
  code: string;
  ourAlt: string;
  tcgAlt: string;
  tcgName: string;
  disclaimer: string | null;
  category: "adopt" | "conflict";
};

type Stats = {
  adopt: number;
  conflict: number;
  keep: number;
  linkedCards: number;
  byTargetAlt: { alt: string; count: number }[];
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function CatalogAuditPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useUser();

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [category, setCategory] = useState<"adopt" | "conflict">("adopt");
  const [targetAlt, setTargetAlt] = useState("");
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounced(searchRaw, 300);
  const [page, setPage] = useState(1);
  const pageSize = 80;

  useEffect(() => {
    if (!roleLoading && role !== "ADMIN") router.push("/unauthorized");
  }, [role, roleLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("category", category);
      if (targetAlt) p.set("targetAlt", targetAlt);
      if (search) p.set("search", search);
      p.set("page", String(page));
      p.set("pageSize", String(pageSize));
      const res = await fetch(`/api/admin/catalog-audit?${p.toString()}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [category, targetAlt, search, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [category, targetAlt, search]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3500);
  };

  const applyFixes = async (fixes: { cardId: number; alternateArt: string }[]) => {
    if (!fixes.length) return;
    setBusy(true);
    const ids = new Set(fixes.map((f) => f.cardId));
    setRows((rs) => rs.filter((r) => !ids.has(r.cardId)));
    try {
      const res = await fetch("/api/admin/catalog-audit/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixes }),
      });
      const data = await res.json();
      flash(res.ok ? `✓ ${data.applied} corregidas` : `✕ ${data.error}`);
      load();
    } catch (e: any) {
      flash(`✕ ${e?.message ?? "error"}`);
      load();
    } finally {
      setBusy(false);
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
      {msg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {msg}
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400">
          <ShieldCheck className="h-4 w-4" />
          Auditor de catálogo
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Limpiar alt-arts mal clasificados
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Compara tu <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">alternateArt</code> contra la
          clasificación de TCGplayer. Las <strong>seguras</strong> (tú vacío/genérico,
          TCGplayer específico) se pueden aplicar en lote; los{" "}
          <strong>conflictos</strong> los revisas tú.
        </p>

        {/* Tabs categoría */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setCategory("adopt")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
              category === "adopt"
                ? "border-emerald-500 bg-emerald-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <Check className="h-4 w-4" /> Seguras
            <span className={category === "adopt" ? "opacity-80" : "text-slate-400"}>
              {stats?.adopt ?? "—"}
            </span>
          </button>
          <button
            onClick={() => setCategory("conflict")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
              category === "conflict"
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <AlertTriangle className="h-4 w-4" /> Conflictos
            <span className={category === "conflict" ? "opacity-80" : "text-slate-400"}>
              {stats?.conflict ?? "—"}
            </span>
          </button>
          <div className="ml-2 flex items-center text-xs text-slate-400">
            {stats ? `${stats.keep} correctas (tú más específico, no se tocan)` : ""}
          </div>
        </div>

        {/* Chips por destino */}
        {stats?.byTargetAlt && stats.byTargetAlt.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stats.byTargetAlt.slice(0, 16).map((t) => (
              <button
                key={t.alt}
                onClick={() => setTargetAlt(targetAlt === t.alt ? "" : t.alt)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
                  targetAlt === t.alt
                    ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {t.alt} <span className="text-slate-400">{t.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Barra de acciones */}
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
          {(targetAlt || search) && (
            <button
              onClick={() => {
                setTargetAlt("");
                setSearchRaw("");
              }}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Limpiar
            </button>
          )}
          <span className="text-sm text-slate-400">{total.toLocaleString()} resultados</span>
          {category === "adopt" && rows.length > 0 && (
            <button
              onClick={() =>
                applyFixes(rows.map((r) => ({ cardId: r.cardId, alternateArt: r.tcgAlt })))
              }
              disabled={busy}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Aplicar esta página ({rows.length})
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-3 py-2.5">Código</th>
                <th className="px-3 py-2.5">Tu valor</th>
                <th className="px-3 py-2.5"></th>
                <th className="px-3 py-2.5">TCGplayer dice</th>
                <th className="px-3 py-2.5">Evidencia (nombre del producto)</th>
                <th className="px-3 py-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-slate-400">
                    Sin hallazgos con estos filtros. 🎉
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.cardId}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold">
                      {r.code}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {r.ourAlt}
                      </span>
                    </td>
                    <td className="px-1 py-2.5 text-slate-300">
                      <ArrowRight className="h-4 w-4" />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {r.tcgAlt}
                      </span>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2.5 text-slate-500" title={r.disclaimer ?? r.tcgName}>
                      {r.tcgName}
                      {r.disclaimer && (
                        <span className="ml-1 rounded bg-rose-100 px-1 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                          disclaimer
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => applyFixes([{ cardId: r.cardId, alternateArt: r.tcgAlt }])}
                        disabled={busy}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Aplicar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
