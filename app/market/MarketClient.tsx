"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/context/UserContext";
import {
  Loader2,
  Search,
  ExternalLink,
  Boxes,
  Sparkles,
  TrendingUp,
  Gem,
  ArrowDownCircle,
  Trophy,
} from "lucide-react";

/* ---------- tipos ---------- */
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
  unit: "pack" | "box" | "case" | null;
  marginPct: number;
  verdict: "oro" | "justo" | "caro";
  priceCurrency: string;
};
type CardItem = {
  cardId: number;
  code: string;
  name: string;
  src: string | null;
  alternateArt: string | null;
  rarity: string | null;
  set: string | null;
  tcgUrl: string | null;
  priceNow: number | string | null;
  price30dAgo: number | string | null;
  pct7d: number | null;
  pct30d: number | null;
  pct90d: number | null;
  ath: number | string | null;
  athPct: number | null;
  points: number;
  spark: number[];
};

/* ---------- helpers ---------- */
const money = (v: number | string | null, c = "USD") =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: c,
        maximumFractionDigits: 2,
      }).format(Number(v));

const pctClass = (v: number | null) =>
  v == null
    ? "text-slate-400"
    : v > 0
      ? "text-emerald-600"
      : v < 0
        ? "text-rose-600"
        : "text-slate-400";

const pctStr = (v: number | null) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${Math.round(v)}%`;

const evBadge = (v: EvItem["verdict"]) =>
  v === "oro"
    ? "bg-amber-400 text-amber-950"
    : v === "justo"
      ? "bg-slate-200 text-slate-700"
      : "bg-rose-100 text-rose-700";

const TABS = [
  { key: "sealed", label: "Sellados (EV)", icon: Boxes },
  { key: "movers", label: "Suben", icon: TrendingUp },
  { key: "gems", label: "Joyas", icon: Gem },
  { key: "dip", label: "En baja", icon: ArrowDownCircle },
  { key: "prize", label: "Prize / evento", icon: Trophy },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const SUB = {
  sealed: "Valor esperado de cada sellado vs su precio. Es oro si el EV supera el precio.",
  movers: "Las cartas que más suben. Momentum caliente ahora mismo.",
  gems: "Cartas baratas subiendo sostenido — sleepers antes de despegar.",
  dip: "Cartas fuertes con descuento desde su máximo — comprar la baja.",
  prize: "Alt-arts de evento/prize (winner, finalist, serial…) subiendo sin ruido.",
};

export default function MarketClient() {
  const { role, loading: roleLoading } = useUser();
  const [tab, setTab] = useState<TabKey>("sealed");
  const [tf, setTf] = useState("30");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sealed, setSealed] = useState<EvItem[]>([]);
  const [oro, setOro] = useState(0);
  const [cards, setCards] = useState<CardItem[]>([]);

  // Modal de detalle de carta (gráfica diaria + stats).
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailDays, setDetailDays] = useState("90");
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/market/cards/${detailId}/history?days=${detailDays}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {})
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [detailId, detailDays]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url =
      tab === "sealed"
        ? "/api/products/ev-ranking"
        : `/api/market/cards?tab=${tab}&tf=${tf}&limit=80`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: any) => {
        if (cancelled) return;
        if (tab === "sealed") {
          setSealed(d.items ?? []);
          setOro(d.oro ?? 0);
        } else {
          setCards(d.items ?? []);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, tf]);

  const q = search.trim().toLowerCase();
  const sealedFiltered = useMemo(
    () =>
      !q
        ? sealed
        : sealed.filter(
            (i) =>
              i.name.toLowerCase().includes(q) ||
              (i.set?.title.toLowerCase().includes(q) ?? false)
          ),
    [sealed, q]
  );
  const cardsFiltered = useMemo(
    () =>
      !q
        ? cards
        : cards.filter(
            (i) =>
              i.name.toLowerCase().includes(q) ||
              i.code.toLowerCase().includes(q) ||
              (i.set?.toLowerCase().includes(q) ?? false)
          ),
    [cards, q]
  );

  const pctForTab = (c: CardItem) =>
    tab === "movers"
      ? tf === "7"
        ? c.pct7d
        : tf === "90"
          ? c.pct90d
          : c.pct30d
      : tab === "dip"
        ? c.athPct
        : c.pct30d;

  // Pulso: promedio y máximo de la señal de la pestaña sobre lo cargado.
  const pulse = useMemo(() => {
    if (tab === "sealed") return null;
    const vals = cardsFiltered
      .map((c) => pctForTab(c))
      .filter((v): v is number => v != null);
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const best = tab === "dip" ? Math.min(...vals) : Math.max(...vals);
    return { n: vals.length, avg, best };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsFiltered, tab, tf]);

  // Solo admin.
  if (roleLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (role !== "ADMIN") {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-2 bg-slate-50 px-6 text-center dark:bg-slate-950">
        <Sparkles className="h-8 w-8 text-slate-300" />
        <h1 className="text-lg font-bold text-slate-700 dark:text-slate-200">
          Sección de análisis interna
        </h1>
        <p className="max-w-sm text-sm text-slate-500">
          El dashboard de mercado está disponible solo para administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-600">
          <Sparkles className="h-4 w-4" /> Análisis de mercado
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Mercado
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          {SUB[tab]}
        </p>

        {/* Tabs */}
        <div className="mt-5 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Controles */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          {tab === "sealed" && !loading && (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                {sealed.length} sellados
              </span>
              <span className="rounded-lg bg-amber-100 px-3 py-1.5 font-bold text-amber-800">
                ★ {oro} son oro
              </span>
            </div>
          )}
          {tab === "movers" && (
            <div className="flex gap-1">
              {["7", "30", "90"].map((d) => (
                <button
                  key={d}
                  onClick={() => setTf(d)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    tf === d
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-white text-slate-500 dark:bg-slate-800"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          )}
          <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        {/* Pulso del conjunto */}
        {!loading && pulse && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-white px-4 py-2 text-sm shadow-sm dark:bg-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {pulse.n} cartas
            </span>
            <span className="text-slate-500">
              promedio{" "}
              <span className={pctClass(pulse.avg)}>{pctStr(pulse.avg)}</span>
            </span>
            <span className="text-slate-500">
              {tab === "dip" ? "mayor descuento" : "top"}{" "}
              <span className={pctClass(pulse.best)}>{pctStr(pulse.best)}</span>
            </span>
          </div>
        )}

        {/* Contenido */}
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : tab === "sealed" ? (
          sealedFiltered.length === 0 ? (
            <Empty />
          ) : (
            <div className="mt-5 space-y-2">
              {sealedFiltered.map((i, idx) => (
                <a
                  key={i.id}
                  href={i.tcgUrl ?? "#"}
                  target={i.tcgUrl ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 sm:gap-4"
                >
                  <Rank n={idx + 1} />
                  <Thumb src={i.imageUrl || i.thumbnailUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {i.name}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {i.productType.replace(/_/g, " ").toLowerCase()}
                      {i.set ? ` · ${i.set.title}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-slate-400">EV</div>
                    <div className="text-sm font-bold text-emerald-600">
                      {money(i.ev, i.priceCurrency)}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="text-xs text-slate-400">Precio</div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {money(i.price, i.priceCurrency)}
                    </div>
                  </div>
                  <div
                    className={`flex w-16 shrink-0 flex-col items-center rounded-lg py-1.5 text-center ${evBadge(
                      i.verdict
                    )}`}
                  >
                    <span className="text-[9px] font-bold uppercase leading-tight">
                      {i.verdict === "oro" ? "★ Oro" : i.verdict}
                    </span>
                    <span className="text-sm font-bold leading-tight">
                      {i.marginPct >= 0 ? "+" : ""}
                      {Math.round(i.marginPct)}%
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )
        ) : cardsFiltered.length === 0 ? (
          <Empty />
        ) : (
          <div className="mt-5 space-y-2">
            {cardsFiltered.map((c, idx) => {
              const pv = pctForTab(c);
              return (
                <button
                  key={c.cardId}
                  onClick={() => {
                    setDetailDays("90");
                    setDetailId(c.cardId);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-left shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 sm:gap-4"
                >
                  <Rank n={idx + 1} />
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    {c.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.src}
                        alt={c.code}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <span className="font-mono">{c.code}</span> · {c.name}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {c.alternateArt || "Base"}
                      {c.set ? ` · ${c.set}` : ""}
                    </div>
                  </div>
                  {tab === "dip" ? (
                    <div className="hidden shrink-0 text-right sm:block">
                      <div className="text-xs text-slate-400">ATH</div>
                      <div className="text-sm font-semibold text-slate-500">
                        {money(c.ath)}
                      </div>
                    </div>
                  ) : (
                    <div className="hidden shrink-0 text-right sm:block">
                      <div className="text-xs text-slate-400">Antes</div>
                      <div className="text-sm font-semibold text-slate-500">
                        {money(c.price30dAgo)}
                      </div>
                    </div>
                  )}
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-slate-400">Ahora</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {money(c.priceNow)}
                    </div>
                  </div>
                  <Sparkline data={c.spark} />
                  <div className="w-16 shrink-0 text-right">
                    <div
                      className={`text-base font-bold ${pctClass(pv)}`}
                    >
                      {pctStr(pv)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {tab === "dip" ? "desde ATH" : `${tf === "7" ? "7" : tab === "movers" ? tf : "30"}d`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Precios de mercado (TCGplayer), historial ~7 meses. No es asesoría
          financiera; el mercado tiene varianza.
        </p>
      </div>

      {/* Modal de detalle de carta */}
      {detailId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetailId(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading || !detail ? (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="h-24 w-[68px] shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                    {detail.card.src && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={detail.card.src}
                        alt={detail.card.code}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-bold text-slate-400">
                      {detail.card.code}
                    </div>
                    <div className="text-lg font-bold leading-tight text-slate-900 dark:text-slate-50">
                      {detail.card.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {detail.card.alternateArt || "Base"}
                      {detail.card.set ? ` · ${detail.card.set}` : ""}
                    </div>
                    {detail.stat?.priceNow != null && (
                      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
                        {money(detail.stat.priceNow)}
                        <span
                          className={`ml-2 text-sm font-semibold ${pctClass(
                            detail.stat.pct30d
                          )}`}
                        >
                          {pctStr(detail.stat.pct30d)}{" "}
                          <span className="font-normal text-slate-400">30d</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setDetailId(null)}
                    className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    ✕
                  </button>
                </div>

                {/* Selector de rango */}
                <div className="mt-4 flex gap-1">
                  {[
                    { k: "30", l: "30d" },
                    { k: "90", l: "90d" },
                    { k: "all", l: "Todo" },
                  ].map((r) => (
                    <button
                      key={r.k}
                      onClick={() => setDetailDays(r.k)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        detailDays === r.k
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                      }`}
                    >
                      {r.l}
                    </button>
                  ))}
                </div>

                {/* Gráfica */}
                <div className="mt-3">
                  <PriceChart history={detail.history} />
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  <Stat label="7d" value={pctStr(detail.stat?.pct7d)} cls={pctClass(detail.stat?.pct7d)} />
                  <Stat label="30d" value={pctStr(detail.stat?.pct30d)} cls={pctClass(detail.stat?.pct30d)} />
                  <Stat label="90d" value={pctStr(detail.stat?.pct90d)} cls={pctClass(detail.stat?.pct90d)} />
                  <Stat label="Desde ATH" value={pctStr(detail.stat?.athPct)} cls={pctClass(detail.stat?.athPct)} />
                  <Stat label="Máx (ATH)" value={money(detail.stat?.ath)} />
                  <Stat label="Mín (ATL)" value={money(detail.stat?.atl)} />
                  <Stat label="Puntos" value={String(detail.stat?.points ?? 0)} />
                </div>

                {detail.card.tcgUrl && (
                  <a
                    href={detail.card.tcgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Ver en TCGplayer <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const Stat = ({
  label,
  value,
  cls = "text-slate-800 dark:text-slate-100",
}: {
  label: string;
  value: string;
  cls?: string;
}) => (
  <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center dark:bg-slate-800">
    <div className="text-[10px] uppercase tracking-wide text-slate-400">
      {label}
    </div>
    <div className={`text-sm font-bold ${cls}`}>{value}</div>
  </div>
);

/** Gráfica de línea diaria con relleno y punto final. */
const PriceChart = ({
  history,
}: {
  history: { date: string; price: number }[];
}) => {
  if (!history || history.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400 dark:bg-slate-800">
        Sin historial suficiente
      </div>
    );
  }
  const w = 560;
  const h = 160;
  const padY = 10;
  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const stepX = w / (history.length - 1);
  const x = (i: number) => i * stepX;
  const y = (v: number) => h - padY - ((v - min) / range) * (h - padY * 2);
  const line = history.map((p, i) => `${x(i).toFixed(1)},${y(p.price).toFixed(1)}`);
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? "#059669" : "#e11d48";
  const area = `0,${h} ${line.join(" ")} ${w},${h}`;
  const lastX = x(history.length - 1);
  const lastY = y(prices[prices.length - 1]);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-40 w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="mkt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#mkt-fill)" />
        <polyline
          points={line.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={lastX} cy={lastY} r={3.5} fill={color} />
      </svg>
      <div className="flex justify-between px-1 text-[10px] text-slate-400">
        <span>{history[0].date}</span>
        <span>
          mín ${min.toFixed(2)} · máx ${max.toFixed(2)}
        </span>
        <span>{history[history.length - 1].date}</span>
      </div>
    </div>
  );
};

const Rank = ({ n }: { n: number }) => (
  <div className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-slate-400">
    {n}
  </div>
);

const Thumb = ({ src }: { src: string | null }) => (
  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
    {src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
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
);

const Empty = () => (
  <div className="py-20 text-center text-slate-400">
    Sin resultados con estos filtros.
  </div>
);

/** Sparkline SVG de la serie semanal de precio (90d). */
const Sparkline = ({ data }: { data: number[] }) => {
  if (!data || data.length < 2) {
    return <div className="h-8 w-20 shrink-0" />;
  }
  const w = 80;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? "#059669" : "#e11d48";
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="hidden shrink-0 sm:block"
      preserveAspectRatio="none"
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};
