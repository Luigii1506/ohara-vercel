import axios from "axios";
import * as cheerio from "cheerio";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { officialVariantTokens, normalizeOfficialVariantToken } from "@/lib/cards/officialVariant";

/**
 * Sincronización con los sitios OFICIALES (plataforma Bandai): en/asia-en/jp/fr.
 * Escanea una región, compara contra la BD y arma una cola de revisión
 * (OfficialSyncItem). Al "Aceptar" un item, sube la carta (BD + R2).
 */

export const OFFICIAL_REGIONS: Record<
  string,
  { baseUrl: string; region: string; language: string; label: string }
> = {
  EN: { baseUrl: "https://en.onepiece-cardgame.com", region: "EN", language: "en", label: "Inglés (mundial)" },
  "ASIA-EN": { baseUrl: "https://asia-en.onepiece-cardgame.com", region: "ASIA-EN", language: "en", label: "Inglés (Asia)" },
  JP: { baseUrl: "https://www.onepiece-cardgame.com", region: "JP", language: "ja", label: "Japonés" },
  FR: { baseUrl: "https://fr.onepiece-cardgame.com", region: "FR", language: "fr", label: "Francés" },
};

const CARDLIST_PATH = "/cardlist/";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const IMAGE_SIZES = [
  { suffix: "-tiny", width: 20, height: 28, quality: 40 },
  { suffix: "-xs", width: 100, height: 140, quality: 60 },
  { suffix: "-thumb", width: 200, height: 280, quality: 70 },
  { suffix: "-small", width: 300, height: 420, quality: 75 },
  { suffix: "-medium", width: 600, height: 840, quality: 80 },
  { suffix: "-large", width: 800, height: 1120, quality: 85 },
  { suffix: "", width: null as number | null, height: null as number | null, quality: 90 },
];

const RARITY_MAP: Record<string, string> = {
  L: "Leader", C: "Common", UC: "Uncommon", R: "Rare",
  SR: "Super Rare", SEC: "Secret Rare", P: "Promo", SP: "Special",
};
const CATEGORY_MAP: Record<string, string> = {
  LEADER: "Leader", CHARACTER: "Character", EVENT: "Event", STAGE: "Stage", DON: "DON",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type OfficialScrapedCard = {
  cardId: string;
  code: string;
  variant: string | null;
  isAlternate: boolean;
  name: string;
  imageUrl: string;
  setCode: string;
  seriesLabel: string;
  rarity: string | null;
  category: string | null;
  cost: string | null;
  life: string | null;
  power: string | null;
  counter: string | null;
  colors: string[];
  types: string[];
  text: string | null;
  trigger: string | null;
};

const abs = (base: string, path: string) =>
  !path ? "" : path.startsWith("http") ? path : base + path.replace(/^\.\.\//, "/");

const norm = (v: string, label: string) =>
  !v ? "" : !label ? v.trim() : v.replace(label, "").replace(/\s+/g, " ").trim();
const numOf = (v: string) => v.replace(/,/g, "").match(/\d+/)?.[0] ?? null;

export async function fetchOfficialSeries(baseUrl: string) {
  const { data } = await axios.get(baseUrl + CARDLIST_PATH, {
    headers: { "User-Agent": UA },
    maxRedirects: 5,
  });
  const $ = cheerio.load(data);
  const map = new Map<string, { series: string; setCode: string; label: string }>();
  $("option").each((_, el) => {
    const series = ($(el).attr("value") || "").trim();
    if (!/^\d+$/.test(series)) return;
    const label = $(el).text().replace(/\s+/g, " ").trim();
    const m = label.match(/\[([^\]]+)\]/);
    map.set(series, { series, setCode: m ? m[1].trim() : label, label });
  });
  return Array.from(map.values());
}

export async function fetchOfficialCards(
  baseUrl: string,
  series: string,
  seriesLabel: string
): Promise<OfficialScrapedCard[]> {
  const { data } = await axios.get(`${baseUrl}${CARDLIST_PATH}?series=${series}`, {
    headers: { "User-Agent": UA },
  });
  const $ = cheerio.load(data);
  const out: OfficialScrapedCard[] = [];
  $("dl.modalCol").each((_, el) => {
    const $m = $(el);
    const id = ($m.attr("id") || "").trim();
    if (!id) return;
    const [code, variant] = id.split("_");
    const imgPath = $m.find(".frontCol img").attr("data-src") || $m.find(".frontCol img").attr("src") || "";
    const infoSpans = $m.find(".infoCol span").map((_i, s) => $(s).text().trim()).get();
    const rarityRaw = infoSpans[1] || "";
    const categoryRaw = infoSpans[2] || "";
    const costLabel = $m.find(".cost h3").text().trim();
    const costRaw = norm($m.find(".cost").text(), costLabel);
    const costNum = numOf(costRaw);
    const isLife = costLabel.toUpperCase().includes("LIFE") || costLabel.toUpperCase().includes("VIE");
    const powerNum = numOf(norm($m.find(".power").text(), $m.find(".power h3").text().trim()));
    const counterNum = numOf(norm($m.find(".counter").text(), $m.find(".counter h3").text().trim()));
    const colorRaw = norm($m.find(".color").text(), $m.find(".color h3").text().trim());
    const featureRaw = norm($m.find(".feature").text(), $m.find(".feature h3").text().trim());
    const textRaw = norm($m.find(".text").text(), $m.find(".text h3").text().trim());
    const triggerRaw = norm($m.find(".trigger").text(), $m.find(".trigger h3").text().trim());
    out.push({
      cardId: id,
      code,
      variant: variant || null,
      isAlternate: Boolean(variant),
      name: $m.find(".cardName").text().trim(),
      imageUrl: abs(baseUrl, imgPath),
      setCode: code.split("-")[0],
      seriesLabel,
      rarity: rarityRaw ? RARITY_MAP[rarityRaw.toUpperCase()] || rarityRaw : null,
      category: CATEGORY_MAP[categoryRaw.toUpperCase()] || categoryRaw || "Character",
      cost: !isLife && costNum ? `${costNum} Cost` : null,
      life: isLife && costNum ? `${costNum} Life` : null,
      power: powerNum ? `${powerNum} Power` : null,
      counter: counterNum ? `+${counterNum} Counter` : null,
      colors: colorRaw.split(/[/／]/).map((c) => c.trim().toLowerCase()).filter(Boolean),
      types: featureRaw.split("/").map((t) => t.trim()).filter(Boolean),
      text: textRaw ? textRaw.replace(/\s+/g, " ").trim() : null,
      trigger: triggerRaw ? triggerRaw.replace(/\s+/g, " ").trim() : null,
    });
  });
  return out;
}

export type ScanResult = { region: string; scanned: number; missing: number; created: number };

/** Escanea una región (o un set) y llena la cola de PENDIENTES con lo faltante. */
export async function scanOfficialRegion(
  regionKey: string,
  opts: { setFilter?: string[] } = {}
): Promise<ScanResult> {
  const cfg = OFFICIAL_REGIONS[regionKey.toUpperCase()];
  if (!cfg) throw new Error(`Región no soportada: ${regionKey}`);

  let series = await fetchOfficialSeries(cfg.baseUrl);
  if (opts.setFilter?.length) {
    const wanted = new Set(opts.setFilter.map((s) => s.toUpperCase()));
    series = series.filter(
      (s) => wanted.has(s.setCode.toUpperCase()) || wanted.has(s.series)
    );
  }

  const all: OfficialScrapedCard[] = [];
  for (const s of series) {
    try {
      all.push(...(await fetchOfficialCards(cfg.baseUrl, s.series, s.label)));
    } catch {
      // sigue con las demás series
    }
    await sleep(200);
  }

  // Comparar contra BD
  const bases = Array.from(new Set(all.map((c) => c.code)));
  const dbRows = await prisma.card.findMany({
    where: { code: { in: bases } },
    select: { code: true, officialVariantCode: true, region: true },
  });
  const tokensByCode = new Map<string, Set<string>>();
  const codesInDb = new Set<string>();
  const codeRegions = new Map<string, Set<string>>();
  for (const r of dbRows) {
    codesInDb.add(r.code);
    if (!tokensByCode.has(r.code)) tokensByCode.set(r.code, new Set());
    officialVariantTokens(r.officialVariantCode).forEach((t) =>
      tokensByCode.get(r.code)!.add(t)
    );
    if (!codeRegions.has(r.code)) codeRegions.set(r.code, new Set());
    if (r.region) codeRegions.get(r.code)!.add(r.region);
  }

  const missing: OfficialScrapedCard[] = [];
  for (const c of all) {
    if (!c.variant) {
      if (!codesInDb.has(c.code)) missing.push(c);
      continue;
    }
    const have = tokensByCode.get(c.code);
    if (!have || !have.has(c.variant.toLowerCase())) missing.push(c);
  }

  // Upsert como PENDING (sin pisar decisiones ya tomadas)
  let created = 0;
  for (const c of missing) {
    const existing = await prisma.officialSyncItem.findUnique({
      where: { region_cardId: { region: cfg.region, cardId: c.cardId } },
      select: { id: true, decisionStatus: true },
    });
    const exclusive = !(codeRegions.get(c.code)?.has("US") ?? false);
    if (existing) {
      if (existing.decisionStatus !== "PENDING") continue; // respeta APPLIED/IGNORED
      await prisma.officialSyncItem.update({
        where: { id: existing.id },
        data: { name: c.name, imageUrl: c.imageUrl, setCode: c.setCode, seriesLabel: c.seriesLabel, isAlternate: c.isAlternate, exclusive, payload: c as object },
      });
    } else {
      await prisma.officialSyncItem.create({
        data: {
          region: cfg.region, source: cfg.region, cardId: c.cardId, code: c.code,
          variant: c.variant, name: c.name, setCode: c.setCode, seriesLabel: c.seriesLabel,
          imageUrl: c.imageUrl, isAlternate: c.isAlternate, exclusive, payload: c as object,
        },
      });
      created += 1;
    }
  }

  return { region: cfg.region, scanned: all.length, missing: missing.length, created };
}

// ------------------ APLICAR (subir a BD + R2) ------------------

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME || "ohara";
const R2_PUBLIC = process.env.R2_PUBLIC_URL || "";

const imageBase = (region: string, cardId: string) =>
  `official-${`${region}-${cardId}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

async function uploadVariants(fileBuffer: Buffer, base: string) {
  for (const cfg of IMAGE_SIZES) {
    let t = sharp(fileBuffer);
    if (cfg.width || cfg.height) {
      t = t.resize({ width: cfg.width || undefined, height: cfg.height || undefined, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }
    const buf = await t.webp({ quality: cfg.quality, effort: 6 }).toBuffer();
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `cards/${base}${cfg.suffix}.webp`,
      Body: buf,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }));
  }
}

async function ensureSet(setCode: string): Promise<number | null> {
  if (!setCode) return null;
  const existing = await prisma.set.findFirst({ where: { code: setCode }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.set.create({
    data: {
      image: "",
      title: setCode,
      code: setCode,
      releaseDate: new Date(0),
      isOpen: false,
    } as never,
    select: { id: true },
  });
  return created.id;
}

/** Deriva la URL de la imagen BASE a partir de la de una alterna (quita _pN). */
const baseImageUrlFrom = (altUrl: string, variant: string | null) => {
  if (!variant) return altUrl;
  return altUrl.replace(
    new RegExp(`_${variant}(?=\\.[a-z0-9]+(\\?|$))`, "i"),
    ""
  );
};

/** Carta BASE (no-alterna) de un código en una región (baseCardId = null). */
async function findRegionBase(code: string, region: string) {
  return prisma.card.findFirst({
    where: { code, region, baseCardId: null },
    select: { id: true },
  });
}

type PersistArgs = {
  region: string;
  language: string | null;
  code: string;
  setCode: string;
  cardId: string; // id scrapeado (key de imagen + CardSource)
  variant: string | null;
  isAlternate: boolean;
  baseCardId: number | null;
  imageUrl: string;
  name: string;
  payload: OfficialScrapedCard | null;
  refererBase: string;
};

/** Descarga imagen → variantes a R2 → crea Card (+CardSet+CardSource). */
async function persistCard(a: PersistArgs): Promise<number> {
  const keyBase = imageBase(a.region, a.cardId);
  const resp = await axios.get<ArrayBuffer>(a.imageUrl, {
    responseType: "arraybuffer",
    headers: { "User-Agent": UA, Referer: a.refererBase },
  });
  await uploadVariants(Buffer.from(resp.data), keyBase);
  const src = `${R2_PUBLIC.replace(/\/$/, "")}/cards/${keyBase}.webp`;
  const setId = await ensureSet(a.setCode || a.code.split("-")[0]);
  const p = a.payload;
  const created = await prisma.card.create({
    data: {
      src,
      name: a.name || a.code,
      code: a.code,
      setCode: a.setCode || a.code.split("-")[0],
      category: p?.category || "Character",
      rarity: p?.rarity ?? null,
      cost: p?.cost ?? null,
      life: p?.life ?? null,
      power: p?.power ?? null,
      counter: p?.counter ?? null,
      triggerCard: p?.trigger ?? null,
      isFirstEdition: !a.isAlternate,
      alias: "",
      order: a.variant ? a.variant.replace(/^p/i, "") : "0",
      officialVariantCode: a.variant ? normalizeOfficialVariantToken(a.variant) : null,
      alternateArt: a.isAlternate ? "Alternate Art" : null,
      baseCardId: a.baseCardId,
      region: a.region,
      language: a.language,
    } as never,
    select: { id: true },
  });
  if (setId) {
    await prisma.cardSet
      .create({ data: { cardId: created.id, setId } })
      .catch(() => {});
  }
  await prisma.cardSource
    .create({
      data: {
        source: a.region,
        sourceId: a.cardId,
        sourceImageUrl: a.imageUrl,
        cardId: created.id,
      } as never,
    })
    .catch(() => {});
  return created.id;
}

/**
 * Aplica un item aceptado. Las alternas se ENLAZAN a la carta base de SU MISMA
 * región (baseCardId); si esa base no existe en la región, se crea primero.
 */
export async function applyOfficialItem(
  itemId: number
): Promise<{ cardId: number }> {
  const item = await prisma.officialSyncItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Item no encontrado");
  if (item.decisionStatus === "APPLIED" && item.appliedCardId)
    return { cardId: item.appliedCardId };

  const p = (item.payload as unknown as OfficialScrapedCard) || null;
  const cfg = OFFICIAL_REGIONS[item.region.toUpperCase()];
  const language = cfg?.language ?? null;
  const refererBase = cfg?.baseUrl ?? "";
  const setCode = item.setCode || item.code.split("-")[0];

  const markApplied = (cardId: number) =>
    prisma.officialSyncItem.update({
      where: { id: item.id },
      data: { decisionStatus: "APPLIED", appliedCardId: cardId },
    });

  // Carta BASE: si ya existe en la región se reusa; si no, se crea.
  if (!item.isAlternate) {
    const existing = await findRegionBase(item.code, item.region);
    if (existing) {
      await markApplied(existing.id);
      return { cardId: existing.id };
    }
    const id = await persistCard({
      region: item.region, language, code: item.code, setCode,
      cardId: item.code, variant: null, isAlternate: false, baseCardId: null,
      imageUrl: item.imageUrl, name: item.name || item.code, payload: p,
      refererBase,
    });
    await markApplied(id);
    return { cardId: id };
  }

  // ALTERNA: asegurar la base de la misma región (crearla si falta), luego enlazar.
  let base = await findRegionBase(item.code, item.region);
  if (!base) {
    const baseId = await persistCard({
      region: item.region, language, code: item.code, setCode,
      cardId: item.code, variant: null, isAlternate: false, baseCardId: null,
      imageUrl: baseImageUrlFrom(item.imageUrl, item.variant),
      name: item.name || item.code, payload: p, refererBase,
    });
    base = { id: baseId };
  }
  const altId = await persistCard({
    region: item.region, language, code: item.code, setCode,
    cardId: item.cardId, variant: item.variant, isAlternate: true,
    baseCardId: base.id, imageUrl: item.imageUrl,
    name: item.name || item.code, payload: p, refererBase,
  });
  await markApplied(altId);
  return { cardId: altId };
}

export async function ignoreOfficialItem(itemId: number) {
  await prisma.officialSyncItem.update({
    where: { id: itemId },
    data: { decisionStatus: "IGNORED" },
  });
}
