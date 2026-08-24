"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, Layers3, Star, ChevronDown } from "lucide-react";
import RegionVariantMatrix from "@/components/card-details/RegionVariantMatrix";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUser } from "@/app/context/UserContext";
import { REGION_OPTIONS } from "@/lib/regions";

type CodeEntry = {
  id: number;
  code: string;
  name: string;
  src: string;
  imageKey?: string | null;
  setCode: string;
  category: string;
  regions: string[];
  missingRegions: string[];
  hasExclusive: boolean;
  totalVariants: number;
};

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL || "https://images.oharatcg.com";
const FALLBACK_IMAGE = "/assets/images/backcard.webp";

const REGION_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  JP: "🇯🇵",
  FR: "🇫🇷",
  KR: "🇰🇷",
  CN: "🇨🇳",
  TC: "🇹🇼",
};

const TOTAL_REGIONS = REGION_OPTIONS.length;
const BATCH_SIZE = 180;

const resolveImageSrc = (entry: CodeEntry) => {
  if (entry.src) return entry.src;
  if (entry.imageKey) return `${WORKER_URL}/cards/${entry.imageKey}.webp`;
  return FALLBACK_IMAGE;
};

type Filter = "all" | "exclusive" | "incomplete";

export default function AdminRegionMatrixClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, loading: userLoading } = useUser();
  const initialCode = searchParams.get("code")?.trim().toUpperCase() || "";

  const [items, setItems] = useState<CodeEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [search, setSearch] = useState(initialCode);
  const [setCodeFilter, setSetCodeFilter] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [selectedEntry, setSelectedEntry] = useState<CodeEntry | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const didOpenFromUrl = useRef(false);

  useEffect(() => {
    if (!userLoading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, router, userLoading]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const response = await fetch("/api/admin/region-matrix/codes", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("failed");
        const payload = (await response.json()) as { items: CodeEntry[] };
        if (!active) return;
        setItems(payload.items);
      } catch (err) {
        console.error(err);
        if (!active) return;
        setCatalogError("No se pudo cargar el catálogo de códigos.");
      } finally {
        if (active) setCatalogLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  // Al cargar el catálogo, si venimos de un link con ?code=, abrimos su modal
  // directo (una sola vez) en vez de forzar al usuario a buscarlo de nuevo.
  useEffect(() => {
    if (didOpenFromUrl.current || !initialCode || !items.length) return;
    const match = items.find((item) => item.code === initialCode);
    if (match) {
      setSelectedEntry(match);
      didOpenFromUrl.current = true;
    }
  }, [initialCode, items]);

  const setOptions = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const item of items) {
      if (!seen.has(item.setCode)) {
        seen.add(item.setCode);
        ordered.push(item.setCode);
      }
    }
    return ordered;
  }, [items]);

  const stats = useMemo(
    () => ({
      total: items.length,
      exclusive: items.filter((item) => item.hasExclusive).length,
      incomplete: items.filter((item) => item.missingRegions.length > 0).length,
    }),
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toUpperCase();
    return items.filter((item) => {
      if (setCodeFilter !== "all" && item.setCode !== setCodeFilter) return false;
      if (filter === "exclusive" && !item.hasExclusive) return false;
      if (filter === "incomplete" && item.missingRegions.length === 0)
        return false;
      if (!query) return true;
      return (
        item.code.includes(query) || item.name.toUpperCase().includes(query)
      );
    });
  }, [items, search, setCodeFilter, filter]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [search, setCodeFilter, filter]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((value) =>
            Math.min(value + BATCH_SIZE, filteredItems.length)
          );
        }
      },
      { rootMargin: "1000px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredItems.length]);

  const visibleItems = filteredItems.slice(0, visibleCount);

  const openEntry = (entry: CodeEntry) => {
    setSelectedEntry(entry);
    router.replace(`/admin/region-matrix?code=${encodeURIComponent(entry.code)}`, {
      scroll: false,
    });
  };

  const closeEntry = () => {
    setSelectedEntry(null);
    router.replace("/admin/region-matrix", { scroll: false });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim().toUpperCase();
    const exact = items.find((item) => item.code === query);
    if (exact) openEntry(exact);
  };

  return (
    <div className="min-h-screen bg-[#f7f2e6]">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Admin Tool
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Region Variant Explorer
              </h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-600">
                Navega todo el catálogo en orden de colección. Haz click en
                una carta para comparar sus versiones entre regiones,
                detectar exclusivas reales y corregir metadata sin salir de
                la vista.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/admin/region-alternates">
                <Button type="button" variant="outline" className="gap-2">
                  <Layers3 className="h-4 w-4" />
                  Region Alternates
                </Button>
              </Link>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 xl:flex-row xl:items-center"
          >
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value.toUpperCase())}
                placeholder="Filtra por código o nombre, ej. OP01-001 o Zoro"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <div className="relative">
              <select
                value={setCodeFilter}
                onChange={(event) => setSetCodeFilter(event.target.value)}
                className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-4 pr-9 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white xl:w-44"
              >
                <option value="all">Todos los sets</option>
                {setOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={filter === "exclusive" ? "default" : "outline"}
                className="h-11 gap-2 rounded-2xl px-4"
                onClick={() =>
                  setFilter((value) => (value === "exclusive" ? "all" : "exclusive"))
                }
              >
                <Star className="h-4 w-4" />
                Exclusivas
              </Button>
              <Button
                type="button"
                variant={filter === "incomplete" ? "default" : "outline"}
                className="h-11 gap-2 rounded-2xl px-4"
                onClick={() =>
                  setFilter((value) => (value === "incomplete" ? "all" : "incomplete"))
                }
              >
                Incompletas
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-slate-900 text-white hover:bg-slate-900">
              {stats.total.toLocaleString()} códigos
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              <Star className="mr-1 h-3 w-3" />
              {stats.exclusive} exclusivas
            </Badge>
            <Badge variant="outline" className="border-slate-300 bg-white">
              {stats.incomplete} incompletas
            </Badge>
            {filteredItems.length !== items.length ? (
              <Badge variant="outline" className="border-slate-300 bg-white">
                {filteredItems.length.toLocaleString()} en esta vista
              </Badge>
            ) : null}
          </div>
        </div>

        {catalogLoading ? (
          <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-24 text-center text-sm text-slate-500 shadow-sm">
            Cargando catálogo completo...
          </div>
        ) : catalogError ? (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-24 text-center text-sm text-rose-700 shadow-sm">
            {catalogError}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-24 text-center text-sm text-slate-500 shadow-sm">
            No hay cartas que coincidan con ese filtro.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
              {visibleItems.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => openEntry(item)}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="relative aspect-[5/7] w-full overflow-hidden bg-slate-100">
                    <Image
                      src={resolveImageSrc(item)}
                      alt={`${item.code} ${item.name}`}
                      fill
                      sizes="160px"
                      loading="lazy"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                    {item.hasExclusive ? (
                      <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                        <Star className="h-2.5 w-2.5 fill-white" />
                      </span>
                    ) : null}
                    <span
                      className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow ${
                        item.missingRegions.length === 0
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-900/85 text-white"
                      }`}
                    >
                      {item.regions.length}/{TOTAL_REGIONS}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-2">
                    <p className="truncate text-[11px] font-semibold text-slate-900">
                      {item.code}
                    </p>
                    <p className="line-clamp-1 text-[10px] text-slate-500">
                      {item.name}
                    </p>
                    <div className="mt-auto flex gap-0.5 pt-1">
                      {REGION_OPTIONS.map((option) => {
                        const present = item.regions.includes(option.code);
                        return (
                          <span
                            key={option.code}
                            title={`${option.label}${present ? "" : " — falta"}`}
                            className={`text-[11px] leading-none ${
                              present ? "" : "opacity-25 grayscale"
                            }`}
                          >
                            {REGION_FLAGS[option.code] ?? "🏳️"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div ref={sentinelRef} className="h-1 w-full" />
            {visibleCount < filteredItems.length ? (
              <p className="pb-4 text-center text-xs text-slate-400">
                Cargando más cartas...
              </p>
            ) : null}
          </>
        )}
      </div>

      <Dialog
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open) closeEntry();
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto rounded-[28px] border-none bg-[#f7f2e6] p-0 shadow-2xl">
          {selectedEntry ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-5">
                <div className="relative h-24 w-[68px] flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  <Image
                    src={resolveImageSrc(selectedEntry)}
                    alt={selectedEntry.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {selectedEntry.setCode}
                  </p>
                  <h2 className="truncate text-xl font-semibold text-slate-950">
                    {selectedEntry.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                      {selectedEntry.code}
                    </Badge>
                    {selectedEntry.hasExclusive ? (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        <Star className="mr-1 h-3 w-3" />
                        Tiene exclusiva
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="border-slate-300 bg-white">
                      {selectedEntry.regions.length}/{TOTAL_REGIONS} regiones
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-6 pt-4 sm:px-6">
                <RegionVariantMatrix
                  cardId={selectedEntry.id}
                  defaultExpanded
                  collapsible={false}
                  subtitle="Region Matrix"
                  title="Comparación por región"
                  className="overflow-hidden"
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
