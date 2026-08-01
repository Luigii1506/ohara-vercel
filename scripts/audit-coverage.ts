#!/usr/bin/env -S npx tsx
/**
 * Auditoría de cobertura del catálogo (SOLO LECTURA — no modifica nada).
 *
 * Responde la pregunta central de Ohara: "¿tengo todas las versiones de cada
 * carta, incluyendo exclusivas de cada región?".
 *
 * Dos análisis:
 *   1) MATRIZ CROSS-REGIÓN: por cada código base, qué regiones lo tienen y
 *      cuáles no. Agregado por set. No depende de fuentes externas → 100% fiable.
 *   2) CRUCE vs MASTER (DotGG): códigos del catálogo inglés que NO existen en
 *      nuestra región US (cartas que nos faltan por completo). Requiere red.
 *
 * Uso:
 *   npx tsx scripts/audit-coverage.ts                # ambos análisis
 *   npx tsx scripts/audit-coverage.ts --no-master    # solo cross-región (offline)
 *   npx tsx scripts/audit-coverage.ts --set=OP14     # detalle de un set
 *   npx tsx scripts/audit-coverage.ts --json=out.json
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma";

const DOTGG_URL =
  "https://api.dotgg.gg/cgfw/getcards?game=onepiece&mode=indexed";

// Regiones que consideramos "activas" para el reporte cross-región.
const REGIONS = ["US", "JP", "CN", "KR", "FR"] as const;
type Region = (typeof REGIONS)[number];

type Cli = { master: boolean; set?: string; json?: string };

function parseCli(): Cli {
  const cli: Cli = { master: true };
  for (const a of process.argv.slice(2)) {
    if (a === "--no-master") cli.master = false;
    else if (a.startsWith("--set=")) cli.set = a.slice(6).toUpperCase();
    else if (a.startsWith("--json=")) cli.json = a.slice(7);
  }
  return cli;
}

/** Prefijo de set a partir del código (OP14-054 → OP14, EB04-011 → EB04,
 *  ST01-002 → ST01, P-001 → P, PRB01-001 → PRB01). */
function setOf(code: string): string {
  const m = code.match(/^([A-Za-z]+\d+|[A-Za-z]+)(?=-|\d)/);
  if (m) return m[1].toUpperCase();
  const dash = code.indexOf("-");
  return (dash > 0 ? code.slice(0, dash) : code).toUpperCase();
}

/** Ordena sets: OP## < EB## < ST## < PRB## < P < resto, y por número dentro. */
function setSortKey(set: string): [number, number, string] {
  const fam = set.match(/^([A-Za-z]+)/)?.[1] ?? set;
  const num = Number(set.match(/(\d+)/)?.[1] ?? "0");
  const order: Record<string, number> = { OP: 0, EB: 1, ST: 2, PRB: 3, P: 4 };
  return [order[fam] ?? 9, num, set];
}

async function crossRegionAudit(cli: Cli) {
  // Todas las cartas base (isFirstEdition) con su código y región.
  const rows = await prisma.card.findMany({
    where: { isFirstEdition: true, region: { in: [...REGIONS] } },
    select: { code: true, region: true },
  });

  // code -> Set<region>
  const byCode = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.code || !r.region) continue;
    const s = byCode.get(r.code) ?? new Set<string>();
    s.add(r.region);
    byCode.set(r.code, s);
  }

  // Agregar por set.
  type SetStat = {
    set: string;
    union: number;
    per: Record<Region, number>;
    missing: Record<Region, string[]>;
  };
  const sets = new Map<string, SetStat>();
  for (const [code, regs] of byCode) {
    const set = setOf(code);
    let st = sets.get(set);
    if (!st) {
      st = {
        set,
        union: 0,
        per: { US: 0, JP: 0, CN: 0, KR: 0, FR: 0 },
        missing: { US: [], JP: [], CN: [], KR: [], FR: [] },
      };
      sets.set(set, st);
    }
    st.union += 1;
    for (const region of REGIONS) {
      if (regs.has(region)) st.per[region] += 1;
      else st.missing[region].push(code);
    }
  }

  const sorted = [...sets.values()].sort((a, b) => {
    const ka = setSortKey(a.set);
    const kb = setSortKey(b.set);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
  });

  // ---- Detalle de un set concreto ----
  if (cli.set) {
    const st = sets.get(cli.set);
    if (!st) {
      console.log(`\nNo hay cartas del set "${cli.set}" en la DB.`);
      return { sorted, byCode };
    }
    console.log(`\n===== DETALLE SET ${st.set} (union ${st.union} códigos) =====`);
    for (const region of REGIONS) {
      const miss = st.missing[region];
      console.log(
        `  ${region}: ${st.per[region]}/${st.union}` +
          (miss.length ? `  · faltan ${miss.length}: ${miss.sort().join(", ")}` : "  ✓ completo")
      );
    }
    return { sorted, byCode };
  }

  // ---- Tabla resumen por set ----
  console.log("\n===== COBERTURA CROSS-REGIÓN (cartas base por set) =====");
  console.log("Union = códigos que existen en AL MENOS una región.\n");
  const pad = (v: string | number, n: number) => String(v).padStart(n);
  console.log(
    `  ${"SET".padEnd(7)}${"UNION".padStart(6)}` +
      REGIONS.map((r) => pad(r, 7)).join("") +
      "   HUECOS"
  );
  let totalGaps = 0;
  for (const st of sorted) {
    const cells = REGIONS.map((r) => {
      const n = st.per[r];
      const full = n === st.union;
      return pad(full ? `${n}` : `${n}*`, 7);
    }).join("");
    const gaps = REGIONS.reduce((acc, r) => acc + st.missing[r].length, 0);
    totalGaps += gaps;
    console.log(`  ${st.set.padEnd(7)}${pad(st.union, 6)}${cells}   ${gaps || ""}`);
  }
  console.log(
    `\n  (* = región incompleta para ese set)   HUECOS TOTALES cross-región: ${totalGaps}`
  );

  // Top regiones con más huecos.
  const regionGaps: Record<Region, number> = { US: 0, JP: 0, CN: 0, KR: 0, FR: 0 };
  for (const st of sorted)
    for (const r of REGIONS) regionGaps[r] += st.missing[r].length;
  console.log("\n  Huecos por región (códigos que existen en otra región pero faltan aquí):");
  for (const r of REGIONS)
    console.log(`    ${r}: ${regionGaps[r]}`);

  return { sorted, byCode };
}

async function masterCrossCheck(byCode: Map<string, Set<string>>) {
  console.log("\n===== CRUCE vs MASTER DotGG (catálogo inglés) =====");
  let payload: { names: string[]; data: any[][] };
  try {
    const res = await fetch(DOTGG_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    payload = (await res.json()) as any;
  } catch (e: any) {
    console.log(`  [skip] No se pudo bajar DotGG: ${e.message}`);
    return;
  }
  const idIdx = payload.names.indexOf("id");
  // DotGG codifica alt-arts como CODE_P1 / CODE_R1 / CODE_P2… (código propio).
  // Nosotros los guardamos como `alternateArt` sobre el MISMO código base.
  // Para comparar cobertura real hay que normalizar al código base.
  const stripVariant = (code: string) => code.replace(/_[A-Za-z]\d+$/i, "");

  const masterBase = new Set<string>(); // códigos base (sin sufijo de variante)
  let variantCount = 0;
  for (const row of payload.data) {
    const raw = String(row[idIdx] ?? "").toUpperCase();
    if (!raw) continue;
    const base = stripVariant(raw);
    if (base !== raw) variantCount += 1;
    masterBase.add(base);
  }
  console.log(
    `  DotGG: ${payload.data.length} filas → ${masterBase.size} códigos BASE únicos ` +
      `(+${variantCount} variantes alt-art tipo _P1/_R1).`
  );

  // Códigos BASE del master que NO tenemos en NINGUNA región (hueco real total)
  // y los que no están en US (nuestra región de referencia).
  const missingAll: string[] = [];
  const missingUs: string[] = [];
  for (const code of masterBase) {
    const regs = byCode.get(code);
    if (!regs || regs.size === 0) missingAll.push(code);
    if (!regs || !regs.has("US")) missingUs.push(code);
  }

  const groupBySet = (codes: string[]) => {
    const bySet = new Map<string, string[]>();
    for (const c of codes) {
      const s = setOf(c);
      const arr = bySet.get(s) ?? [];
      arr.push(c);
      bySet.set(s, arr);
    }
    return [...bySet.entries()].sort();
  };

  console.log(
    `\n  🔴 Códigos BASE en DotGG que NO tenemos en NINGUNA región: ${missingAll.length}`
  );
  for (const [s, codes] of groupBySet(missingAll)) {
    console.log(
      `    ${s.padEnd(7)} ${codes.length}: ${codes.sort().slice(0, 14).join(", ")}${codes.length > 14 ? " …" : ""}`
    );
  }

  const usOnlyGap = missingUs.filter((c) => byCode.get(c)); // existe en otra región, no en US
  console.log(
    `\n  🟠 Códigos BASE en DotGG que faltan en US pero SÍ están en otra región: ${usOnlyGap.length}`
  );
  for (const [s, codes] of groupBySet(usOnlyGap)) {
    console.log(`    ${s.padEnd(7)} ${codes.length}: ${codes.sort().slice(0, 14).join(", ")}${codes.length > 14 ? " …" : ""}`);
  }
}

async function main() {
  const cli = parseCli();
  console.log("AUDITORÍA DE COBERTURA — solo lectura, no modifica nada.");

  const { byCode } = await crossRegionAudit(cli);

  if (cli.master && !cli.set) {
    await masterCrossCheck(byCode);
  }

  if (cli.json) {
    const out: any = {};
    for (const [code, regs] of byCode) out[code] = [...regs].sort();
    writeFileSync(cli.json, JSON.stringify(out, null, 2));
    console.log(`\n[json] escrito ${cli.json}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
