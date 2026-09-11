/**
 * Catálogo GLOBAL de regalos de TikTok (id → nombre + valor en diamantes),
 * gratis vía la API de Eulerstream (no requiere plan Business). Mismo fetch
 * de 2 pasos que ya usa el Cloudflare Worker (cloudflare-live/src/index.ts,
 * método ensureGiftCatalog) pero corriendo del lado de Next.js — acá SÍ hace
 * falta EULERSTREAM_API_KEY como env var (antes solo vivía como secreto del
 * Worker), porque el admin quiere elegir el regalo de un dropdown ANTES de
 * arrancar un live, no solo cuando ya hay una conexión activa.
 */

export type TikTokGiftCatalogEntry = {
  id: number;
  name: string;
  diamondCount: number;
  combo: boolean;
};

// Cache en memoria (por instancia de servidor) — el catálogo global casi no
// cambia, no hace falta pegarle a Eulerstream en cada carga del panel de admin.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: { at: number; gifts: TikTokGiftCatalogEntry[] } | null = null;

export const getTikTokGiftCatalog = async (): Promise<TikTokGiftCatalogEntry[]> => {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.gifts;

  const apiKey = process.env.EULERSTREAM_API_KEY;
  if (!apiKey) throw new Error("EULERSTREAM_API_KEY no configurada");

  const listResp = await fetch(
    `https://api.eulerstream.com/webcast/gifts?apiKey=${encodeURIComponent(apiKey)}`
  );
  if (!listResp.ok) throw new Error(`Eulerstream respondió ${listResp.status}`);
  const listJson = (await listResp.json()) as { url?: string };
  if (!listJson.url) throw new Error("Eulerstream no devolvió la URL del catálogo");

  const fileResp = await fetch(listJson.url);
  const file = (await fileResp.json()) as {
    data?: { gifts?: Array<{ id: number; name: string; diamond_count: number; combo?: boolean }> };
  };

  const gifts = (file.data?.gifts ?? [])
    .filter((g): g is { id: number; name: string; diamond_count: number; combo?: boolean } => {
      return typeof g.id === "number" && !!g.name;
    })
    .map((g) => ({
      id: g.id,
      name: g.name,
      diamondCount: g.diamond_count || 0,
      combo: g.combo !== false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cache = { at: Date.now(), gifts };
  return gifts;
};
