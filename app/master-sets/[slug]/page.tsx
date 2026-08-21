export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import {
  getMasterSetDetail,
  getMasterSetRelationTypeLabel,
} from "@/lib/master-sets/query";
import MasterSetCardsClient from "./MasterSetCardsClient";
import MasterSetDetailFilters from "./MasterSetDetailFilters";

type PageProps = {
  params: { slug: string };
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

export default async function MasterSetDetailPage({
  params,
  searchParams,
}: PageProps) {
  const session = await getServerSession(authOptions);
  const user = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
    : null;

  const region = readString(searchParams.region) || "US";
  const relationType = readString(searchParams.relationType) || "all";
  const priceField =
    readString(searchParams.priceField) === "midPrice"
      ? "midPrice"
      : "marketPrice";

  const detail = await getMasterSetDetail(params.slug, {
      userId: user?.id ?? null,
      variantMode: "all",
      region,
      relationType,
    });

  if (!detail) {
    notFound();
  }

  const cards = detail.cards;

  const regionOptions = [
    ...REGION_OPTIONS.map((item) => ({
      value: item,
      label: `Region ${item}`,
    })),
    { value: "all", label: "Todas las regiones" },
  ];

  const relationTypeOptions = [
    { value: "all", label: "Todas las relaciones" },
    ...detail.availableRelationTypes.map((item) => ({
      value: item,
      label: getMasterSetRelationTypeLabel(item),
    })),
  ];

  const activeFilterCount = [
    region !== "US",
    relationType !== "all",
    priceField !== "marketPrice",
  ].filter(Boolean).length;

  const shownTotalValue = cards.reduce(
    (sum, card) =>
      sum +
      (priceField === "midPrice"
        ? (card.midPrice ?? card.marketPrice ?? 0)
        : (card.marketPrice ?? card.midPrice ?? 0)),
    0
  );
  const shownAverageValue = cards.length > 0 ? shownTotalValue / cards.length : 0;
  const totalValue =
    priceField === "midPrice" ? detail.totalMidValue : detail.totalMarketValue;
  const averageValue =
    priceField === "midPrice" ? detail.averageMidPrice : detail.averageMarketPrice;

  return (
    <main className="min-h-screen bg-[#f2eede]">
      <div className="mx-auto flex w-full max-w-none flex-col px-2 py-3 sm:px-3 md:px-5 md:py-6">
        <Link
          href="/master-sets"
          className="mb-3 inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          Back to master sets
        </Link>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6 md:py-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(440px,0.9fr)] xl:items-start">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Character Master Set
                </p>
                <h1 className="mt-2 text-2xl font-bold text-slate-950 md:text-3xl">
                  {detail.character.name}
                </h1>
                {detail.character.description ? (
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                    {detail.character.description}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {detail.character.aliases.map((alias) => (
                    <span
                      key={alias}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="col-span-2 rounded-[24px] bg-slate-900 px-4 py-4 text-white md:col-span-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-300">
                    {priceField === "midPrice" ? "Listed Median total" : "Market total"}
                  </div>
                  <div className="mt-1 text-3xl font-bold md:text-[2rem]">
                    ${totalValue.toFixed(2)}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">valor completo del master set</div>
                </div>
                <div className="col-span-2 rounded-[24px] bg-indigo-50 px-4 py-4 md:col-span-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-700/80">
                    Visible value
                  </div>
                  <div className="mt-1 text-3xl font-bold text-indigo-900 md:text-[2rem]">
                    ${shownTotalValue.toFixed(2)}
                  </div>
                  <div className="mt-1 text-sm text-indigo-700/80">
                    {cards.length} cartas visibles con filtros
                  </div>
                </div>
                <div className="rounded-[22px] bg-slate-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-slate-950">{detail.totalCards}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Total
                  </div>
                </div>
                <div className="rounded-[22px] bg-emerald-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-emerald-700">
                    {detail.ownedCards}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700/80">
                    Owned
                  </div>
                </div>
                <div className="rounded-[22px] bg-rose-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-rose-700">
                    {detail.missingCards}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-rose-700/80">
                    Missing
                  </div>
                </div>
                <div className="rounded-[22px] bg-amber-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-amber-800">{activeFilterCount}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-amber-800/80">
                    Filters
                  </div>
                </div>
                <div className="rounded-[22px] bg-indigo-50 px-3 py-3 text-center md:col-span-2">
                  <div className="text-lg font-bold text-indigo-900">
                    ${averageValue.toFixed(2)}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-700/80">
                    Avg per card
                  </div>
                </div>
                <div className="rounded-[22px] bg-white px-3 py-3 text-center ring-1 ring-slate-200 md:col-span-2">
                  <div className="text-lg font-bold text-slate-950">
                    ${shownAverageValue.toFixed(2)}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Avg visible
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 md:px-6">
            <MasterSetDetailFilters
              region={region}
              relationType={relationType}
              priceField={priceField}
              regionOptions={regionOptions}
              relationTypeOptions={relationTypeOptions}
            />

            <div className="mt-4 rounded-[24px] border border-slate-100 bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="rounded-2xl bg-white px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Visible cards
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-950">
                    {cards.length}
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Visible value
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-950">
                    ${shownTotalValue.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Avg visible
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-950">
                    ${shownAverageValue.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    Relation types
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-950">
                    {relationType === "all" ? detail.availableRelationTypes.length : 1}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-sm font-medium text-slate-600">
              {cards.length} cards mostradas
            </p>
          </div>

          <MasterSetCardsClient
            cards={cards}
            priceField={priceField}
            characterName={detail.character.name}
          />
        </section>
      </div>
    </main>
  );
}
