/**
 * Proxy server-to-server hacia las rutas /tiktok/:token/* del worker
 * (ohara-live-worker), que mantiene la conexión al WebSocket de Eulerstream.
 * Usa el MISMO secreto que ya protege /broadcast (LIVE_BROADCAST_SECRET).
 */

type TikTokStatus = { ok: boolean; connected: boolean; username: string | null };

const workerFetch = async (path: string, init?: RequestInit) => {
  const baseUrl = process.env.LIVE_WORKER_BROADCAST_URL;
  const secret = process.env.LIVE_BROADCAST_SECRET;
  if (!baseUrl || !secret) {
    throw new Error("Live worker no configurado (LIVE_WORKER_BROADCAST_URL/LIVE_BROADCAST_SECRET)");
  }
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${secret}`,
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`Worker respondió ${response.status}`);
  }
  return response.json();
};

export const connectTikTok = (token: string, username: string) =>
  workerFetch(`/tiktok/${encodeURIComponent(token)}/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const disconnectTikTok = (token: string) =>
  workerFetch(`/tiktok/${encodeURIComponent(token)}/disconnect`, {
    method: "POST",
  });

export const getTikTokStatus = (token: string): Promise<TikTokStatus> =>
  workerFetch(`/tiktok/${encodeURIComponent(token)}/status`, { method: "GET" });
