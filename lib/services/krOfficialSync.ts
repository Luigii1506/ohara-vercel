// Lógica compartida de sincronización con el sitio oficial de Corea
// (onepiece-cardgame.kr) — usada tanto por el cron (app/api/cron/scrape-kr)
// como por el wrapper CLI (scripts/scrape-onepiece-cardlist-kr.ts).

import axios from "axios";
import * as cheerio from "cheerio";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

type SeriesEntry = {
  series: string;
  setCode: string;
};

export type ScrapedCard = {
  id: string;
  baseCode: string;
  isAlternate: boolean;
  variantKey: string | null;
  originTitle: string | null;
  sourceId: string | null;
  name: string;
  rarity: string | null;
  category: string;
  cost: string | null;
  power: string | null;
  attribute: string | null;
  counter: string | null;
  life: string | null;
  colors: string[];
  types: string[];
  text: string | null;
  trigger: string | null;
  imageUrl: string;
  setCode: string;
  order: string;
  alias: string;
};

export type ScriptOptions = {
  dryRun: boolean;
  updateExisting: boolean;
  limit: number | null;
  region: string;
  language: string;
  markExclusive: boolean;
  seriesFilter: string[] | null;
  setFilter: string[] | null;
  emptySetCode: boolean;
  onlyIds: string[] | null;
  linkByCardSetCode: boolean;
  forceAlternates: boolean;
  overrideSetCode: boolean;
  backfillCardSource: boolean;
  cleanupDuplicates: boolean;
};

export const DEFAULT_KR_SYNC_OPTIONS: ScriptOptions = {
  dryRun: false,
  updateExisting: false,
  limit: null,
  region: "KR",
  language: "ko",
  markExclusive: false,
  seriesFilter: null,
  setFilter: null,
  emptySetCode: false,
  onlyIds: null,
  linkByCardSetCode: false,
  forceAlternates: false,
  overrideSetCode: false,
  backfillCardSource: false,
  cleanupDuplicates: true,
};

const BASE_URL = "https://onepiece-cardgame.kr";
const CARDLIST_PATH = "/cardlist.do";

const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: "-tiny" },
  xs: { width: 100, height: 140, quality: 60, suffix: "-xs" },
  thumb: { width: 200, height: 280, quality: 70, suffix: "-thumb" },
  small: { width: 300, height: 420, quality: 75, suffix: "-small" },
  medium: { width: 600, height: 840, quality: 80, suffix: "-medium" },
  large: { width: 800, height: 1120, quality: 85, suffix: "-large" },
  original: { width: null, height: null, quality: 90, suffix: "" },
} as const;

const TRIM_WHITESPACE = true;

const SERIES_LIST: SeriesEntry[] = [
  { series: "[OPK-01] 부스터 팩 ROMANCE DAWN", setCode: "OP01" },
  { series: "[OPK-02] 부스터 팩 정상결전", setCode: "OP02" },
  { series: "[OPK-03] 부스터 팩 강대한 적", setCode: "OP03" },
  { series: "[OPK-04] 부스터 팩 모략의 왕국", setCode: "OP04" },
  { series: "[OPK-05] 부스터 팩 신시대의 주역", setCode: "OP05" },
  { series: "[OPK-06] 부스터 팩 쌍벽의 패자", setCode: "OP06" },
  { series: "[OPK-07] 부스터 팩 500년 후의 미래", setCode: "OP07" },
  { series: "[OPK-08] 부스터 팩 두 전설", setCode: "OP08" },
  { series: "[OPK-09] 부스터 팩 새로운 황제", setCode: "OP09" },
  { series: "[OPK-10] 부스터 팩 왕족의 혈통", setCode: "OP10" },
  { series: "[STK-01] 스타트 덱 밀짚모자 일당", setCode: "ST01" },
  { series: "[STK-02] 스타트 덱 최악의 세대", setCode: "ST02" },
  { series: "[STK-03] 스타트 덱 왕의 부하 칠무해", setCode: "ST03" },
  { series: "[STK-04] 스타트 덱 백수 해적단", setCode: "ST04" },
  { series: "[STK-05] 스타트 덱 ONE PIECE FILM edition", setCode: "ST05" },
  { series: "[STK-06] 스타트 덱 해군", setCode: "ST06" },
  { series: "[STK-07] 스타트 덱 빅 맘 해적단", setCode: "ST07" },
  { series: "[STK-08] 스타트 덱 Side 몽키 D. 루피", setCode: "ST08" },
  { series: "[STK-09] 스타트 덱 Side 야마토", setCode: "ST09" },
  { series: '[STK-10] 얼티밋 덱 "삼선장" 집결', setCode: "ST10" },
  { series: "[STK-11] 스타트 덱 Side 우타", setCode: "ST11" },
  { series: "[STK-12] 스타트 덱 조로 & 상디", setCode: "ST12" },
  { series: "[STK-13] 스타트 덱 3형제의 유대", setCode: "ST13" },
  { series: "[STK-14] 스타트 덱 3D2Y", setCode: "ST14" },
  { series: "[STK-21] 스타트 덱 기어5", setCode: "ST21" },
  { series: "[EBK-01] 엑스트라 부스터 팩 메모리얼 컬렉션", setCode: "EB01" },
  { series: "【프로모션】", setCode: "P" },
];

const RARITY_MAP: Record<string, string> = {
  L: "Leader",
  C: "Common",
  UC: "Uncommon",
  R: "Rare",
  SR: "Super Rare",
  SEC: "Secret Rare",
  P: "Promo",
};

const CATEGORY_MAP: Record<string, string> = {
  리더: "Leader",
  캐릭터: "Character",
  이벤트: "Event",
  스테이지: "Stage",
  DON: "DON",
};

const ATTRIBUTE_MAP: Record<string, string> = {
  참격: "Slash",
  타격: "Strike",
  사격: "Ranged",
  특수: "Special",
  지혜: "Wisdom",
};

const COLOR_MAP: Record<string, string> = {
  적색: "red",
  청색: "blue",
  녹색: "green",
  자색: "purple",
  흑색: "black",
  황색: "yellow",
  다색: "multi",
};

const PREFIXES: Record<string, number> = {
  OP: 0,
  EB: 1,
  ST: 2,
  P: 3,
  PRB: 4,
};

const digitsRegex = /\d+/g;

const getPrefixIndex = (code: string, category?: string | null) => {
  if (category === "DON") return 5;
  const upper = code?.toUpperCase() ?? "";
  const prefix = upper.slice(0, 3).replace(/[^A-Z]/g, "");
  if (prefix in PREFIXES) return PREFIXES[prefix];
  if (upper.startsWith("PRB")) return PREFIXES.PRB;
  return PREFIXES[upper.slice(0, 2)] ?? 6;
};

const normalizeCodeSegment = (code: string) =>
  (code ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .replace(digitsRegex, (match) => match.padStart(4, "0"));

const normalizeAlternateOrder = (order?: string | null) => {
  if (!order) return "zzzz";
  const trimmed = order.trim();
  if (!trimmed) return "zzzz";
  const numeric = trimmed.match(/^\d+/);
  if (numeric) {
    return numeric[0].padStart(4, "0");
  }
  return trimmed.padStart(4, "0");
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
};

const buildCollectionOrder = (card: {
  id: number;
  code: string;
  category?: string | null;
  baseCardId?: number | null;
  order?: string | null;
}) => {
  const prefixIndex = getPrefixIndex(card.code, card.category);
  const normalizedCode = normalizeCodeSegment(card.code);
  const isBaseCard = card.baseCardId === null || card.baseCardId === undefined;
  const suffix = isBaseCard
    ? "00"
    : `10_${normalizeAlternateOrder(card.order)}_${String(
        card.baseCardId ?? ""
      ).padStart(6, "0")}`;

  return `${prefixIndex
    .toString()
    .padStart(2, "0")}_${normalizedCode}_${suffix}_${card.id
    .toString()
    .padStart(6, "0")}`;
};

const unresolvedAlternates: ScrapedCard[] = [];
let createdCount = 0;
let skippedCount = 0;
// Cartas cuya imagen en el sitio cambió respecto a la que tenemos guardada
// (CardSource.sourceImageUrl) — no se sobreescribe solo (podría pisar una
// edición manual), se deja para revisión.
const changedSourceImages: Array<{ id: string; oldUrl: string; newUrl: string }> = [];
const missingUsBaseCards: Array<{ id: string; code: string; set: string }> = [];
const missingUsBaseLookup = new Set<string>();
const missingUsBasePath = "scripts/missing-us-base-kr.json";
const missingImages: Array<{ id: string; url: string }> = [];
const missingImagesLookup = new Set<string>();
const networkErrors: Array<{ id: string; url: string; code?: string }> = [];
const missingImagesPath = "scripts/missing-images-kr.json";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withPrismaRetry = async <T>(
  operation: () => Promise<T>,
  retries = 3
): Promise<T> => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const code = error?.code;
      if (code !== "P1017" || attempt === retries) {
        throw error;
      }
      console.log(
        `[retry][prisma] attempt ${attempt}/${retries} (code ${code})`
      );
      await sleep(500 * attempt);
    }
  }
  throw lastError;
};

const loadExistingMissingUsBaseCards = async () => {
  try {
    const raw = await fs.readFile(missingUsBasePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.missingUsBaseCards)) {
      return parsed.missingUsBaseCards as Array<{
        id: string;
        code: string;
        set: string;
      }>;
    }
    return [];
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const addMissingImage = (entry: { id: string; url: string }) => {
  const key = `${entry.id}::${entry.url}`;
  if (missingImagesLookup.has(key)) return;
  missingImagesLookup.add(key);
  missingImages.push(entry);
};

const loadExistingMissingImages = async () => {
  try {
    const raw = await fs.readFile(missingImagesPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.missingImages)) {
      for (const entry of parsed.missingImages) {
        if (!entry?.id || !entry?.url) continue;
        addMissingImage({ id: entry.id, url: entry.url });
      }
    }
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
};

export const createS3Client = () =>
  new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

const sanitizeImageKey = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const buildImageKey = (cardId: string, region: string) => {
  const base = sanitizeImageKey(cardId);
  const regionKey = sanitizeImageKey(region);
  return `${base}-${regionKey}`;
};

const resolveUniqueImageKey = async (
  s3Client: S3Client,
  bucketName: string,
  baseKey: string
) => {
  const exists = async (key: string) => {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: `cards/${key}.webp`,
        })
      );
      return true;
    } catch (error: any) {
      const status = error?.$metadata?.httpStatusCode;
      if (status === 404) return false;
      return false;
    }
  };

  if (!(await exists(baseKey))) return baseKey;

  for (let i = 1; i <= 10; i += 1) {
    const candidate = `${baseKey}-v${i}`;
    if (!(await exists(candidate))) return candidate;
  }

  return `${baseKey}-v${Date.now().toString(36)}`;
};

const downloadImage = async (url: string): Promise<Buffer> => {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 20000,
    validateStatus: (status) => status >= 200 && status < 300,
  });
  return Buffer.from(response.data);
};

const downloadImageWithRetry = async (url: string, retries = 3) => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await downloadImage(url);
    } catch (error: any) {
      lastError = error;
      const code = error?.code;
      const status = error?.response?.status;
      const message = typeof error?.message === "string" ? error.message : "";
      const isRetryable =
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "ECONNABORTED" ||
        code === "EAI_AGAIN" ||
        code === "ERR_BAD_RESPONSE" ||
        message.toLowerCase().includes("stream has been aborted") ||
        message.toLowerCase().includes("timeout") ||
        status === 429 ||
        (typeof status === "number" && status >= 500);
      if (!isRetryable || attempt === retries) {
        throw error;
      }
      const delay = 500 * attempt;
      console.log(
        `[retry] ${url} attempt ${attempt}/${retries} (code=${
          code ?? "n/a"
        } status=${status ?? "n/a"})`
      );
      await sleep(delay);
    }
  }
  throw lastError;
};

const uploadImageVariants = async (
  s3Client: S3Client,
  filename: string,
  buffer: Buffer,
  bucketName: string,
  publicUrl: string
) => {
  let sourceBuffer = buffer;
  if (TRIM_WHITESPACE) {
    try {
      sourceBuffer = await sharp(buffer).trim({ threshold: 8 }).toBuffer();
    } catch {
      sourceBuffer = buffer;
    }
  }

  console.log(`[upload] Uploading image variants for ${filename}`);

  for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
    const r2Key = `cards/${filename}${config.suffix}.webp`;
    let transformer = sharp(sourceBuffer);

    if (config.width || config.height) {
      transformer = transformer.resize({
        width: config.width || undefined,
        height: config.height || undefined,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }

    const transformed = await transformer
      .webp({ quality: config.quality, effort: 6 })
      .toBuffer();

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
      Body: transformed,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    });

    await s3Client.send(command);
    console.log(
      `  [upload:${sizeName}] ${r2Key} (${Math.round(
        transformed.length / 1024
      )}KB)`
    );
  }

  console.log(`[upload] All variants uploaded for ${filename}.`);
  return `${publicUrl}/cards/${filename}.webp`;
};

export const uploadCardImage = async (
  card: Pick<ScrapedCard, "id" | "imageUrl">,
  options: Pick<ScriptOptions, "region">,
  s3Client: S3Client,
  bucketName: string,
  publicUrl: string
) => {
  const baseKey = buildImageKey(card.id, options.region);
  const imageKey = await resolveUniqueImageKey(s3Client, bucketName, baseKey);
  const buffer = await downloadImageWithRetry(card.imageUrl, 3);
  const src = await uploadImageVariants(
    s3Client,
    imageKey,
    buffer,
    bucketName,
    publicUrl
  );
  return { src, imageKey };
};

const normalizeLabelValue = (value: string, label: string): string => {
  if (!value) return "";
  if (!label) return value.trim();
  return value.replace(label, "").replace(/\s+/g, " ").trim();
};

const parseNumericValue = (value: string): string | null => {
  const match = value.replace(/,/g, "").match(/\d+/);
  return match ? match[0] : null;
};

const buildAbsoluteUrl = (path: string): string => {
  if (!path) return "";
  try {
    return new URL(path, BASE_URL).href;
  } catch {
    return path;
  }
};

const extractVariantKey = (cardNumber: string, cardImg: string): string | null => {
  if (!cardImg) return null;
  let filename = "";
  try {
    const url = new URL(cardImg);
    filename = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  } catch {
    filename = decodeURIComponent(cardImg.split("/").pop() ?? "");
  }
  filename = filename.replace(/\?.*$/, "");
  if (!filename) return null;
  const upper = filename.toUpperCase();
  const target = cardNumber.toUpperCase();
  const idx = upper.indexOf(target);
  if (idx === -1) return null;
  let suffix = filename.slice(idx + target.length);
  suffix = suffix.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  suffix = suffix.replace(/^[_-]+/, "");
  if (!suffix) return null;
  return suffix;
};

const parseCardItem = (
  block: string,
  options: ScriptOptions
): ScrapedCard | null => {
  const $ = cheerio.load(`<div>${block}</div>`);
  const cardNumberRaw = $(".cardNumber").text().trim();
  if (!cardNumberRaw) return null;

  const imagePath = $(".image").attr("src") || "";
  const imageUrl = buildAbsoluteUrl(imagePath);

  const [baseCode, variantSuffix] = cardNumberRaw.split("_");
  const imageVariantKey = extractVariantKey(baseCode, imagePath);
  let variantKey = variantSuffix || imageVariantKey || null;
  if (options.forceAlternates && !variantKey) {
    variantKey = `ALT${hashString(`${baseCode}-${imagePath}`)}`;
  }
  const isAlternate = options.forceAlternates ? true : Boolean(variantKey);

  const name = $(".cardName").text().trim();
  const rarityRaw = $(".rarity").text().trim();
  const categoryRaw = $(".cardType").text().trim();
  const category = CATEGORY_MAP[categoryRaw] || categoryRaw || "Character";
  const rarity = rarityRaw
    ? RARITY_MAP[rarityRaw.toUpperCase()] || rarityRaw
    : null;

  const lifeValue = $(".life").text().trim();
  const lifeNumber = parseNumericValue(lifeValue);
  const life =
    category === "Leader" && lifeNumber ? `${lifeNumber} Life` : null;
  const cost =
    category !== "Leader" && lifeNumber ? `${lifeNumber} Cost` : null;

  const powerValue = $(".power").text().trim();
  const powerNumber = parseNumericValue(powerValue);
  const power = powerNumber ? `${powerNumber} Power` : null;

  const counterValue = $(".cardCounter").text().trim();
  const counterNumber = parseNumericValue(counterValue);
  const counter = counterNumber ? `+${counterNumber} Counter` : null;

  const attributeRaw = $(".cardAttr").text().trim();
  const attribute = ATTRIBUTE_MAP[attributeRaw] || null;

  const colorValueRaw = $(".cardColor").text().trim();
  const colors = colorValueRaw
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((color) => COLOR_MAP[color] || color.toLowerCase())
    .filter(Boolean);

  const typesValue = $(".cardPoint").text().trim();
  const types = typesValue
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);

  const textValue = $(".cardText").text().trim();
  const text = textValue ? textValue.replace(/\s+/g, " ").trim() : null;

  const triggerValue = $(".cardTrigger").text().trim();
  const trigger = triggerValue
    ? triggerValue.replace(/\s+/g, " ").trim()
    : null;

  const setCode = options.emptySetCode ? "" : baseCode.split("-")[0];
  const order = isAlternate && variantKey ? variantKey.replace("p", "") : "0";
  const alias = isAlternate && variantKey ? variantKey : "0";
  const id = isAlternate && variantKey ? `${baseCode}_${variantKey}` : baseCode;

  const originTitleRaw = $(".cardGet").text();
  const originTitle = originTitleRaw
    ? originTitleRaw.replace(/\s+/g, " ").trim()
    : null;
  if (originTitle) {
    console.log(`[offer][detail] ${baseCode} -> ${originTitle}`);
  }

  return {
    id,
    baseCode,
    isAlternate,
    variantKey,
    originTitle,
    sourceId: variantKey ? `${baseCode}_${variantKey}` : baseCode,
    name,
    rarity,
    category,
    cost,
    power,
    attribute,
    counter,
    life,
    colors,
    types,
    text,
    trigger,
    imageUrl,
    setCode,
    order,
    alias,
  };
};

const fetchSeriesCards = async (
  series: string,
  options: ScriptOptions
): Promise<ScrapedCard[]> => {
  const buildUrl = (page: number) => {
    const url = new URL(CARDLIST_PATH, BASE_URL);
    url.searchParams.set("series", series);
    url.searchParams.set("categories", "");
    url.searchParams.set("colors", "");
    url.searchParams.set("illustrations", "");
    url.searchParams.set("freewords", "");
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", "20");
    return url.toString();
  };

  const cards: ScrapedCard[] = [];
  const seen = new Set<string>();
  let page = 0;
  let maxPage = 0;

  while (page <= maxPage) {
    const response = await axios.get(buildUrl(page));
    const html = response.data as string;
    if (page === 0) {
      const pageMatches = Array.from(html.matchAll(/page=(\d+)/g)).map(
        (match) => Number(match[1])
      );
      if (pageMatches.length) {
        maxPage = Math.max(...pageMatches);
      }
    }

    const blocks = html.match(/<button class="item">[\s\S]*?<\/button>/g) ?? [];
    for (const block of blocks) {
      const parsed = parseCardItem(block, options);
      if (!parsed) continue;
      if (seen.has(parsed.id)) continue;
      seen.add(parsed.id);
      cards.push(parsed);
    }
    page += 1;
  }

  return cards;
};

// Descubre las series directo del <select> de la página de listado en vez
// de depender de SERIES_LIST (se quedó fija en OP-10/ST-21/EB-01 — el sitio
// ya va por OP-14/ST-28/EB-03). Mismo patrón que fetchOfficialSeries para
// JP/EN/FR/TC: leer las <option> reales, no mantener una lista a mano.
const fetchDynamicSeriesList = async (): Promise<SeriesEntry[]> => {
  const response = await axios.get<string>(`${BASE_URL}${CARDLIST_PATH}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const $ = cheerio.load(response.data);
  const entries: SeriesEntry[] = [];
  const seen = new Set<string>();

  $("option").each((_, el) => {
    const value = ($(el).attr("value") || "").trim();
    if (!value || value === "all" || seen.has(value)) return;
    seen.add(value);

    // "[OPK-14] 부스터 팩 ..." -> OP14, "[STK-28] ..." -> ST28, "[EBK-01] ..."
    // -> EB01. La "K" pegada al prefijo es lo único que distingue esto de la
    // convención de corchete que usa Bandai en JP/EN/FR/TC.
    const bracket = value.match(/^\[([A-Z]+)K-(\d+)\]/);
    const setCode = bracket ? `${bracket[1]}${bracket[2]}` : "P";
    entries.push({ series: value, setCode });
  });

  return entries;
};

const resolveSeriesList = async (
  options: ScriptOptions
): Promise<SeriesEntry[]> => {
  let list = await fetchDynamicSeriesList();
  // El bucket de promoción sin código propio va primero: otras series
  // (ej. un booster que trae un promo de regalo) referencian esos códigos
  // como alterna, y necesitan que la base ya exista para no quedar
  // "pendiente de base" en esta misma corrida.
  list = [...list.filter((e) => e.setCode === "P"), ...list.filter((e) => e.setCode !== "P")];

  if (options.seriesFilter?.length) {
    const filterSet = new Set(options.seriesFilter);
    list = list.filter((entry) => filterSet.has(entry.series));
  }

  if (options.setFilter?.length) {
    const normalizedOrder = options.setFilter.map((value) =>
      value.toUpperCase()
    );
    const filterSet = new Set(normalizedOrder);
    list = list
      .filter((entry) => filterSet.has(entry.setCode.toUpperCase()))
      .sort(
        (a, b) =>
          normalizedOrder.indexOf(a.setCode.toUpperCase()) -
          normalizedOrder.indexOf(b.setCode.toUpperCase())
      );
  }

  return list;
};

const resolveSetId = async (setCode: string, region?: string | null) => {
  const set = await prisma.set.findFirst({
    where: {
      code: {
        equals: setCode,
        mode: "insensitive",
      },
      region: region ?? undefined,
    },
    select: { id: true },
  });
  if (set?.id) return set.id;
  return null;
};

let missingSetId: number | null = null;

const ensureMissingSet = async () => {
  if (missingSetId) return missingSetId;
  const existing = await prisma.set.findFirst({
    where: {
      title: {
        equals: "Missing",
        mode: "insensitive",
      },
    },
    select: { id: true },
  });
  if (existing?.id) {
    missingSetId = existing.id;
    return missingSetId;
  }
  const created = await prisma.set.create({
    data: {
      title: "Missing",
      originalTitle: "Missing",
      image: "",
      code: null,
      releaseDate: new Date(),
      isOpen: false,
      version: null,
    },
    select: { id: true },
  });
  missingSetId = created.id;
  return missingSetId;
};

const ensureSetForTitle = async (
  title: string,
  region: string | null,
  translatedTitle?: string | null
) => {
  const existing = await prisma.set.findFirst({
    where: {
      region: region ?? undefined,
      OR: [
        {
          originalTitle: {
            equals: title,
            mode: "insensitive",
          },
        },
        {
          title: {
            equals: title,
            mode: "insensitive",
          },
        },
      ],
    },
    select: { id: true, originalTitle: true, translatedTitle: true },
  });
  if (existing?.id) {
    const updates: { originalTitle?: string; translatedTitle?: string } = {};
    if (!existing.originalTitle) {
      updates.originalTitle = title;
    }
    if (translatedTitle && !existing.translatedTitle) {
      updates.translatedTitle = translatedTitle;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.set.update({
        where: { id: existing.id },
        data: updates,
      });
    }
    return existing.id;
  }

  const created = await prisma.set.create({
    data: {
      title,
      originalTitle: title,
      translatedTitle: translatedTitle ?? null,
      image: "",
      code: null,
      region,
      releaseDate: new Date(),
      isOpen: false,
      version: null,
    },
    select: { id: true },
  });
  console.log(
    `[set][create] ${title} (id=${created.id}) region=${region ?? "null"}`
  );
  return created.id;
};

const checkRegionalExclusive = async (
  baseCode: string,
  region: string
): Promise<boolean> => {
  const existing = await prisma.card.findFirst({
    where: {
      code: baseCode,
      isFirstEdition: true,
      region: { not: region },
    },
    select: { id: true },
  });
  return !existing;
};

const ensureCardSetLinks = async (cardId: number, setIds: number[]) => {
  if (!setIds.length) return;
  const existing = await prisma.cardSet.findMany({
    where: { cardId, setId: { in: setIds } },
    select: { setId: true },
  });
  const existingSetIds = new Set(existing.map((item) => item.setId));
  const toCreate = setIds.filter((setId) => !existingSetIds.has(setId));
  if (!toCreate.length) return;
  await prisma.cardSet.createMany({
    data: toCreate.map((setId) => ({ cardId, setId })),
  });
};

const ensureCardSource = async (cardId: number, card: ScrapedCard) => {
  if (!card.sourceId || !card.imageUrl) return;
  const existingExact = await prisma.cardSource.findFirst({
    where: {
      source: "KR",
      sourceId: card.sourceId,
      sourceImageUrl: card.imageUrl,
    },
    select: { id: true },
  });

  if (existingExact) {
    await prisma.cardSource.update({
      where: { id: existingExact.id },
      data: {
        cardId,
        offerType: card.originTitle ?? undefined,
      },
    });
    return;
  }

  const existingEmpty = await prisma.cardSource.findFirst({
    where: {
      source: "KR",
      sourceId: card.sourceId,
      sourceImageUrl: null,
    },
    select: { id: true },
  });

  if (existingEmpty) {
    await prisma.cardSource.update({
      where: { id: existingEmpty.id },
      data: {
        cardId,
        sourceImageUrl: card.imageUrl,
        offerType: card.originTitle ?? undefined,
      },
    });
    return;
  }

  // Ya hay una fuente para este sourceId, pero con OTRA imagen — el sitio
  // reemplazó el arte de esta carta sin cambiar su código (esto fue
  // exactamente lo que pasó con P-001). No se pisa sola (podría chocar con
  // una corrección manual); se anota para revisión en vez de crear una
  // segunda fuente duplicada para el mismo sourceId.
  const existingOther = await prisma.cardSource.findFirst({
    where: {
      source: "KR",
      sourceId: card.sourceId,
      NOT: { sourceImageUrl: card.imageUrl },
    },
    select: { id: true, sourceImageUrl: true },
  });
  if (existingOther) {
    changedSourceImages.push({
      id: card.sourceId,
      oldUrl: existingOther.sourceImageUrl ?? "",
      newUrl: card.imageUrl,
    });
    return;
  }

  await prisma.cardSource.create({
    data: {
      cardId,
      source: "KR",
      sourceId: card.sourceId,
      sourceImageUrl: card.imageUrl,
      offerType: card.originTitle,
    },
  });
};

const cleanupDuplicateSources = async (
  source: string,
  region: string,
  dryRun: boolean
) => {
  const getFilename = (value: string) => {
    let filename = "";
    try {
      const url = new URL(value);
      filename = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    } catch {
      filename = decodeURIComponent(value.split("/").pop() ?? "");
    }
    return filename.replace(/\?.*$/, "");
  };

  const isBaseImageUrl = (code: string, imageUrl: string | null) => {
    if (!imageUrl) return false;
    const filename = getFilename(imageUrl);
    if (!filename) return false;
    const upper = filename.toUpperCase();
    const target = code.toUpperCase();
    const idx = upper.indexOf(target);
    if (idx === -1) return false;
    let suffix = filename.slice(idx + target.length);
    suffix = suffix.replace(/\.(png|jpg|jpeg|webp)$/i, "");
    suffix = suffix.replace(/^[_-]+/, "");
    return suffix.length === 0;
  };

  const rows = await prisma.cardSource.findMany({
    where: {
      source,
      sourceImageUrl: { not: null },
      card: { region },
    },
    select: {
      cardId: true,
      sourceImageUrl: true,
      card: { select: { id: true, isFirstEdition: true } },
    },
  });

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.sourceImageUrl ?? "";
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let promoted = 0;
  let removed = 0;
  let skipped = 0;
  let reassigned = 0;

  for (const [imageUrl, entries] of Array.from(groups)) {
    const base = entries.find((entry) => entry.card?.isFirstEdition);
    if (!base) continue;
    const baseId = base.cardId;
    const alternates = entries.filter((entry) => entry.cardId !== baseId);
    if (!alternates.length) continue;

    for (const alt of alternates) {
      if (dryRun) {
        console.log(
          `[cleanup][dry-run] image=${imageUrl} base=${baseId} drop=${alt.cardId}`
        );
        continue;
      }

      await prisma.cardSource.updateMany({
        where: {
          cardId: alt.cardId,
          source,
          sourceImageUrl: imageUrl,
        },
        data: { cardId: baseId },
      });

      await prisma.card.updateMany({
        where: { baseCardId: alt.cardId },
        data: { baseCardId: baseId },
      });

      const remainingSources = await prisma.cardSource.count({
        where: { cardId: alt.cardId },
      });

      if (remainingSources > 0) {
        skipped += 1;
        continue;
      }

      await prisma.cardSet.deleteMany({ where: { cardId: alt.cardId } });
      await prisma.cardGroupLink.deleteMany({ where: { cardId: alt.cardId } });
      await prisma.cardVariantLink.deleteMany({ where: { cardId: alt.cardId } });
      await prisma.card.delete({ where: { id: alt.cardId } });
      removed += 1;
    }

    promoted += 1;
  }

  const baseCardsWithoutSources = await prisma.card.findMany({
    where: {
      region,
      isFirstEdition: true,
      sources: { none: {} },
    },
    select: { id: true, code: true },
  });

  for (const base of baseCardsWithoutSources) {
    const alternates = await prisma.card.findMany({
      where: {
        region,
        isFirstEdition: false,
        code: base.code,
        sources: { some: {} },
      },
      select: {
        id: true,
        sources: { select: { id: true, sourceImageUrl: true } },
      },
    });

    for (const alt of alternates) {
      const baseSource = alt.sources.find((src) =>
        isBaseImageUrl(base.code, src.sourceImageUrl ?? null)
      );
      if (!baseSource) continue;

      if (dryRun) {
        console.log(
          `[cleanup][dry-run] move base source code=${base.code} from ${alt.id} -> ${base.id}`
        );
        continue;
      }

      await prisma.cardSource.updateMany({
        where: { cardId: alt.id },
        data: { cardId: base.id },
      });

      await prisma.card.updateMany({
        where: { baseCardId: alt.id },
        data: { baseCardId: base.id },
      });

      await prisma.cardSet.deleteMany({ where: { cardId: alt.id } });
      await prisma.cardGroupLink.deleteMany({ where: { cardId: alt.id } });
      await prisma.cardVariantLink.deleteMany({ where: { cardId: alt.id } });
      await prisma.card.delete({ where: { id: alt.id } });

      reassigned += 1;
    }
  }

  const summaryLabel = dryRun ? "dry-run" : "done";
  console.log(
    `[cleanup][${summaryLabel}] promotedBases=${promoted} removed=${removed} skipped=${skipped} reassignedBaseSources=${reassigned}`
  );
};

// Red de seguridad: una sola carta con un error inesperado (timeout de red
// que se escapó de los catches internos, un fallo de Prisma, lo que sea) no
// debe tumbar las 40 series completas de una corrida — se anota y se sigue
// con la siguiente carta.
const upsertCard = async (
  ...args: Parameters<typeof upsertCardInner>
): Promise<number | null> => {
  try {
    return await upsertCardInner(...args);
  } catch (error) {
    const [card] = args;
    console.error(
      `[error][upsert-failed] ${card.id}:`,
      error instanceof Error ? error.message : error
    );
    networkErrors.push({
      id: card.id,
      url: card.imageUrl,
      code: (error as any)?.code,
    });
    return null;
  }
};

const upsertCardInner = async (
  card: ScrapedCard,
  options: ScriptOptions,
  setIds: number[],
  baseCardIdOverride?: number | null,
  s3Client?: S3Client,
  bucketName?: string,
  publicUrl?: string
): Promise<number | null> => {
  if (options.backfillCardSource) {
    const existing = card.isAlternate
      ? await prisma.card.findFirst({
          where: {
            code: card.baseCode,
            region: options.region,
            isFirstEdition: false,
            alias: card.alias,
          },
          select: { id: true },
        })
      : await prisma.card.findFirst({
          where: {
            code: card.baseCode,
            region: options.region,
            isFirstEdition: true,
          },
          select: { id: true },
        });

    if (!existing) {
      console.log(`[backfill][skip] Missing card for ${card.id}`);
      return null;
    }
    if (options.dryRun) {
      console.log(`[backfill][dry-run] ${card.id} -> ${existing.id}`);
      return existing.id;
    }
    await ensureCardSource(existing.id, card);
    console.log(`[backfill] ${card.id} -> ${existing.id}`);
    return existing.id;
  }

  const baseCardId = card.isAlternate
    ? baseCardIdOverride ??
      (
        await prisma.card.findFirst({
          where: {
            code: card.baseCode,
            region: options.region,
            isFirstEdition: true,
          },
          select: { id: true },
        })
      )?.id ??
      null
    : null;

  if (card.isAlternate && !baseCardId && !options.dryRun) {
    console.log(`[skip][no-base] Missing base card for ${card.id}`);
    return null;
  }

  const existing = card.isAlternate
    ? await prisma.card.findFirst({
        where: {
          code: card.baseCode,
          region: options.region,
          isFirstEdition: false,
          alias: card.alias,
        },
        select: { id: true },
      })
    : await prisma.card.findFirst({
        where: {
          code: card.baseCode,
          region: options.region,
          isFirstEdition: true,
        },
        select: { id: true },
      });

  const isRegionalExclusive = options.markExclusive
    ? await checkRegionalExclusive(card.baseCode, options.region)
    : false;

  const usBaseCard = await withPrismaRetry(() =>
    prisma.card.findFirst({
      where: {
        code: card.baseCode,
        isFirstEdition: true,
        region: "US",
      },
      include: {
        colors: true,
        types: true,
        effects: true,
        conditions: true,
        texts: true,
        rulings: true,
      },
    })
  );

  if (!usBaseCard) {
    console.log(`[skip][no-us-base] Missing US base for ${card.id}`);
    if (!missingUsBaseLookup.has(card.id)) {
      missingUsBaseLookup.add(card.id);
      missingUsBaseCards.push({
        id: card.id,
        code: card.baseCode,
        set: card.setCode,
      });
    }
    return null;
  }

  const relationColors =
    usBaseCard.colors.map((item) => item.color) ?? card.colors;
  const relationTypes = usBaseCard.types.map((item) => item.type) ?? card.types;
  const relationEffects = usBaseCard.effects.map((item) => item.effect) ?? [];
  const relationConditions =
    usBaseCard.conditions.map((item) => item.condition) ?? [];
  const relationTexts =
    usBaseCard.texts.map((item) => item.text) ?? (card.text ? [card.text] : []);

  if (options.dryRun) {
    console.log(`[dry-run] ${existing ? "update" : "create"} ${card.id}`);
    return existing?.id ?? null;
  }

  if (existing) {
    if (!options.updateExisting) {
      if (setIds.length) {
        await ensureCardSetLinks(existing.id, setIds);
      }
      await ensureCardSource(existing.id, card);
      skippedCount += 1;
      console.log(`[skip][exists] ${card.id}`);
      return existing.id;
    }
  }

  let uploadedSrc = card.imageUrl;
  let imageKey: string | null = null;

  if (!s3Client || !bucketName || !publicUrl) {
    throw new Error("R2 client not configured for image upload.");
  }

  try {
    const uploadResult = await uploadCardImage(
      card,
      options,
      s3Client,
      bucketName,
      publicUrl
    );
    uploadedSrc = uploadResult.src;
    imageKey = uploadResult.imageKey;
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 404 || status === 410) {
      console.log(
        `[warn][image-missing] ${card.id} ${card.imageUrl} (status ${status})`
      );
      addMissingImage({ id: card.id, url: card.imageUrl });
      uploadedSrc = card.imageUrl;
      imageKey = null;
    } else {
      const code = error?.code;
      const message =
        typeof error?.message === "string" ? error.message.toLowerCase() : "";
      if (
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "ECONNABORTED" ||
        code === "EAI_AGAIN" ||
        code === "ERR_BAD_RESPONSE" ||
        message.includes("stream has been aborted") ||
        message.includes("timeout") ||
        (typeof status === "number" && (status === 429 || status >= 500))
      ) {
        console.log(
          `[skip][network-error] ${card.id} ${card.imageUrl} (code ${code}, status ${status})`
        );
        networkErrors.push({ id: card.id, url: card.imageUrl, code });
        addMissingImage({ id: card.id, url: card.imageUrl });
        return null;
      }
      throw error;
    }
  }

  const baseData = {
    src: uploadedSrc,
    imageKey,
    name: usBaseCard.name,
    cost: usBaseCard.cost,
    power: usBaseCard.power,
    attribute: usBaseCard.attribute,
    counter: usBaseCard.counter,
    category: usBaseCard.category,
    life: usBaseCard.life,
    rarity: usBaseCard.rarity,
    illustrator: usBaseCard.illustrator,
    alternateArt: card.isAlternate ? "Alternate Art" : null,
    status: usBaseCard.status ?? "legal",
    triggerCard: usBaseCard.triggerCard,
    code: card.baseCode,
    setCode: card.setCode,
    isFirstEdition: !card.isAlternate,
    tcgUrl: null,
    tcgplayerProductId: null,
    tcgplayerLinkStatus: null,
    marketPrice: null,
    lowPrice: null,
    highPrice: null,
    priceCurrency: usBaseCard.priceCurrency ?? "USD",
    priceUpdatedAt: null,
    alias: card.alias,
    order: card.order,
    collectionOrder: usBaseCard.collectionOrder,
    isPro: usBaseCard.isPro,
    region: options.region,
    language: options.language,
    isRegionalExclusive,
    baseCardId: card.isAlternate ? baseCardId ?? null : null,
  };

  if (existing) {
    const updateData = {
      ...baseData,
      colors: {
        deleteMany: {},
        create: relationColors.map((color) => ({ color })),
      },
      types: {
        deleteMany: {},
        create: relationTypes.map((type) => ({ type })),
      },
      texts: {
        deleteMany: {},
        create: relationTexts.map((text) => ({ text })),
      },
      effects: {
        deleteMany: {},
        create: relationEffects.map((effect) => ({ effect })),
      },
      conditions: {
        deleteMany: {},
        create: relationConditions.map((condition) => ({ condition })),
      },
      ...(card.isAlternate
        ? {}
        : {
            rulings: {
              deleteMany: {},
              create: usBaseCard.rulings.map((ruling) => ({
                question: ruling.question,
                answer: ruling.answer,
              })),
            },
          }),
    };

    const updated = await prisma.card.update({
      where: { id: existing.id },
      data: updateData,
      select: { id: true },
    });
    await ensureCardSource(updated.id, card);
    if (setIds.length) {
      await ensureCardSetLinks(updated.id, setIds);
    }
    const computedOrder = buildCollectionOrder({
      id: updated.id,
      code: card.baseCode,
      category: usBaseCard.category,
      baseCardId: card.isAlternate ? baseCardId ?? null : null,
      order: card.order,
    });
    await prisma.card.update({
      where: { id: updated.id },
      data: { collectionOrder: computedOrder },
    });
    console.log(`[update] ${card.id} -> ${updated.id}`);
    return updated.id;
  }

  const createData = {
    ...baseData,
    colors: {
      create: relationColors.map((color) => ({ color })),
    },
    types: {
      create: relationTypes.map((type) => ({ type })),
    },
    texts: {
      create: relationTexts.map((text) => ({ text })),
    },
    effects: {
      create: relationEffects.map((effect) => ({ effect })),
    },
    conditions: {
      create: relationConditions.map((condition) => ({ condition })),
    },
    ...(card.isAlternate
      ? {}
      : {
          rulings: {
            create: usBaseCard.rulings.map((ruling) => ({
              question: ruling.question,
              answer: ruling.answer,
            })),
          },
        }),
  };

  const created = await prisma.card.create({
    data: createData,
    select: { id: true },
  });
  await ensureCardSource(created.id, card);
  if (setIds.length) {
    await ensureCardSetLinks(created.id, setIds);
  }
  const computedOrder = buildCollectionOrder({
    id: created.id,
    code: card.baseCode,
    category: usBaseCard.category,
    baseCardId: card.isAlternate ? baseCardId ?? null : null,
    order: card.order,
  });
  await prisma.card.update({
    where: { id: created.id },
    data: { collectionOrder: computedOrder },
  });
  createdCount += 1;
  console.log(`[create] ${card.id} -> ${created.id}`);
  return created.id;
};

const main = async (overrideOptions?: Partial<ScriptOptions>) => {
  const options: ScriptOptions = { ...DEFAULT_KR_SYNC_OPTIONS, ...overrideOptions };
  const buildSummary = () => ({
    created: createdCount,
    skipped: skippedCount,
    changedSourceImages: changedSourceImages.length,
    missingUsBase: missingUsBaseCards.length,
    missingImages: missingImages.length,
    unresolvedAlternates: unresolvedAlternates.length,
  });
  const existingMissing = await loadExistingMissingUsBaseCards();
  await loadExistingMissingImages();
  for (const entry of existingMissing) {
    if (!missingUsBaseLookup.has(entry.id)) {
      missingUsBaseLookup.add(entry.id);
      missingUsBaseCards.push(entry);
    }
  }
  const s3Client = options.dryRun ? null : createS3Client();
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const seriesList = await resolveSeriesList(options);

  if (!seriesList.length) {
    console.log("No series matched the provided filters.");
    return buildSummary();
  }

  console.log(
    `[start] Series=${seriesList.length} Region=${options.region} Lang=${options.language}`
  );

  let processed = 0;

  for (const entry of seriesList) {
    console.log(`\n[series] ${entry.series} (${entry.setCode})`);
    let seriesCards: ScrapedCard[];
    try {
      seriesCards = await fetchSeriesCards(entry.series, options);
    } catch (error) {
      // Una serie que no carga (timeout, 5xx) no debe tumbar el resto de la
      // corrida — se salta esta serie y se sigue con la siguiente.
      console.error(
        `[error][series-failed] ${entry.series}:`,
        error instanceof Error ? error.message : error
      );
      continue;
    }
    const cards = seriesCards.map((card) => ({
      ...card,
      setCode: options.overrideSetCode ? entry.setCode : card.setCode,
    }));
    const filteredCards = options.onlyIds?.length
      ? cards.filter((card) => {
          const idMatch =
            options.onlyIds?.includes(card.id) ||
            options.onlyIds?.includes(card.baseCode) ||
            (card.variantKey
              ? options.onlyIds?.includes(`${card.baseCode}_${card.variantKey}`)
              : false);
          return Boolean(idMatch);
        })
      : cards;

    const bases = filteredCards
      .filter((card) => !card.isAlternate)
      .sort((a, b) => a.baseCode.localeCompare(b.baseCode));
    const alternates = filteredCards
      .filter((card) => card.isAlternate)
      .sort((a, b) => a.baseCode.localeCompare(b.baseCode));

    const setIdByCode = new Map<string, number | null>();
    const resolveSetIdCached = async (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) return null;
      if (setIdByCode.has(normalized)) {
        return setIdByCode.get(normalized) ?? null;
      }
      const resolved = await resolveSetId(normalized, options.region);
      if (!resolved) {
        const fallbackId = await ensureMissingSet();
        console.log(
          `[warn] Set ${normalized} not found. Linked to Missing set (${fallbackId}).`
        );
        setIdByCode.set(normalized, fallbackId);
        return fallbackId;
      }
      setIdByCode.set(normalized, resolved ?? null);
      return resolved ?? null;
    };

    const setIdByOriginTitle = new Map<string, number | null>();
    const resolveOriginSetId = async (title: string | null) => {
      if (!title) return null;
      const normalized = title.trim();
      if (!normalized) return null;
      if (setIdByOriginTitle.has(normalized)) {
        return setIdByOriginTitle.get(normalized) ?? null;
      }
      const resolved = await ensureSetForTitle(
        normalized,
        options.region ?? null,
        null
      );
      setIdByOriginTitle.set(normalized, resolved ?? null);
      return resolved ?? null;
    };

    const baseCardIdByCode = new Map<string, number>();

    for (const card of bases) {
      if (options.limit && processed >= options.limit) {
        console.log("[limit] Reached limit, stopping.");
        return buildSummary();
      }
      processed += 1;
      console.log(
        `[card] code=${card.baseCode} set=${card.setCode} isFirstEdition=true src=${card.imageUrl}`
      );
      const originTitle = card.originTitle?.trim() || null;
      const originSetId = await resolveOriginSetId(originTitle);
      const resolvedSetId = options.linkByCardSetCode
        ? await resolveSetIdCached(card.setCode)
        : null;
      const setIds = [originSetId, resolvedSetId].filter(
        (value): value is number => Boolean(value)
      );
      const id = await upsertCard(
        card,
        options,
        setIds,
        null,
        s3Client ?? undefined,
        bucketName,
        publicUrl
      );
      if (id) {
        baseCardIdByCode.set(card.baseCode, id);
      }
    }

    const pendingAlternates: Array<{
      card: ScrapedCard;
      setIds: number[];
    }> = [];

    for (const card of alternates) {
      if (options.limit && processed >= options.limit) {
        console.log("[limit] Reached limit, stopping.");
        return buildSummary();
      }
      processed += 1;
      console.log(
        `[card] code=${card.baseCode} set=${card.setCode} isFirstEdition=false src=${card.imageUrl}`
      );
      let baseCardIdOverride = baseCardIdByCode.get(card.baseCode) ?? null;
      const originTitle = card.originTitle?.trim() || null;
      const originSetId = await resolveOriginSetId(originTitle);
      const resolvedSetId = options.linkByCardSetCode
        ? await resolveSetIdCached(card.setCode)
        : null;
      const setIds = [originSetId, resolvedSetId].filter(
        (value): value is number => Boolean(value)
      );
      if (!baseCardIdOverride) {
        const existingBase = await prisma.card.findFirst({
          where: {
            code: card.baseCode,
            region: options.region,
            isFirstEdition: true,
          },
          select: { id: true },
        });
        if (existingBase?.id) {
          baseCardIdOverride = existingBase.id;
          baseCardIdByCode.set(card.baseCode, existingBase.id);
        }
      }
      if (!baseCardIdOverride) {
        pendingAlternates.push({ card, setIds });
        if (options.dryRun) {
          console.log(`[dry-run] queue alternate ${card.id} (base pending)`);
        }
        continue;
      }
      await upsertCard(
        card,
        options,
        setIds,
        baseCardIdOverride,
        s3Client ?? undefined,
        bucketName,
        publicUrl
      );
    }

    if (pendingAlternates.length) {
      console.log(
        `[retry] Alternates pending base: ${pendingAlternates.length}`
      );
      for (const pending of pendingAlternates) {
        const { card, setIds } = pending;
        let baseCardIdOverride =
          baseCardIdByCode.get(card.baseCode) ?? null;
        if (!baseCardIdOverride) {
          const existingBase = await prisma.card.findFirst({
            where: {
              code: card.baseCode,
              region: options.region,
              isFirstEdition: true,
            },
            select: { id: true },
          });
          if (existingBase?.id) {
            baseCardIdOverride = existingBase.id;
            baseCardIdByCode.set(card.baseCode, existingBase.id);
          }
        }
        if (!baseCardIdOverride) {
          unresolvedAlternates.push(card);
          console.log(`[skip][no-base] ${card.id} (base missing)`);
          continue;
        }
        await upsertCard(
          card,
          options,
          setIds,
          baseCardIdOverride,
          s3Client ?? undefined,
          bucketName,
          publicUrl
        );
      }
    }
  }

  if (options.cleanupDuplicates) {
    await cleanupDuplicateSources("KR", options.region, options.dryRun);
  }

  if (changedSourceImages.length) {
    const outPath = path.join(process.cwd(), "scripts", "changed-source-images-kr.json");
    await fs.writeFile(outPath, JSON.stringify({ changedSourceImages }, null, 2));
    console.log(
      `[summary] Saved changed source images to ${outPath} (${changedSourceImages.length})`
    );
  }

  // Reportes de seguimiento — se escriben acá (no en el entry point CLI) para
  // que también se generen cuando esto se llama desde el cron (runKrSync),
  // no solo al correr el script a mano.
  if (missingUsBaseCards.length) {
    await fs.writeFile(
      missingUsBasePath,
      JSON.stringify({ missingUsBaseCards }, null, 2)
    );
    console.log(
      `[summary] Saved missing US base cards to ${missingUsBasePath} (${missingUsBaseCards.length})`
    );
  }
  if (missingImages.length) {
    await fs.writeFile(
      missingImagesPath,
      JSON.stringify({ missingImages, networkErrors }, null, 2)
    );
    console.log(
      `[summary] Saved missing images to ${missingImagesPath} (${missingImages.length})`
    );
  } else if (networkErrors.length) {
    await fs.writeFile(
      missingImagesPath,
      JSON.stringify({ missingImages, networkErrors }, null, 2)
    );
    console.log(
      `[summary] Saved network errors to ${missingImagesPath} (${networkErrors.length})`
    );
  }
  if (unresolvedAlternates.length) {
    const outPath = path.join(process.cwd(), "scripts", "missing-kr-alternates.json");
    await fs.writeFile(outPath, JSON.stringify({ unresolvedAlternates }, null, 2));
    console.log(
      `[summary] Saved unresolved alternates to ${outPath} (${unresolvedAlternates.length})`
    );
  }

  return buildSummary();
};

/** Entry point programático — usado por el cron (app/api/cron/scrape-kr)
 * y por el wrapper CLI (scripts/scrape-onepiece-cardlist-kr.ts). */
export async function runKrSync(overrideOptions: Partial<ScriptOptions> = {}) {
  return main(overrideOptions);
}
