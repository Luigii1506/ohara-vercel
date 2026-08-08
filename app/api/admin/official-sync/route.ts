export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import {
  OFFICIAL_REGIONS,
  scanOfficialRegion,
} from "@/lib/services/officialSync";

async function requireAdmin(req: NextRequest) {
  const t = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return t?.email && t.role === "ADMIN";
}

/** Lista items de la cola de revisión. */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const region = req.nextUrl.searchParams.get("region") || undefined;
  const status =
    (req.nextUrl.searchParams.get("status") as
      | "PENDING"
      | "APPLIED"
      | "IGNORED"
      | null) || "PENDING";

  const where: Record<string, unknown> = { decisionStatus: status };
  if (region) where.region = region;

  const items = await prisma.officialSyncItem.findMany({
    where,
    orderBy: [{ setCode: "asc" }, { code: "asc" }, { variant: "asc" }],
    take: 2000,
  });

  // Conteos por región (PENDIENTES)
  const pendingCounts = await prisma.officialSyncItem.groupBy({
    by: ["region"],
    where: { decisionStatus: "PENDING" },
    _count: { _all: true },
  });

  return NextResponse.json({
    ok: true,
    regions: Object.entries(OFFICIAL_REGIONS).map(([key, cfg]) => ({
      key,
      label: cfg.label,
    })),
    items,
    pendingCounts: pendingCounts.map((c) => ({
      region: c.region,
      count: c._count._all,
    })),
  });
}

/** Escanea una región (opcional: un set) y llena la cola de PENDIENTES. */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const region = String(body?.region ?? "").trim();
  if (!OFFICIAL_REGIONS[region.toUpperCase()])
    return NextResponse.json({ error: "Región inválida" }, { status: 400 });

  const setFilter =
    typeof body?.set === "string" && body.set.trim()
      ? body.set.split(",").map((s: string) => s.trim()).filter(Boolean)
      : undefined;

  try {
    const result = await scanOfficialRegion(region, { setFilter });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[official-sync/scan] failed:", e);
    return NextResponse.json(
      { error: (e as Error).message ?? "Scan failed" },
      { status: 500 }
    );
  }
}
