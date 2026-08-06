import { NextRequest, NextResponse } from "next/server";
import { getLiveOverlayState } from "@/lib/live-overlay/store";
import { isLiveOverlayTokenValid } from "@/lib/live-overlay/token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const since = request.nextUrl.searchParams.get("since");

  if (!isLiveOverlayTokenValid(token)) {
    return NextResponse.json({ error: "Invalid overlay token" }, { status: 401 });
  }

  const state = await getLiveOverlayState(token!);

  // Polling condicional: si el overlay ya tiene la última versión, respondemos
  // vacío (sin re-enviar el estado). Ahorra payload en cada tick.
  if (since && since === state.updatedAt) {
    return NextResponse.json({ ok: true, changed: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true, changed: true, state }, { status: 200 });
}
