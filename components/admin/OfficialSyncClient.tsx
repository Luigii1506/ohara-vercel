"use client";

import { useCallback, useEffect, useState } from "react";
import { proxyImage } from "@/lib/proxyImage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type OfficialPayload = {
  rarity?: string | null;
  category?: string | null;
  cost?: string | null;
  life?: string | null;
  power?: string | null;
  counter?: string | null;
  colors?: string[];
  types?: string[];
  text?: string | null;
  trigger?: string | null;
};

type Item = {
  id: number;
  region: string;
  code: string;
  variant: string | null;
  cardId: string;
  name: string | null;
  setCode: string | null;
  seriesLabel: string | null;
  imageUrl: string;
  isAlternate: boolean;
  exclusive: boolean;
  payload?: OfficialPayload | null;
};
type ExistingCard = {
  id: number;
  code: string;
  region: string | null;
  src: string;
  alias: string | null;
  officialVariantCode: string | null;
  alternateArt: string | null;
  baseCardId: number | null;
};
type RegionOpt = { key: string; label: string };
type PendingCount = { region: string; count: number };

export default function OfficialSyncClient() {
  const [regions, setRegions] = useState<RegionOpt[]>([]);
  const [pending, setPending] = useState<PendingCount[]>([]);
  const [region, setRegion] = useState("EN");
  const [setFilter, setSetFilter] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [existingByCode, setExistingByCode] = useState<
    Record<string, ExistingCard[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<number | null>(null);

  const load = useCallback(async (reg: string) => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin/official-sync?region=${encodeURIComponent(reg)}&status=PENDING`,
        { cache: "no-store" }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Error");
      if (d.regions?.length) setRegions(d.regions);
      setPending(d.pendingCounts ?? []);
      setItems(d.items ?? []);
      setExistingByCode(d.existingByCode ?? {});
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(region);
  }, [load, region]);

  const scan = async () => {
    setScanning(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/official-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, set: setFilter.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Scan falló");
      setMsg(
        `Escaneo ${d.result.region}: ${d.result.scanned} cartas, ${d.result.missing} faltantes, ${d.result.created} nuevas en cola.`
      );
      await load(region);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const decide = async (
    ids: number[],
    action: "apply" | "ignore" | "link",
    existingCardId?: number
  ) => {
    if (!ids.length) return;
    setBusy((b) => {
      const n = new Set(b);
      ids.forEach((id) => n.add(id));
      return n;
    });
    setMsg(null);
    try {
      // en bloques de 12 para no exceder el timeout al subir imágenes
      // ("link" siempre es un solo id, así que esto no cambia su comportamiento)
      let done = 0;
      for (let i = 0; i < ids.length; i += 12) {
        const chunk = ids.slice(i, i + 12);
        const r = await fetch("/api/admin/official-sync/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: chunk, action, existingCardId }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || "Falló");
        done += d.applied ?? 0;
        setItems((prev) => prev.filter((it) => !chunk.includes(it.id)));
        if (d.failed?.length)
          setMsg(`Algunas fallaron: ${d.failed.map((f: { id: number; error: string }) => `#${f.id}: ${f.error}`).join("; ")}`);
      }
      const actionLabel =
        action === "apply" ? "Subidas" : action === "link" ? "Vinculadas" : "Ignoradas";
      setMsg((m) => m ?? `${actionLabel}: ${done}.`);
      setReviewId((cur) => (ids.includes(cur ?? -1) ? null : cur));
      await load(region);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        ids.forEach((id) => n.delete(id));
        return n;
      });
    }
  };

  const pendingFor = (key: string) =>
    pending.find((p) => p.region === key)?.count ?? 0;

  const reviewItem = items.find((i) => i.id === reviewId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-black text-slate-900">
        Sincronización oficial (alternas y exclusivas)
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Escanea la página oficial de cada región, revisa lo que falta y acepta
        para subirlo (BD + imágenes en R2).
      </p>

      {/* Regiones */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(regions.length ? regions : [{ key: "EN", label: "Inglés" }]).map(
          (r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRegion(r.key)}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                region === r.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {r.label}
              {pendingFor(r.key) ? (
                <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[11px] font-black text-slate-900">
                  {pendingFor(r.key)}
                </span>
              ) : null}
            </button>
          )
        )}
      </div>

      {/* Escanear */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={setFilter}
          onChange={(e) => setSetFilter(e.target.value)}
          placeholder="Set(s) opcional, ej. OP-16,P (vacío = todos)"
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="button"
          onClick={scan}
          disabled={scanning}
          className="h-10 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {scanning ? "Escaneando…" : "🔍 Escanear región"}
        </button>
      </div>

      {msg ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {msg}
        </div>
      ) : null}

      {/* Acciones en lote */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600">
          {loading ? "Cargando…" : `${items.length} pendientes`}
        </span>
        {items.length ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => decide(items.map((i) => i.id), "apply")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
              title="Crea una carta nueva por cada pendiente, sin revisar una por una"
            >
              Aceptar todo ({items.length})
            </button>
            <button
              type="button"
              onClick={() => decide(items.map((i) => i.id), "ignore")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Ignorar todo
            </button>
          </div>
        ) : null}
      </div>

      {/* Grid de items */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((it) => {
          const isBusy = busy.has(it.id);
          const existing = existingByCode[it.code] ?? [];
          return (
            <div
              key={it.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => setReviewId(it.id)}
                className="relative block aspect-[2.5/3.5] w-full bg-slate-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxyImage(it.imageUrl)}
                  alt={it.cardId}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute left-1 top-1 flex flex-col gap-1">
                  {it.isAlternate ? (
                    <span className="rounded bg-fuchsia-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                      Alt {it.variant}
                    </span>
                  ) : null}
                  {it.exclusive ? (
                    <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                      Exclusiva
                    </span>
                  ) : null}
                </div>
                <div className="absolute right-1 top-1 flex flex-col items-end gap-1">
                  <span className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                    {it.region}
                  </span>
                  {existing.length ? (
                    <span
                      className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-900"
                      title="Ya hay cartas de este código en tu BD — revisa antes de aceptar"
                    >
                      Ya tienes {existing.length}
                    </span>
                  ) : null}
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[10px] font-bold uppercase text-white">
                  Revisar →
                </div>
              </button>
              <div className="p-1.5">
                <div className="truncate text-[11px] font-bold text-slate-900">
                  {it.cardId}
                </div>
                <div className="truncate text-[10px] text-slate-500">
                  {it.name}
                </div>
                <div className="mt-1.5 flex gap-1">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setReviewId(it.id)}
                    className="flex-1 rounded-md bg-slate-900 py-1 text-[11px] font-bold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isBusy ? "…" : "Revisar"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => decide([it.id], "ignore")}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    title="Ignorar rápido, sin abrir el detalle"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && !items.length ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center text-sm text-slate-500">
          Sin pendientes en {region}. Usa “Escanear región” para buscar
          alternas/cartas nuevas.
        </div>
      ) : null}

      {/* Modal de revisión */}
      <Dialog
        open={!!reviewItem}
        onOpenChange={(open) => {
          if (!open) setReviewId(null);
        }}
      >
        {reviewItem ? (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {reviewItem.name ?? reviewItem.cardId}{" "}
                <span className="font-normal text-slate-400">
                  · {reviewItem.cardId}
                </span>
              </DialogTitle>
            </DialogHeader>
            <ReviewBody
              item={reviewItem}
              existing={existingByCode[reviewItem.code] ?? []}
              busy={busy.has(reviewItem.id)}
              onCreate={() => decide([reviewItem.id], "apply")}
              onIgnore={() => decide([reviewItem.id], "ignore")}
              onLink={(cardId) => decide([reviewItem.id], "link", cardId)}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function ReviewBody({
  item,
  existing,
  busy,
  onCreate,
  onIgnore,
  onLink,
}: {
  item: Item;
  existing: ExistingCard[];
  busy: boolean;
  onCreate: () => void;
  onIgnore: () => void;
  onLink: (existingCardId: number) => void;
}) {
  const p = item.payload;
  return (
    <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
      {/* Imagen + origen */}
      <div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxyImage(item.imageUrl)}
            alt={item.cardId}
            className="w-full object-contain"
          />
        </div>
        <a
          href={item.imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-bold text-blue-600 hover:bg-slate-50"
        >
          🔗 Ver imagen original
        </a>
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
            {item.region}
          </span>
          {item.isAlternate ? (
            <span className="rounded bg-fuchsia-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
              Alt {item.variant}
            </span>
          ) : null}
          {item.exclusive ? (
            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
              Exclusiva
            </span>
          ) : null}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {item.setCode ?? "—"}
          {item.seriesLabel ? ` · ${item.seriesLabel}` : ""}
        </div>
      </div>

      {/* Detalle + decisión */}
      <div className="space-y-4">
        {p ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {p.rarity ? <div><span className="text-slate-400">Rareza:</span> {p.rarity}</div> : null}
            {p.category ? <div><span className="text-slate-400">Categoría:</span> {p.category}</div> : null}
            {p.cost ? <div><span className="text-slate-400">Costo:</span> {p.cost}</div> : null}
            {p.life ? <div><span className="text-slate-400">Vida:</span> {p.life}</div> : null}
            {p.power ? <div><span className="text-slate-400">Poder:</span> {p.power}</div> : null}
            {p.counter ? <div><span className="text-slate-400">Counter:</span> {p.counter}</div> : null}
            {p.colors?.length ? (
              <div className="col-span-2">
                <span className="text-slate-400">Colores:</span> {p.colors.join(", ")}
              </div>
            ) : null}
            {p.types?.length ? (
              <div className="col-span-2">
                <span className="text-slate-400">Tipos:</span> {p.types.join(", ")}
              </div>
            ) : null}
            {p.trigger ? (
              <div className="col-span-2">
                <span className="text-slate-400">Trigger:</span> {p.trigger}
              </div>
            ) : null}
            {p.text ? (
              <div className="col-span-2">
                <span className="text-slate-400">Texto:</span> {p.text}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-400">
            Sin detalle scrapeado.
          </div>
        )}

        <div>
          <div className="mb-1.5 text-sm font-bold text-slate-700">
            {existing.length
              ? `Ya tienes ${existing.length} carta(s) con este código — elige una si es la misma:`
              : "No hay ninguna carta con este código en tu BD todavía."}
          </div>
          {existing.length ? (
            <div className="flex flex-wrap gap-2">
              {existing.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  disabled={busy}
                  onClick={() => onLink(c.id)}
                  className="flex w-20 flex-col items-center gap-1 rounded-lg border border-slate-200 p-1.5 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
                  title={`Vincular a esta carta (#${c.id})`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.src}
                    alt={`${c.code} ${c.region ?? ""}`}
                    className="h-24 w-20 rounded object-cover"
                    loading="lazy"
                  />
                  <span className="truncate text-[10px] font-bold text-slate-600">
                    {c.region ?? "—"}
                  </span>
                  <span className="truncate text-[9px] text-slate-400">
                    {c.officialVariantCode ??
                      (c.baseCardId ? c.alias || "alt" : "base")}
                  </span>
                  <span className="text-[9px] font-bold text-blue-600">
                    Vincular
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCreate}
            className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "…" : "+ Crear carta nueva"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onIgnore}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Ignorar
          </button>
        </div>
      </div>
    </div>
  );
}
