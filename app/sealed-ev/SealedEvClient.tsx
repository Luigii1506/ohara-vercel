"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ExternalLink, Boxes, Sparkles } from "lucide-react";

type EvItem = {
  id: number;
  name: string;
  productType: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  tcgUrl: string | null;
  set: { id: number; title: string } | null;
  price: number;
  ev: number;
  evPack: number;
  unit: "pack" | "box" | "case" | null;
  marginPct: number;
  verdict: "oro" | "justo" | "caro";
  priceCurrency: string;
};

const money = (v: number, c = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 2,
  }).format(v);

const badgeClass = (v: EvItem["verdict"]) =>
  v === "oro"
    ? "bg-amber-400 text-amber-950"
    : v === "justo"
      ? "bg-slate-200 text-slate-700"
      : "bg-rose-100 text-rose-700";

const unitLabel = (u: EvItem["unit"]) =>
  u === "pack" ? "sobre" : u === "case" ? "case" : "caja";

const VERDICTS = [
  { key: "", label: "Todo" },
  { key: "oro", label: "★ Es oro" },
  { key: "justo", label: "Justo" },
  { key: "caro", label: "Caro" },
];

const SORTS = [
  { key: "margin_desc", label: "Mejor margen" },
  { key: "margin_asc", label: "Peor margen" },
  { key: "ev_desc", label: "Mayor EV" },
  { key: "price_desc", label: "Más caro" },
];

export default function SealedEvClient() {
  const [items, setItems] = useState<EvItem[]>([]);
  const [oro, setOro] = useState(0);
  const [loading, setLoading] = useState(true);
  const [verdict, setVerdict] = useState("");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("margin_desc");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/products/ev-ranking")
      .then((r) => (r.ok ? r.json() : { items: [], oro: 0 }))
      .then((d) => {
        if (cancelled) return;
        setItems(d.items ?? []);
        setOro(d.oro ?? 0);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const types = useMemo(() => {
    const s = new Set(items.map((i) => i.productType));
    return ["all", ...Array.from(s)];
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (verdict) list = list.filter((i) => i.verdict === verdict);
    if (type !== "all") list = list.filter((i) => i.productType === type);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.set?.title.toLowerCase().includes(q) ?? false)
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "margin_asc") return a.marginPct - b.marginPct;
      if (sort === "ev_desc") return b.ev - a.ev;
      if (sort === "price_desc") return b.price - a.price;
      return b.marginPct - a.marginPct;
    });
    return sorted;
  }, [items, verdict, type, search, sort]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-600">
          <Sparkles className="h-4 w-4" /> Valor esperado
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          ¿Vale la pena?
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          El valor esperado de cada sellado (lo que estadísticamente sale dentro,
          a precio de mercado) vs su precio real. <strong>Es oro</strong> cuando
          el EV supera el precio.
        </p>

        {/* Resumen */}
        {!loading && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
              {items.length} sellados analizados
            </span>
            <span className="rounded-lg bg-amber-100 px-3 py-1.5 font-bold text-amber-800">
              ★ {oro} son oro
            </span>
          </div>
        )}

        {/* Filtros */}
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-wrap gap-2">
            {VERDICTS.map((v) => (
              <button
                key={v.key}
                onClick={() => setVerdict(v.key)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  verdict === v.key
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex flex-1 gap-2 md:justify-end">
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto o set…"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "Todos" : t.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ranking */}
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            Sin resultados con estos filtros.
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {filtered.map((i, idx) => (
              <a
                key={i.id}
                href={i.tcgUrl ?? "#"}
                target={i.tcgUrl ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 sm:gap-4 sm:p-3"
              >
                <div className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-slate-400">
                  {idx + 1}
                </div>
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {i.imageUrl || i.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={i.imageUrl || i.thumbnailUrl || ""}
                      alt=""
                      className="h-full w-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        const t = e.currentTarget;
                        if (t.src.includes("_in_1000x1000"))
                          t.src = t.src.replace("_in_1000x1000", "_400w");
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <Boxes className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {i.name}
                  </div>
                  <div className="truncate text-xs text-slate-400">
                    {i.productType.replace(/_/g, " ").toLowerCase()}
                    {i.set ? ` · ${i.set.title}` : ""}
                  </div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <div className="text-xs text-slate-400">Precio {unitLabel(i.unit)}</div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {money(i.price, i.priceCurrency)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-slate-400">EV</div>
                  <div className="text-sm font-bold text-emerald-600">
                    {money(i.ev, i.priceCurrency)}
                  </div>
                </div>
                <div
                  className={`flex w-20 shrink-0 flex-col items-center rounded-lg py-1.5 text-center ${badgeClass(
                    i.verdict
                  )}`}
                >
                  <span className="text-[10px] font-bold uppercase leading-tight">
                    {i.verdict === "oro"
                      ? "★ Es oro"
                      : i.verdict === "justo"
                        ? "Justo"
                        : "Caro"}
                  </span>
                  <span className="text-sm font-bold leading-tight">
                    {i.marginPct >= 0 ? "+" : ""}
                    {Math.round(i.marginPct)}%
                  </span>
                </div>
                <ExternalLink className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />
              </a>
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          EV estimado con precios de mercado y tasas de pull estándar de la
          comunidad. No es garantía; el sellado tiene varianza y valor de
          colección.
        </p>
      </div>
    </div>
  );
}
