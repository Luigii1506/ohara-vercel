export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/catalog-gaps/bulk
 * Body: { ids: number[], action: "resolve" | "unresolve" | "ignore" | "unignore" }
 * Acción masiva sobre varios huecos a la vez.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids: number[] = Array.isArray(body.ids)
      ? body.ids.filter((n: any) => Number.isFinite(Number(n))).map(Number)
      : [];
    const action = String(body.action ?? "");
    if (!ids.length) {
      return NextResponse.json({ error: "Sin ids" }, { status: 400 });
    }
    const data: any = {};
    if (action === "resolve") data.resolved = true;
    else if (action === "unresolve") data.resolved = false;
    else if (action === "ignore") data.ignored = true;
    else if (action === "unignore") data.ignored = false;
    else return NextResponse.json({ error: "Acción inválida" }, { status: 400 });

    const result = await prisma.catalogGap.updateMany({
      where: { id: { in: ids } },
      data,
    });
    return NextResponse.json({ updated: result.count });
  } catch (error: any) {
    console.error("[catalog-gaps] bulk failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed bulk update" },
      { status: 500 }
    );
  }
}
