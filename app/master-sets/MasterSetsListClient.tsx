"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type {
  MasterSetSummary,
  MasterSetSummariesPage,
} from "@/lib/master-sets/query";

type PriceField = "marketPrice" | "midPrice";

type Props = {
  initialPage: MasterSetSummariesPage;
  search: string;
  region: string;
  relationType: string;
  priceField: PriceField;
};

const PAGE_SIZE = 24;

function buildDetailHref(
  slug: string,
  params: { region: string; relationType: string; priceField: PriceField }
) {
  const query = new URLSearchParams();
  if (params.region !== "US") query.set("region", params.region);
  if (params.relationType !== "all") query.set("relationType", params.relationType);
  if (params.priceField !== "marketPrice") query.set("priceField", params.priceField);

  const queryString = query.toString();
  return queryString ? `/master-sets/${slug}?${queryString}` : `/master-sets/${slug}`;
}

export default function MasterSetsListClient({
  initialPage,
  search,
  region,
  relationType,
  priceField,
}: Props) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const queryKey = useMemo(
    () => ["master-sets", { search, region, relationType }] as const,
    [search, region, relationType]
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery<
      MasterSetSummariesPage,
      Error,
      { pages: MasterSetSummariesPage[]; pageParams: (number | null)[] },
      typeof queryKey,
      number | null
    >({
      queryKey,
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (region) params.set("region", region);
        if (relationType) params.set("relationType", relationType);
        params.set("limit", String(PAGE_SIZE));
        if (pageParam) params.set("cursor", String(pageParam));

        const response = await fetch(`/api/master-sets?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Error al cargar master sets");
        }

        return response.json();
      },
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: null,
      initialData: {
        pages: [initialPage],
        pageParams: [null],
      },
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    });

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const items = data?.pages.flatMap((page) => page.items) ?? initialPage.items;
  const showEmptyState = !isLoading && !error && items.length === 0;

  if (error) {
    return (
      <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
        No se pudieron cargar más master sets.
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-sm font-medium text-slate-600">
          {showEmptyState ? "0 master sets" : `${items.length} master sets cargados`}
        </p>
      </div>

      {showEmptyState ? (
        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            No encontramos master sets
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Ajusta tu búsqueda o cambia los filtros para ver resultados.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((item: MasterSetSummary) => (
            <Link
              key={item.id}
              href={buildDetailHref(item.slug, { region, relationType, priceField })}
              className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md md:p-4"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-bold text-slate-950 md:text-lg">
                    {item.name}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 md:text-sm">
                    {item.description ||
                      "Cameos, cartas propias y relaciones de texto para este personaje."}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-900 px-2.5 py-2 text-center text-white">
                  <div className="text-base font-bold md:text-lg">{item.completionPercent}%</div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-300">
                    done
                  </div>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${item.completionPercent}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-slate-950">{item.totalCards}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Total
                  </div>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-emerald-700">{item.ownedCards}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700/80">
                    Owned
                  </div>
                </div>
                <div className="rounded-2xl bg-rose-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-rose-700">{item.missingCards}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-rose-700/80">
                    Missing
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-blue-50 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-blue-700/80">
                    Market Price
                  </div>
                  <div className="mt-1 text-sm font-bold text-blue-900 md:text-base">
                    ${item.totalMarketValue.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-2xl bg-indigo-50 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-700/80">
                    Listed Median
                  </div>
                  <div className="mt-1 text-sm font-bold text-indigo-900 md:text-base">
                    ${item.totalMidValue.toFixed(2)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div ref={loadMoreRef} className="h-10" />

      {(isFetchingNextPage || isLoading) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-1 h-4 w-5/6 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 h-2 w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasNextPage && items.length > 0 ? (
        <div className="mt-3 text-center text-sm text-slate-400">
          Ya se cargaron todos los master sets disponibles.
        </div>
      ) : null}
    </>
  );
}
