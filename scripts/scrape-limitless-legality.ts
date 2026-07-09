#!/usr/bin/env -S npx tsx
//
// Scrapea el BLOQUE (regulation mark) y la legalidad Standard de cada carta desde
// las páginas de set de limitlesstcg (?display=full) y las guarda en la DB.
//
// Uso:
//   npx tsx scripts/scrape-limitless-legality.ts --dry-run   (solo muestra)
//   npx tsx scripts/scrape-limitless-legality.ts             (actualiza la DB)
//   npx tsx scripts/scrape-limitless-legality.ts --only=op16 (un solo set)
//
// Cada .card-profile de la página trae: .card-text-id (código), .regulation-mark
// ("Block N") y los .card-legality-badge (Standard/Extra → legal/not-legal).

import "dotenv/config";
import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SETS = [
  "op01-romance-dawn",
  "op02-paramount-war",
  "op03-pillars-of-strength",
  "op04-kingdoms-of-intrigue",
  "op05-awakening-of-the-new-era",
  "op06-wings-of-the-captain",
  "op07-500-years-in-the-future",
  "op08-two-legends",
  "eb01-memorial-collection",
  "prb01-premium-booster-one-piece-the-best",
  "op09-emperors-in-the-new-world",
  "op10-royal-blood",
  "eb02-anime-25th-collection",
  "op11-a-fist-of-divine-speed",
  "op12-legacy-of-the-master",
  "prb02-one-piece-card-the-best-vol2",
  "op13-carrying-on-his-will",
  "op14-the-azure-seas-seven",
  "eb03-one-piece-heroines-edition",
  "op15-adventure-on-kamis-island",
  "op16-the-time-of-battle",
];

interface Parsed {
  code: string;
  regulationMark: number | null;
  standardLegal: boolean | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scrapeSet(slug: string): Promise<Parsed[]> {
  const url = `https://onepiece.limitlesstcg.com/cards/${slug}?display=full`;
  const { data } = await axios.get<string>(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ohara-legality-scraper)" },
    timeout: 30000,
  });
  const $ = cheerio.load(data);
  const out: Parsed[] = [];

  $(".card-profile").each((_, el) => {
    const $el = $(el);
    const code = $el.find(".card-text-id").first().text().trim();
    if (!code) return;

    // Bloque: "Block 5" → 5
    const markText = $el.find(".regulation-mark").first().text().trim();
    const markMatch = markText.match(/Block\s+(\d+)/i);
    const regulationMark = markMatch ? parseInt(markMatch[1], 10) : null;

    // Legalidad Standard: badge cuyo primer <div> dice "Standard".
    let standardLegal: boolean | null = null;
    $el.find(".card-legality-badge").each((__, badge) => {
      const $badge = $(badge);
      const label = $badge.children("div").first().text().trim();
      if (/^Standard$/i.test(label)) {
        const statusText = $badge.children("div").last().text().trim().toLowerCase();
        standardLegal = statusText === "legal";
      }
    });

    out.push({ code, regulationMark, standardLegal });
  });

  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const onlyArg = args.find((a) => a.startsWith("--only="))?.split("=")[1];
  const sets = onlyArg ? SETS.filter((s) => s.startsWith(onlyArg)) : SETS;

  console.log(`${dryRun ? "[DRY-RUN] " : ""}Scrapeando ${sets.length} set(s)…\n`);

  let totalCards = 0;
  let updated = 0;
  let notFound = 0;

  for (const slug of sets) {
    let parsed: Parsed[];
    try {
      parsed = await scrapeSet(slug);
    } catch (e) {
      console.log(`  ❌ ${slug}: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    const blocks = new Set(parsed.map((p) => p.regulationMark));
    console.log(
      `  ${slug}: ${parsed.length} cartas · bloque(s) ${Array.from(blocks).join(",")} · ${
        parsed.filter((p) => p.standardLegal).length
      } legal Standard`
    );
    totalCards += parsed.length;

    if (dryRun) continue;

    // Actualizar TODAS las filas con ese código (todas las regiones/alternativas).
    for (const p of parsed) {
      const res = await prisma.card.updateMany({
        where: { code: p.code },
        data: { regulationMark: p.regulationMark, standardLegal: p.standardLegal },
      });
      if (res.count > 0) updated += res.count;
      else notFound += 1;
    }
    await sleep(700); // cortesía entre requests
  }

  console.log(
    `\n${dryRun ? "[DRY-RUN] " : ""}Total: ${totalCards} cartas parseadas` +
      (dryRun ? "" : ` · ${updated} filas actualizadas · ${notFound} códigos sin fila`)
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
