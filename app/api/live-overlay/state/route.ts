import { NextRequest, NextResponse } from "next/server";
import { applyLiveOverlayBattleAutoFire, getLiveOverlayState } from "@/lib/live-overlay/store";
import { isLiveOverlayTokenValid } from "@/lib/live-overlay/token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const since = request.nextUrl.searchParams.get("since");

  if (!isLiveOverlayTokenValid(token)) {
    return NextResponse.json({ error: "Invalid overlay token" }, { status: 401 });
  }

  let state = await getLiveOverlayState(token!);
  // Auto-ataque real de la Team Battle: este endpoint ya se pide cada
  // 1-2.5s desde cualquier overlay abierto durante una ronda activa, así que
  // lo reusamos como "tick" en vez de agregar un cron o tocar el Worker de
  // Cloudflare. No-op instantáneo (una lectura barata) si no hay ronda activa
  // o si todavía no toca disparar según el cooldown.
  if (state.battle.active) {
    state = await applyLiveOverlayBattleAutoFire(token!);
  }

  // Polling condicional: si el overlay ya tiene la última versión, respondemos
  // vacío (sin re-enviar el estado). Ahorra payload en cada tick.
  if (since && since === state.updatedAt) {
    return NextResponse.json({ ok: true, changed: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true, changed: true, state }, { status: 200 });
}
