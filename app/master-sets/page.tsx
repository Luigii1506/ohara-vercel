export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import {
  getMasterSetBrowseOptions,
  getMasterSetRelationTypeLabel,
  getMasterSetSummariesPage,
} from "@/lib/master-sets/query";
import MasterSetsFilters from "./MasterSetsFilters";
import MasterSetsListClient from "./MasterSetsListClient";

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
  if (!session?.user?.email) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      const current = Array.isArray(value) ? value[0] : value;
      if (current) query.set(key, current);
    }
    const callbackUrl = query.toString()
      ? `/master-sets?${query.toString()}`
      : "/master-sets";
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

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

  const [initialPage, browseOptions] = await Promise.all([
    getMasterSetSummariesPage({
      userId: user?.id ?? null,
      search: search || undefined,
      variantMode: "all",
      region,
      relationType,
      limit: 24,
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
          <MasterSetsListClient
            initialPage={initialPage}
            search={search}
            region={region}
            relationType={relationType}
            priceField={priceField}
          />
        </section>
      </div>
    </main>
  );
}
