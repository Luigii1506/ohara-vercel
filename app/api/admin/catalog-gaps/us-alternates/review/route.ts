export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/catalog-gaps/us-alternates/review
 * Body: { refKey: string, code: string, status: "have" | "ignored" | "none" }
 *
 * Marca un candidato de alt-art como "ya la tengo" / "ignorar", o lo limpia
 * ("none"). refKey = "tcg:<productId>" | "mc:<missingCardId>".
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const refKey = String(body.refKey ?? "");
    const code = String(body.code ?? "");
    const status = String(body.status ?? "");
    if (!refKey || !/^(tcg|mc):/.test(refKey)) {
      return NextResponse.json({ error: "refKey inválido" }, { status: 400 });
    }

    if (status === "none") {
      await prisma.altArtReview.deleteMany({ where: { refKey } });
      return NextResponse.json({ ok: true, cleared: true });
    }
    if (status !== "have" && status !== "ignored") {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }

    await prisma.altArtReview.upsert({
      where: { refKey },
      update: { status, code },
      create: { refKey, code, status },
    });
    return NextResponse.json({ ok: true, status });
  } catch (error: any) {
    console.error("[us-alternates/review] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed" },
      { status: 500 }
    );
  }
}
