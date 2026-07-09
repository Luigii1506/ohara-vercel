// Resumen ligero de un log para la lista de partidas (sin guardar los eventos).

import { parseReplayLog } from "@/lib/replay/parseLog";

export interface GameSummary {
  name: string;
  playedAt: number; // timestamp para ordenar
  dateLabel: string;
  players: string[];
  leaders: { code: string; name: string }[];
  winner?: string;
  loser?: string;
  endReason?: string;
  turns: number;
}

/** Deriva fecha desde el nombre "2026-07-04T10.16.24.log" o cae al lastModified. */
function parseDate(name: string, fallback: number): { ts: number; label: string } {
  const m = name.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})[.:](\d{2})[.:](\d{2})/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    const ts = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
    if (!Number.isNaN(ts)) {
      return {
        ts,
        label: `${d}/${mo}/${y} ${h}:${mi}`,
      };
    }
  }
  const date = new Date(fallback);
  return {
    ts: fallback,
    label: date.toLocaleString(),
  };
}

export function summarizeLog(
  name: string,
  content: string,
  lastModified: number
): GameSummary {
  const parsed = parseReplayLog(content);
  const { ts, label } = parseDate(name, lastModified);
  return {
    name,
    playedAt: ts,
    dateLabel: label,
    players: parsed.header.players,
    leaders: parsed.header.players
      .map((p) => parsed.header.leaders[p])
      .filter((c): c is { name: string; code: string } => Boolean(c))
      .map((c) => ({ code: c.code, name: c.name })),
    winner: parsed.header.winner,
    loser: parsed.header.loser,
    endReason: parsed.header.endReason,
    turns: parsed.turns.length,
  };
}
