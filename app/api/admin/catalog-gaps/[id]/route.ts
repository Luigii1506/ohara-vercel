export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/admin/catalog-gaps/[id]
 * Body: { resolved?: boolean, ignored?: boolean }
 * Marca un hueco como resuelto (ya ingerido) o ignorado (no aplica).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }
    const body = await req.json();
    const data: any = {};
    if (typeof body.resolved === "boolean") data.resolved = body.resolved;
    if (typeof body.ignored === "boolean") data.ignored = body.ignored;
    if (!Object.keys(data).length) {
      return NextResponse.json(
        { error: "Nada que actualizar (resolved/ignored)" },
        { status: 400 }
      );
    }
    const gap = await prisma.catalogGap.update({ where: { id }, data });
    return NextResponse.json({ gap });
  } catch (error: any) {
    console.error("[catalog-gaps] PATCH failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to update" },
      { status: 500 }
    );
  }
}
