"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { proxyImage } from "@/lib/proxyImage";
import { useHoverImagePreview, HoverImagePreviewOverlay } from "@/components/HoverImagePreview";
import {
  Loader2,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock3,
  Images,
} from "lucide-react";

type EventSearchResult = { id: number; title: string; sourceUrl: string | null; slug: string };

type EventCard = {
  id: number;
  code: string;
  name: string;
  src: string | null;
  alternateArt: string | null;
  rarity: string | null;
  region: string | null;
};

type EventSet = { id: number; title: string; code: string | null; image: string | null };

type MissingSetEntry = {
  id: number;
  title: string;
  translatedTitle: string | null;
  images: string[];
  isApproved: boolean;
};

type MissingCardEntry = {
  id: number;
  code: string;
  title: string;
  imageUrl: string;
  canonicalKey: string | null;
  isApproved: boolean;
};

type EventDetail = {
  id: number;
  slug: string;
  title: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  eventThumbnail: string | null;
  region: string;
  status: string;
  eventType: string;
  category: string | null;
  startDate: string | null;
  location: string | null;
  isApproved: boolean;
  cards: EventCard[];
  sets: EventSet[];
  missingSets: MissingSetEntry[];
  missingCards: MissingCardEntry[];
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
          {title}
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-sm text-slate-400">Nada registrado.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">{children}</div>
      )}
    </div>
  );
}

export default function EventVerifyPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EventSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { preview, showPreview, hidePreview } = useHoverImagePreview();

  const loadEvent = async (params: { id?: number; url?: string }) => {
    setLoading(true);
    setError(null);
    setEvent(null);
    try {
      const qs = params.id != null ? `id=${params.id}` : `url=${encodeURIComponent(params.url!)}`;
      const res = await fetch(`/api/admin/events/verify?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo cargar el evento");
      setEvent(data);
      setSearchResults([]);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  // Buscar por título mientras se escribe (a menos que parezca una URL —
  // en ese caso el enter/botón resuelve directo por URL, sin autocompletar).
  useEffect(() => {
    const term = query.trim();
    if (!term || term.startsWith("http")) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setSearchLoading(true);
      fetch(`/api/admin/events?search=${encodeURIComponent(term)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (cancelled) return;
          const list = Array.isArray(data) ? data : [];
          setSearchResults(
            list.slice(0, 15).map((e: any) => ({
              id: e.id,
              title: e.title,
              sourceUrl: e.sourceUrl,
              slug: e.slug,
            }))
          );
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const handleSubmit = () => {
    const term = query.trim();
    if (!term) return;
    if (term.startsWith("http")) {
      loadEvent({ url: term });
    } else if (searchResults[0]) {
      loadEvent({ id: searchResults[0].id });
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <HoverImagePreviewOverlay preview={preview} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight">Verificar evento</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Busca uno de tus eventos por nombre, o pega la URL de la página oficial —
          verás visualmente todos los sets y cartas que tenemos registrados
          (confirmados y pendientes) para comparar contra el sitio real.
        </p>

        <div className="relative mt-5 max-w-xl">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Nombre del evento, o pega su URL (https://en.onepiece-cardgame.com/events/...)"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <button
              onClick={handleSubmit}
              className="shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Buscar
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setQuery(r.title);
                    loadEvent({ id: r.id });
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {r.title}
                </button>
              ))}
            </div>
          )}
          {searchLoading && (
            <Loader2 className="absolute right-20 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
          )}
        </div>

        {loading && (
          <div className="mt-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        {event && (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{event.title}</h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {event.region}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {event.eventType}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {event.status}
                    </span>
                    {event.isApproved ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> aprobado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        <Clock3 className="h-3 w-3" /> sin aprobar
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {event.sourceUrl && (
                    <a
                      href={event.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Ver página real <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Editar evento
                  </Link>
                </div>
              </div>
            </div>

            <Section title="Sets confirmados" count={event.sets.length}>
              {event.sets.map((s) => (
                <div
                  key={s.id}
                  onMouseEnter={() => showPreview(s.image ? proxyImage(s.image) : null, s.title)}
                  onMouseLeave={hidePreview}
                  className="rounded-lg border border-slate-200 p-1.5 text-center dark:border-slate-700"
                >
                  <div className="aspect-[3/4] overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={proxyImage(s.image)} alt={s.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <Images className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="mt-1 truncate text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    {s.title}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Cartas confirmadas" count={event.cards.length}>
              {event.cards.map((c) => (
                <div
                  key={c.id}
                  onMouseEnter={() => showPreview(c.src, `${c.code} · ${c.name}${c.alternateArt ? ` · ${c.alternateArt}` : ""}`)}
                  onMouseLeave={hidePreview}
                  className="rounded-lg border border-slate-200 p-1.5 text-center dark:border-slate-700"
                >
                  <div className="aspect-[5/7] overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    {c.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.src} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <Images className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="mt-1 truncate font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {c.code}
                  </div>
                  <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {c.alternateArt || "Base"}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Sets pendientes (missing)" count={event.missingSets.length}>
              {event.missingSets.map((s) => (
                <div
                  key={s.id}
                  onMouseEnter={() => showPreview(s.images[0] ? proxyImage(s.images[0]) : null, s.title)}
                  onMouseLeave={hidePreview}
                  className={`rounded-lg border p-1.5 text-center dark:border-slate-700 ${
                    s.isApproved ? "border-emerald-300" : "border-amber-300"
                  }`}
                >
                  <div className="aspect-[3/4] overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    {s.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={proxyImage(s.images[0])} alt={s.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <Images className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="mt-1 truncate text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    {s.title}
                  </div>
                  <div
                    className={`mt-0.5 text-[9px] font-bold uppercase ${
                      s.isApproved ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {s.isApproved ? "resuelto" : "pendiente"}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Cartas pendientes (missing)" count={event.missingCards.length}>
              {event.missingCards.map((c) => (
                <div
                  key={c.id}
                  onMouseEnter={() => showPreview(c.imageUrl ? proxyImage(c.imageUrl) : null, `${c.code} · ${c.title}`)}
                  onMouseLeave={hidePreview}
                  className={`rounded-lg border p-1.5 text-center dark:border-slate-700 ${
                    c.isApproved ? "border-emerald-300" : "border-amber-300"
                  }`}
                >
                  <div className="aspect-[5/7] overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={proxyImage(c.imageUrl)} alt={c.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <Images className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="mt-1 truncate font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {c.code}
                  </div>
                  <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {c.title}
                  </div>
                  <div
                    className={`mt-0.5 text-[9px] font-bold uppercase ${
                      c.isApproved ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {c.isApproved ? "resuelta" : "pendiente"}
                  </div>
                </div>
              ))}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
