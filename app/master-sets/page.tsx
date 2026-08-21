export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import {
  getMasterSetBrowseOptions,
  getMasterSetRelationTypeLabel,
  getMasterSetSummaries,
} from "@/lib/master-sets/query";

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

type PriceField = "marketPrice" | "midPrice";

const REGION_OPTIONS = ["US", "JP", "KR", "CN", "TH", "FR"] as const;

function readString(
  value: string | string[] | undefined,
  fallback = ""
): string {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

export default async function MasterSetsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const user = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
    : null;

  const search = readString(searchParams.search).trim();
  const region = readString(searchParams.region) || "US";
  const relationType = readString(searchParams.relationType) || "all";
  const priceField =
    readString(searchParams.priceField) === "midPrice"
      ? "midPrice"
      : "marketPrice";

  const [items, browseOptions] = await Promise.all([
    getMasterSetSummaries({
      userId: user?.id ?? null,
      search: search || undefined,
      variantMode: "all",
      region,
      relationType,
    }),
    getMasterSetBrowseOptions(),
  ]);

  const buildHref = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (region !== "US") params.set("region", region);
    if (relationType !== "all") params.set("relationType", relationType);
    if (priceField !== "marketPrice") params.set("priceField", priceField);

    for (const [key, value] of Object.entries(overrides)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }

    const query = params.toString();
    return query ? `/master-sets?${query}` : "/master-sets";
  };

  const activeFilterCount = [
    Boolean(search),
    region !== "US",
    relationType !== "all",
    priceField !== "marketPrice",
  ].filter(Boolean).length;

  const totalCards = items.reduce((sum, item) => sum + item.totalCards, 0);
  const totalValue = items.reduce(
    (sum, item) =>
      sum +
      (priceField === "midPrice" ? item.totalMidValue : item.totalMarketValue),
    0
  );
  const totalAverage =
    totalCards > 0
      ? items.reduce(
          (sum, item) =>
            sum +
            (priceField === "midPrice"
              ? item.totalMidValue
              : item.totalMarketValue),
          0
        ) / totalCards
      : 0;

  return (
    <main className="min-h-screen bg-[#f2eede]">
      <div className="mx-auto flex w-full max-w-none flex-col px-2 py-3 sm:px-3 md:px-5 md:py-6">
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Master Sets
                  </p>
                  <h1 className="mt-1 text-xl font-bold text-slate-950 md:text-3xl">
                    Character Tracker
                  </h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600 md:text-base">
                    Explora master sets por personaje con region `US` por default y cambia entre `Market Price` y `Listed Median`.
                  </p>
                </div>
                <div className="inline-flex w-fit items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  {items.length} master sets
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div className="rounded-[22px] bg-slate-50 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Master sets
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-950">
                    {items.length}
                  </div>
                </div>
                <div className="rounded-[22px] bg-emerald-50 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700/80">
                    Cards tracked
                  </div>
                  <div className="mt-1 text-2xl font-bold text-emerald-700">
                    {totalCards}
                  </div>
                </div>
                <div className="rounded-[22px] bg-blue-50 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-blue-700/80">
                    {priceField === "midPrice" ? "Listed Median total" : "Market total"}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-blue-900">
                    ${totalValue.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-[22px] bg-indigo-50 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-700/80">
                    Avg per card
                  </div>
                  <div className="mt-1 text-2xl font-bold text-indigo-900">
                    ${totalAverage.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 md:px-6 md:py-4">
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildHref({ priceField: "marketPrice" })}
                className={`rounded-full border px-3 py-2 text-xs font-semibold md:text-sm ${
                  priceField === "marketPrice"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Market Price
              </Link>
              <Link
                href={buildHref({ priceField: "midPrice" })}
                className={`rounded-full border px-3 py-2 text-xs font-semibold md:text-sm ${
                  priceField === "midPrice"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Listed Median
              </Link>
              <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 md:text-sm">
                Region default: {region}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 md:text-sm">
                {activeFilterCount} filtros activos
              </span>
            </div>

            <form action="/master-sets" className="mt-3 space-y-3">
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1.3fr)_200px_220px_auto]">
                <input
                  type="search"
                  name="search"
                  defaultValue={search}
                  placeholder="Buscar personaje"
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                />
                <select
                  name="region"
                  defaultValue={region}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                >
                  {REGION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      Region {item}
                    </option>
                  ))}
                  <option value="all">Todas las regiones</option>
                </select>
                <select
                  name="relationType"
                  defaultValue={relationType}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                >
                  <option value="all">Todas las relaciones</option>
                  {browseOptions.relationTypes.map((item) => (
                    <option key={item} value={item}>
                      {getMasterSetRelationTypeLabel(item)}
                    </option>
                  ))}
                </select>
                <select
                  name="priceField"
                  defaultValue={priceField}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                >
                  <option value="marketPrice">Market Price</option>
                  <option value="midPrice">Listed Median</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="h-10 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white"
                  >
                    Apply
                  </button>
                  <Link
                    href="/master-sets"
                    className="inline-flex h-10 items-center rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-slate-700"
                  >
                    Clear
                  </Link>
                </div>
              </div>
            </form>

            {(search || relationType !== "all" || region !== "US" || priceField !== "marketPrice") && (
              <div className="mt-3 flex flex-wrap gap-2">
                {search ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Search: {search}
                  </span>
                ) : null}
                {region !== "US" ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                    Region: {region}
                  </span>
                ) : null}
                {relationType !== "all" ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    {getMasterSetRelationTypeLabel(relationType)}
                  </span>
                ) : null}
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  Price: {priceField === "midPrice" ? "Listed Median" : "Market Price"}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-sm font-medium text-slate-600">
              {items.length} master sets encontrados
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => {
              const totalValueForCard =
                priceField === "midPrice" ? item.totalMidValue : item.totalMarketValue;
              const averageValueForCard =
                priceField === "midPrice"
                  ? item.averageMidPrice
                  : item.averageMarketPrice;

              return (
                <Link
                  key={item.id}
                  href={`/master-sets/${item.slug}${
                    region !== "US" || relationType !== "all" || priceField !== "marketPrice"
                      ? `?${new URLSearchParams(
                          Object.fromEntries(
                            Object.entries({
                              region: region !== "US" ? region : "",
                              relationType: relationType !== "all" ? relationType : "",
                              priceField: priceField !== "marketPrice" ? priceField : "",
                            }).filter(([, value]) => value)
                          )
                        ).toString()}`
                      : ""
                  }`}
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
                      <div className="text-lg font-bold text-emerald-700">
                        {item.ownedCards}
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700/80">
                        Owned
                      </div>
                    </div>
                    <div className="rounded-2xl bg-rose-50 px-3 py-3 text-center">
                      <div className="text-lg font-bold text-rose-700">
                        {item.missingCards}
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-rose-700/80">
                        Missing
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-blue-50 px-3 py-2.5">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-blue-700/80">
                        {priceField === "midPrice" ? "Listed Median total" : "Market total"}
                      </div>
                      <div className="mt-1 text-sm font-bold text-blue-900 md:text-base">
                        ${totalValueForCard.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-indigo-50 px-3 py-2.5">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-700/80">
                        Avg per card
                      </div>
                      <div className="mt-1 text-sm font-bold text-indigo-900 md:text-base">
                        ${averageValueForCard.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.relationTypes.slice(0, 2).map((itemRelationType) => (
                      <span
                        key={itemRelationType}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                      >
                        {getMasterSetRelationTypeLabel(itemRelationType)}
                      </span>
                    ))}
                    {item.aliases.slice(0, 2).map((alias) => (
                      <span
                        key={alias}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
