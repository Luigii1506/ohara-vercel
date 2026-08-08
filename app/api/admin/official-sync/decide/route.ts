export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  applyOfficialItem,
  ignoreOfficialItem,
} from "@/lib/services/officialSync";

/**
 * Aceptar (subir a BD+R2) o ignorar items de la cola.
 * Body: { ids: number[], action: "apply" | "ignore" }
 */
export async function POST(req: NextRequest) {
  const t = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!t?.email || t.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: number[] = Array.isArray(body?.ids)
    ? body.ids.map((n: unknown) => Number(n)).filter(Number.isFinite)
    : [];
  const action = body?.action === "ignore" ? "ignore" : "apply";
  if (!ids.length)
    return NextResponse.json({ error: "Sin items" }, { status: 400 });

  const results: { id: number; ok: boolean; cardId?: number; error?: string }[] =
    [];
  for (const id of ids) {
    try {
      if (action === "ignore") {
        await ignoreOfficialItem(id);
        results.push({ id, ok: true });
      } else {
        const { cardId } = await applyOfficialItem(id);
        results.push({ id, ok: true, cardId });
      }
    } catch (e) {
      results.push({ id, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    action,
    applied: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
  });
}
