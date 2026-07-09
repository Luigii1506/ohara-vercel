// Valida el parser de replay contra logs reales de OPTCGSim.
//
// Uso:
//   npx tsx scripts/replay-parse-test.ts "<ruta a un .log>"
//   npx tsx scripts/replay-parse-test.ts            (usa un log de ejemplo en $HOME)
//
// Reporta: distribución de tipos de evento, cuántas líneas quedaron como "raw"
// (no reconocidas), y valida que la mano derivada por robos coincida con los
// checkpoints "Hand:" que trae el log (prueba de que el replay es determinista).

import fs from "fs";
import os from "os";
import path from "path";
import { parseReplayLog } from "@/lib/replay/parseLog";
import { applyEvent, deriveSideMap, foldEvents, makeContext } from "@/lib/replay/reduce";
import { ReplayEvent } from "@/types/replay";
import { Side } from "@/types/simulator";

const DEFAULT_DIR = path.join(
  os.homedir(),
  "Library/Application Support/com.Batsu.OPTCGSim/CombatLogs/AutoSaved"
);

function pickFile(arg?: string): string {
  if (arg) return arg;
  const files = fs
    .readdirSync(DEFAULT_DIR)
    .filter((f) => f.endsWith(".log"))
    .map((f) => path.join(DEFAULT_DIR, f));
  // El más pesado suele ser el más completo.
  files.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  return files[0];
}

function main() {
  const file = pickFile(process.argv[2]);
  const content = fs.readFileSync(file, "utf8");
  const replay = parseReplayLog(content);

  console.log(`\n📄 ${path.basename(file)}`);
  console.log("─".repeat(60));
  console.log("Jugadores:", replay.header.players.join("  vs  "));
  for (const p of replay.header.players) {
    const l = replay.header.leaders[p];
    console.log(`  ${p}: líder ${l?.name ?? "?"} [${l?.code ?? "?"}]`);
  }
  console.log("Primer jugador:", replay.header.firstPlayer ?? "?");
  console.log(
    "Resultado:",
    replay.header.winner
      ? `gana ${replay.header.winner} (${replay.header.endReason})`
      : "indeterminado"
  );
  console.log("Turnos:", replay.turns.length);
  console.log("Eventos:", replay.events.length);

  // Distribución de tipos
  const counts: Record<string, number> = {};
  for (const e of replay.events) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  console.log("\nDistribución de eventos:");
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(16)} ${v}`);
  }

  // Líneas no reconocidas
  const raws = replay.events.filter(
    (e): e is Extract<ReplayEvent, { kind: "raw" }> => e.kind === "raw"
  );
  console.log(`\n⚠️  Líneas 'raw' (no reconocidas): ${raws.length}`);
  const rawSamples = new Map<string, number>();
  for (const r of raws) {
    const key = r.text.replace(/\[[^\]]*\]/g, "[…]").slice(0, 70);
    rawSamples.set(key, (rawSamples.get(key) ?? 0) + 1);
  }
  Array.from(rawSamples.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([k, v]) => console.log(`    (${v}) ${k}`));

  // ── Validación determinista: reconstruir la mano por robos y compararla
  //    con el primer checkpoint "Hand:" de cada jugador. ──
  console.log("\n🔍 Validación mano-por-robos vs checkpoint:");
  validateHands(replay.events);

  // ── Precisión del reducer: medir la deriva del modelo por-eventos vs cada
  //    checkpoint ANTES de reconciliar. 0 = el modelo ya estaba exacto. ──
  console.log("\n🎯 Precisión del reducer (deriva antes de reconciliar):");
  measureReducerDrift(replay);

  // ── Estado final plegando TODOS los eventos ──
  const finalState = foldEvents(replay, replay.events.length - 1);
  console.log("\n🏁 Estado final (plegado completo):");
  console.log(
    `  Vida  player=${finalState.life.player}  opponent=${finalState.life.opponent}`
  );
  for (const side of ["player", "opponent"] as Side[]) {
    const hand = finalState.zones[`${side}-hand`].cardUids.length;
    const board = finalState.zones[`${side}-front-row`].cardUids.length;
    const trash = finalState.zones[`${side}-trash`].cardUids.length;
    console.log(`  ${side.padEnd(9)} mano=${hand} board=${board} trash=${trash}`);
  }
  console.log(`  Turno final: ${finalState.turn}`);
}

function measureReducerDrift(replay: ReturnType<typeof parseReplayLog>) {
  const { ctx, state } = makeContext(replay);
  const sideMap = deriveSideMap(replay.header);
  let checkpoints = 0;
  let exact = 0;
  const zoneStats: Record<string, { n: number; exact: number; totalDiff: number }> = {};

  for (const ev of replay.events) {
    if (ev.kind === "checkpoint") {
      const side = sideMap[ev.player];
      if (side) {
        const kind = ev.zone === "board" ? "front-row" : ev.zone;
        const current = state.zones[`${side}-${kind}` as const].cardUids.map(
          (uid) => state.cards[uid]?.cardId as string
        );
        const diff = multisetDiff(current, ev.cards);
        checkpoints += 1;
        if (diff === 0) exact += 1;
        const zs = (zoneStats[ev.zone] ??= { n: 0, exact: 0, totalDiff: 0 });
        zs.n += 1;
        if (diff === 0) zs.exact += 1;
        zs.totalDiff += diff;
      }
    }
    applyEvent(state, ev, ctx);
  }

  console.log(
    `  ${exact}/${checkpoints} checkpoints ya EXACTOS por eventos (sin ayuda del reconcile)`
  );
  for (const [zone, s] of Object.entries(zoneStats)) {
    console.log(
      `    ${zone.padEnd(6)} exactos ${s.exact}/${s.n}  ·  cartas mal ubicadas promedio: ${(
        s.totalDiff / s.n
      ).toFixed(2)}`
    );
  }
  console.log(
    "  (con reconcile, TODOS quedan exactos en cada frontera de turno — esta métrica\n" +
      "   solo mide qué tan fino es el modelo entre checkpoints)."
  );
}

/** Nº de cartas que difieren entre dos multiconjuntos de códigos. */
function multisetDiff(a: string[], b: string[]): number {
  const count = new Map<string, number>();
  for (const c of a) count.set(c, (count.get(c) ?? 0) + 1);
  for (const c of b) count.set(c, (count.get(c) ?? 0) - 1);
  let diff = 0;
  count.forEach((v) => (diff += Math.abs(v)));
  return diff;
}

function validateHands(events: ReplayEvent[]) {
  // Mano simulada: parte de "Hand after Mulligan" y suma cada "Drew card from deck".
  const hands = new Map<string, string[]>();
  let checked = 0;
  let ok = 0;

  for (const e of events) {
    if (e.kind === "handReveal" && e.phase === "after") {
      hands.set(e.player, e.cards.slice());
    } else if (e.kind === "draw" && e.drawType === "deck" && e.card?.code) {
      const h = hands.get(e.player);
      if (h) h.push(e.card.code);
    } else if (e.kind === "checkpoint" && e.zone === "hand") {
      const h = hands.get(e.player);
      if (!h) continue;
      // Solo comparamos como multiconjunto de códigos (el orden y las jugadas
      // intermedias que quitan cartas de la mano se ignoran en esta prueba básica).
      checked += 1;
      const expected = e.cards.slice().sort().join(",");
      const derived = h.slice().sort().join(",");
      // El derivado por robos será SUPERCONJUNTO del checkpoint (aún no restamos
      // deploys/counters). Verificamos que el checkpoint ⊆ derivado.
      const subset = isSubset(e.cards, h);
      if (subset) ok += 1;
      if (checked <= 4) {
        console.log(
          `  ${e.player} L${e.line}: checkpoint⊆robos = ${subset ? "✅" : "❌"}`
        );
        if (!subset) {
          console.log(`    checkpoint: ${expected}`);
          console.log(`    derivado  : ${derived}`);
        }
      }
    }
  }
  console.log(
    `  → ${ok}/${checked} checkpoints de mano contenidos en los robos derivados`
  );
  console.log(
    "  (nota: el reducer real restará deploys/counters; esta prueba solo confirma\n" +
      "   que NO falta información de robos, que es lo que preocupaba)."
  );
}

function isSubset(sub: string[], sup: string[]): boolean {
  const pool = new Map<string, number>();
  for (const c of sup) pool.set(c, (pool.get(c) ?? 0) + 1);
  for (const c of sub) {
    const n = pool.get(c) ?? 0;
    if (n <= 0) return false;
    pool.set(c, n - 1);
  }
  return true;
}

main();
