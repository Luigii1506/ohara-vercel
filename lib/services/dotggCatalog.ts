/**
 * Conteo de impresiones por código según DotGG (fuente auxiliar de alt-arts).
 *
 * DotGG lista cada alt-art como un id propio: OP01-001 (base), OP01-001_P1,
 * OP01-001_R1, … Contamos cuántas impresiones conoce DotGG por código base.
 *
 * El dataset son ~3MB, así que se cachea en memoria del proceso (TTL 1h) para
 * no re-bajarlo en cada request del admin.
 */
const DOTGG_URL =
  "https://api.dotgg.gg/cgfw/getcards?game=onepiece&mode=indexed";
const TTL_MS = 60 * 60 * 1000;

export type DotggPrint = { code: string; total: number; name: string | null };

let cache: { at: number; data: Map<string, DotggPrint> } | null = null;

const stripVariant = (code: string) => code.replace(/_[A-Za-z]\d+$/i, "");
const isDonNoise = (code: string) => /^DON-?\d{4,}$/i.test(code);

export async function getDotggPrintings(): Promise<Map<string, DotggPrint>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const res = await fetch(DOTGG_URL);
  if (!res.ok) throw new Error(`DotGG HTTP ${res.status}`);
  const payload = (await res.json()) as { names: string[]; data: any[][] };
  const idIdx = payload.names.indexOf("id");
  const nameIdx = payload.names.indexOf("name");

  const map = new Map<string, DotggPrint>();
  for (const row of payload.data) {
    const raw = String(row[idIdx] ?? "").toUpperCase();
    if (!raw) continue;
    const code = stripVariant(raw);
    if (isDonNoise(code)) continue;
    const prev = map.get(code);
    if (prev) {
      prev.total += 1;
    } else {
      map.set(code, {
        code,
        total: 1,
        name: nameIdx >= 0 ? (row[nameIdx] ?? null) : null,
      });
    }
  }

  cache = { at: Date.now(), data: map };
  return map;
}
