/**
 * DRY-RUN (solo lectura): identifica cartas/alternas del sitio oficial
 * (en.onepiece-cardgame.com = 569, asia-en = 556) que NO tenemos en la BD.
 * No escribe nada: solo reporta y genera JSON para revisar.
 *
 *   npx tsx scripts/identify-official-alternates.ts
 */
import "dotenv/config";
import axios from "axios";
import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const CARDLIST = "/cardlist/";

const SOURCES = [
  { tag: "EN", base: "https://en.onepiece-cardgame.com" },
  { tag: "ASIA-EN", base: "https://asia-en.onepiece-cardgame.com" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ScrapedCard = {
  id: string;
  base: string;
  variant: string | null;
  name: string;
  imageUrl: string;
  seriesLabel: string;
};

const parseId = (id: string) => {
  const idx = id.indexOf("_");
  if (idx === -1) return { base: id, variant: null as string | null };
  return { base: id.slice(0, idx), variant: id.slice(idx + 1) };
};

const absImg = (base: string, img: string) => {
  if (!img) return "";
  if (img.startsWith("http")) return img;
  return base + img.replace(/^\.\.\//, "/");
};

async function fetchSeriesList(base: string) {
  const { data } = await axios.get(base + CARDLIST, {
    headers: { "User-Agent": UA },
    maxRedirects: 5,
  });
  const $ = cheerio.load(data);
  const map = new Map<string, string>();
  $("option").each((_, el) => {
    const val = ($(el).attr("value") || "").trim();
    const label = $(el).text().replace(/\s+/g, " ").trim();
    if (/^\d+$/.test(val)) map.set(val, label);
  });
  return Array.from(map.entries()).map(([series, label]) => ({ series, label }));
}

async function fetchCards(
  base: string,
  series: string,
  label: string
): Promise<ScrapedCard[]> {
  const { data } = await axios.get(`${base}${CARDLIST}?series=${series}`, {
    headers: { "User-Agent": UA },
  });
  const $ = cheerio.load(data);
  const out: ScrapedCard[] = [];
  $("dl.modalCol").each((_, el) => {
    const id = ($(el).attr("id") || "").trim();
    if (!id) return;
    const name = $(el).find(".cardName").first().text().trim();
    const img =
      $(el).find(".frontCol img").attr("data-src") ||
      $(el).find(".frontCol img").attr("src") ||
      "";
    const { base: b, variant } = parseId(id);
    out.push({ id, base: b, variant, name, imageUrl: absImg(base, img), seriesLabel: label });
  });
  return out;
}

/** Tokens de variante que ya tenemos para un code (de cualquier región). */
const variantTokens = (
  alias: string | null,
  order: string
): string[] => {
  const toks: string[] = [];
  const a = (alias || "").trim().toLowerCase();
  if (a && a !== "0") toks.push(a);
  const o = (order || "").trim().toLowerCase();
  if (o && o !== "0") {
    toks.push(o);
    if (/^\d+$/.test(o)) toks.push(`p${o}`);
  }
  return toks;
};

async function main() {
  for (const src of SOURCES) {
    console.log(`\n======== ${src.tag} (${src.base}) ========`);
    let seriesList: { series: string; label: string }[] = [];
    try {
      seriesList = await fetchSeriesList(src.base);
    } catch (e) {
      console.error(`  no se pudo listar series:`, (e as Error).message);
      continue;
    }
    console.log(`  series encontradas: ${seriesList.length}`);

    const all: ScrapedCard[] = [];
    for (const s of seriesList) {
      try {
        const cards = await fetchCards(src.base, s.series, s.label);
        all.push(...cards);
        process.stdout.write(`  · ${s.label || s.series}: ${cards.length}\n`);
      } catch (e) {
        console.error(`  x serie ${s.series}:`, (e as Error).message);
      }
      await sleep(250);
    }

    const totalAlternates = all.filter((c) => c.variant).length;
    console.log(
      `  TOTAL cartas: ${all.length} | alternas: ${totalAlternates}`
    );

    // Cargar de la BD todos los codes involucrados
    const bases = Array.from(new Set(all.map((c) => c.base)));
    const dbRows = await prisma.card.findMany({
      where: { code: { in: bases } },
      select: { code: true, alias: true, order: true },
    });
    const byCode = new Map<string, Set<string>>();
    const codesInDb = new Set<string>();
    for (const r of dbRows) {
      codesInDb.add(r.code);
      if (!byCode.has(r.code)) byCode.set(r.code, new Set());
      for (const t of variantTokens(r.alias, r.order))
        byCode.get(r.code)!.add(t);
    }

    const missingAlternates: ScrapedCard[] = [];
    const missingBases: ScrapedCard[] = [];
    for (const c of all) {
      if (!c.variant) {
        if (!codesInDb.has(c.base)) missingBases.push(c);
        continue;
      }
      const have = byCode.get(c.base);
      const v = c.variant.toLowerCase();
      if (!have || !have.has(v)) missingAlternates.push(c);
    }

    console.log(
      `  ⇒ FALTAN alternas: ${missingAlternates.length} | cartas base faltantes: ${missingBases.length}`
    );
    // muestra las primeras
    for (const m of missingAlternates.slice(0, 25)) {
      console.log(`     + ${m.id}  (${m.name})  [${m.seriesLabel}]`);
    }
    if (missingAlternates.length > 25)
      console.log(`     … y ${missingAlternates.length - 25} más`);

    const report = {
      source: src.tag,
      base: src.base,
      totals: {
        cards: all.length,
        alternates: totalAlternates,
        missingAlternates: missingAlternates.length,
        missingBases: missingBases.length,
      },
      missingAlternates,
      missingBases,
    };
    const file = `scripts/identify-${src.tag.toLowerCase()}.json`;
    writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(`  → reporte: ${file}`);
  }
}

main()
  .catch((e) => console.error("ERR:", e))
  .finally(() => prisma.$disconnect());
