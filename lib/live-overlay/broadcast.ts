import type { LiveOverlayState } from "@/lib/live-overlay/types";

/**
 * Empuja el estado del overlay al Durable Object (ohara-live-worker) para que
 * haga broadcast por WebSocket a los clientes conectados (overlay / Live Desk).
 *
 * Es fire-and-forget: si falla (worker caído, env sin configurar) NO revienta el
 * request — el sistema degrada a polling. Postgres ya es la fuente de verdad.
 */
export async function broadcastLiveOverlayState(
  token: string,
  state: LiveOverlayState
): Promise<void> {
  const baseUrl = process.env.LIVE_WORKER_BROADCAST_URL;
  const secret = process.env.LIVE_BROADCAST_SECRET;

  // Sin configurar → no-op (degradación con gracia a polling).
  if (!baseUrl || !secret) return;

  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/broadcast/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(state),
      // El overlay no puede esperar; si el worker tarda, que no bloquee el panel.
      signal: AbortSignal.timeout(2500),
    });
  } catch (error) {
    console.error("[live-overlay] broadcast failed:", error);
  }
}
