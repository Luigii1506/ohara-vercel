export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/catalog-audit/apply
 * Body: { fixes: { cardId: number, alternateArt: string }[] }
 * Aplica la clasificación de TCGplayer al alternateArt de las cartas indicadas.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fixes: { cardId: number; alternateArt: string }[] = Array.isArray(body.fixes)
      ? body.fixes
      : [];
    const clean = fixes.filter(
      (f) => Number.isFinite(Number(f.cardId)) && typeof f.alternateArt === "string" && f.alternateArt.trim()
    );
    if (!clean.length) {
      return NextResponse.json({ error: "Sin fixes válidos" }, { status: 400 });
    }

    let applied = 0;
    for (const f of clean) {
      await prisma.card.update({
        where: { id: Number(f.cardId) },
        data: { alternateArt: f.alternateArt.trim() },
      });
      applied += 1;
    }

    return NextResponse.json({ applied });
  } catch (error: any) {
    console.error("[catalog-audit] apply failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Apply failed" },
      { status: 500 }
    );
  }
}
