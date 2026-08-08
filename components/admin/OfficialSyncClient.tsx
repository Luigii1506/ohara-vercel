"use client";

import { useCallback, useEffect, useState } from "react";

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
};
type RegionOpt = { key: string; label: string };
type PendingCount = { region: string; count: number };

export default function OfficialSyncClient() {
  const [regions, setRegions] = useState<RegionOpt[]>([]);
  const [pending, setPending] = useState<PendingCount[]>([]);
  const [region, setRegion] = useState("EN");
  const [setFilter, setSetFilter] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

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

  const decide = async (ids: number[], action: "apply" | "ignore") => {
    if (!ids.length) return;
    setBusy((b) => {
      const n = new Set(b);
      ids.forEach((id) => n.add(id));
      return n;
    });
    setMsg(null);
    try {
      // en bloques de 12 para no exceder el timeout al subir imágenes
      let done = 0;
      for (let i = 0; i < ids.length; i += 12) {
        const chunk = ids.slice(i, i + 12);
        const r = await fetch("/api/admin/official-sync/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: chunk, action }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || "Falló");
        done += d.applied ?? 0;
        setItems((prev) => prev.filter((it) => !chunk.includes(it.id)));
        if (d.failed?.length)
          setMsg(`Algunas fallaron: ${d.failed.map((f: { id: number; error: string }) => `#${f.id}: ${f.error}`).join("; ")}`);
      }
      setMsg((m) => m ?? `${action === "apply" ? "Subidas" : "Ignoradas"}: ${done}.`);
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
          return (
            <div
              key={it.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative aspect-[2.5/3.5] bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.imageUrl}
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
              </div>
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
                    onClick={() => decide([it.id], "apply")}
                    className="flex-1 rounded-md bg-emerald-600 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isBusy ? "…" : "Aceptar"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => decide([it.id], "ignore")}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
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
    </div>
  );
}
