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
import MasterSetsFilters from "./MasterSetsFilters";

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

  const regionOptions = [
    ...REGION_OPTIONS.map((item) => ({
      value: item,
      label: `Region ${item}`,
    })),
    { value: "all", label: "Todas las regiones" },
  ];

  const relationTypeOptions = [
    { value: "all", label: "Todas las relaciones" },
    ...browseOptions.relationTypes.map((item) => ({
      value: item,
      label: getMasterSetRelationTypeLabel(item),
    })),
  ];

  return (
    <main className="min-h-screen bg-[#f2eede]">
      <div className="mx-auto flex w-full max-w-none flex-col px-2 py-3 sm:px-3 md:px-5 md:py-6">
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Master Sets
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-950 md:text-3xl">
                Character Tracker
              </h1>
            </div>
          </div>

          <div className="px-4 py-3 md:px-6 md:py-4">
            <MasterSetsFilters
              search={search}
              region={region}
              relationType={relationType}
              priceField={priceField}
              regionOptions={regionOptions}
              relationTypeOptions={relationTypeOptions}
            />
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
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
