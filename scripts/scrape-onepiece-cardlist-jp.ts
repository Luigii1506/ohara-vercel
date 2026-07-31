#!/usr/bin/env ts-node

import "dotenv/config";
import axios from "axios";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

type SeriesEntry = {
  series: string;
  setCode: string;
};

type ScrapedCard = {
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

type ScriptOptions = {
  dryRun: boolean;
  updateExisting: boolean;
  limit: number | null;
  region: string;
  language: string;
  markExclusive: boolean;
  seriesFilter: string[] | null;
  setFilter: string[] | null;
  onlyIds: string[] | null;
  linkByCardSetCode: boolean;
  forceAlternates: boolean;
  overrideSetCode: boolean;
  emptySetCode: boolean;
  backfillCardSource: boolean;
  cleanupDuplicates: boolean;
};

const BASE_URL = "https://www.onepiece-cardgame.com";
const CARDLIST_PATH = "/cardlist/";

const REQUIRED_ENV = [
  "DATABASE_URL",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: "-tiny" },
  xs: { width: 100, height: 140, quality: 60, suffix: "-xs" },
  thumb: { width: 200, height: 280, quality: 70, suffix: "-thumb" },
  small: { width: 300, height: 420, quality: 75, suffix: "-small" },
  medium: { width: 600, height: 840, quality: 80, suffix: "-medium" },
  large: { width: 800, height: 1120, quality: 85, suffix: "-large" },
  original: { width: null, height: null, quality: 90, suffix: "" },
} as const;

const SERIES_LIST: SeriesEntry[] = [
  { series: "550901", setCode: "Promotional Card" },
  { series: "550801", setCode: "Limited Edition" },
  { series: "550701", setCode: "Family Deck Set" },
  { series: "550302", setCode: "PRB02" },
  { series: "550301", setCode: "PRB01" },
  { series: "550203", setCode: "EB03" },
  { series: "550202", setCode: "EB02" },
  { series: "550201", setCode: "EB01" },
  { series: "550114", setCode: "OP14" },
  { series: "550113", setCode: "OP13" },
  { series: "550112", setCode: "OP12" },
  { series: "550111", setCode: "OP11" },
  { series: "550110", setCode: "OP10" },
  { series: "550109", setCode: "OP09" },
  { series: "550108", setCode: "OP08" },
  { series: "550107", setCode: "OP07" },
  { series: "550106", setCode: "OP06" },
  { series: "550105", setCode: "OP05" },
  { series: "550104", setCode: "OP04" },
  { series: "550103", setCode: "OP03" },
  { series: "550102", setCode: "OP02" },
  { series: "550101", setCode: "OP01" },
  { series: "550029", setCode: "ST29" },
  { series: "550028", setCode: "ST28" },
  { series: "550027", setCode: "ST27" },
  { series: "550026", setCode: "ST26" },
  { series: "550025", setCode: "ST25" },
  { series: "550024", setCode: "ST24" },
  { series: "550023", setCode: "ST23" },
  { series: "550022", setCode: "ST22" },
  { series: "550021", setCode: "ST21" },
  { series: "550020", setCode: "ST20" },
  { series: "550019", setCode: "ST19" },
  { series: "550018", setCode: "ST18" },
  { series: "550017", setCode: "ST17" },
  { series: "550016", setCode: "ST16" },
  { series: "550015", setCode: "ST15" },
  { series: "550014", setCode: "ST14" },
  { series: "550013", setCode: "ST13" },
  { series: "550012", setCode: "ST12" },
  { series: "550011", setCode: "ST11" },
  { series: "550010", setCode: "ST10" },
  { series: "550009", setCode: "ST09" },
  { series: "550008", setCode: "ST08" },
  { series: "550007", setCode: "ST07" },
  { series: "550006", setCode: "ST06" },
  { series: "550005", setCode: "ST05" },
  { series: "550004", setCode: "ST04" },
  { series: "550003", setCode: "ST03" },
  { series: "550002", setCode: "ST02" },
  { series: "550001", setCode: "ST01" },
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
  LEADER: "Leader",
  CHARACTER: "Character",
  EVENT: "Event",
  STAGE: "Stage",
  DON: "DON",
};

const ATTRIBUTE_MAP: Record<string, string> = {
  "斬": "Slash",
  "打": "Strike",
  "知": "Wisdom",
  "射": "Ranged",
  "特": "Special",
};

const COLOR_MAP: Record<string, string> = {
  "赤": "red",
  "青": "blue",
  "緑": "green",
  "紫": "purple",
  "黒": "black",
  "黄": "yellow",
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

  return `${prefixIndex.toString().padStart(2, "0")}_${normalizedCode}_${suffix}_${card.id
    .toString()
    .padStart(6, "0")}`;
};

const prisma = new PrismaClient();

const unresolvedAlternates: ScrapedCard[] = [];
const missingUsBaseCards: Array<{ id: string; code: string; set: string }> = [];
const missingUsBaseLookup = new Set<string>();
const missingUsBasePath = "scripts/missing-us-base-jp.json";
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

const ensureEnvVars = () => {
  const missing = REQUIRED_ENV.filter(
    (key) => !process.env[key] || process.env[key]!.trim().length === 0
  );
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
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

const createS3Client = () =>
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

const downloadImage = async (url: string): Promise<Buffer> => {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
  });
  return Buffer.from(response.data);
};

const uploadImageVariants = async (
  s3Client: S3Client,
  filename: string,
  buffer: Buffer,
  bucketName: string,
  publicUrl: string
) => {
  console.log(`[upload] Uploading image variants for ${filename}`);

  for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
    const r2Key = `cards/${filename}${config.suffix}.webp`;
    let transformer = sharp(buffer);

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

const uploadCardImage = async (
  card: ScrapedCard,
  options: ScriptOptions,
  s3Client: S3Client,
  bucketName: string,
  publicUrl: string
) => {
  const imageKey = buildImageKey(card.id, options.region);
  const buffer = await downloadImage(card.imageUrl);
  const src = await uploadImageVariants(
    s3Client,
    imageKey,
    buffer,
    bucketName,
    publicUrl
  );
  return { src, imageKey };
};

const parseArgs = (): ScriptOptions => {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    dryRun: args.includes("--dry-run"),
    updateExisting: args.includes("--update-existing"),
    limit: null,
    region: "JP",
    language: "ja",
    markExclusive: args.includes("--mark-exclusive"),
    seriesFilter: null,
    setFilter: null,
    onlyIds: null,
    linkByCardSetCode: args.includes("--link-by-card-setcode"),
    forceAlternates: args.includes("--force-alternates"),
    overrideSetCode: args.includes("--override-setcode"),
    emptySetCode: args.includes("--empty-setcode"),
    backfillCardSource: args.includes("--backfill-card-source"),
    cleanupDuplicates: true,
  };

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isNaN(value) && value > 0) options.limit = value;
    } else if (arg.startsWith("--region=")) {
      options.region = arg.split("=")[1] ?? options.region;
    } else if (arg.startsWith("--language=")) {
      options.language = arg.split("=")[1] ?? options.language;
    } else if (arg.startsWith("--series=")) {
      const value = arg.split("=")[1] ?? "";
      options.seriesFilter = value.split(",").map((item) => item.trim()).filter(Boolean);
    } else if (arg.startsWith("--set=")) {
      const value = arg.split("=")[1] ?? "";
      options.setFilter = value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
    } else if (arg.startsWith("--only-ids=")) {
      const value = arg.split("=")[1] ?? "";
      options.onlyIds = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (arg === "--link-by-card-setcode") {
      options.linkByCardSetCode = true;
    } else if (arg === "--force-alternates") {
      options.forceAlternates = true;
    } else if (arg === "--override-setcode") {
      options.overrideSetCode = true;
    } else if (arg === "--empty-setcode") {
      options.emptySetCode = true;
    } else if (arg === "--backfill-card-source") {
      options.backfillCardSource = true;
    } else if (arg === "--no-cleanup-duplicates") {
      options.cleanupDuplicates = false;
    }
  }

  return options;
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

const parseCardModal = (
  $: cheerio.CheerioAPI,
  modal: Element,
  options: ScriptOptions
): ScrapedCard | null => {
  const $modal = $(modal);
  const id = $modal.attr("id")?.trim();
  if (!id) return null;

  const imagePath =
    $modal.find(".frontCol img").attr("data-src") ||
    $modal.find(".frontCol img").attr("src") ||
    "";
  const imageUrl = buildAbsoluteUrl(imagePath);

  const [baseCode, variantSuffix] = id.split("_");
  const imageVariantKey = extractVariantKey(baseCode, imagePath);
  let variantKey = variantSuffix || imageVariantKey || null;
  if (options.forceAlternates && !variantKey) {
    variantKey = `ALT${hashString(`${baseCode}-${imagePath}`)}`;
  }
  const isAlternate = options.forceAlternates ? true : Boolean(variantKey);

  const infoSpans = $modal.find(".infoCol span").map((_, el) => $(el).text().trim()).get();
  const rarityRaw = infoSpans[1] || "";
  const categoryRaw = infoSpans[2] || "";

  const name = $modal.find(".cardName").text().trim();
  const category = CATEGORY_MAP[categoryRaw.toUpperCase()] || categoryRaw || "Character";
  const rarity = rarityRaw ? (RARITY_MAP[rarityRaw.toUpperCase()] || rarityRaw) : null;

  const costLabel = $modal.find(".cost h3").text().trim();
  const costValueRaw = normalizeLabelValue($modal.find(".cost").text(), costLabel);
  const costNumber = parseNumericValue(costValueRaw);
  const life = costLabel.includes("ライフ") && costNumber ? `${costNumber} Life` : null;
  const cost = costLabel.includes("コスト") && costNumber ? `${costNumber} Cost` : null;

  const powerLabel = $modal.find(".power h3").text().trim();
  const powerValueRaw = normalizeLabelValue($modal.find(".power").text(), powerLabel);
  const powerNumber = parseNumericValue(powerValueRaw);
  const power = powerNumber ? `${powerNumber} Power` : null;

  const counterLabel = $modal.find(".counter h3").text().trim();
  const counterValueRaw = normalizeLabelValue($modal.find(".counter").text(), counterLabel);
  const counterNumber = parseNumericValue(counterValueRaw);
  const counter = counterNumber ? `+${counterNumber} Counter` : null;

  const attributeAlt = $modal.find(".attribute img").attr("alt")?.trim() ?? "";
  const attribute = ATTRIBUTE_MAP[attributeAlt] || null;

  const colorLabel = $modal.find(".color h3").text().trim();
  const colorValueRaw = normalizeLabelValue($modal.find(".color").text(), colorLabel);
  const colors = colorValueRaw
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((color) => COLOR_MAP[color] || color.toLowerCase())
    .filter(Boolean);

  const featureLabel = $modal.find(".feature h3").text().trim();
  const featureValueRaw = normalizeLabelValue($modal.find(".feature").text(), featureLabel);
  const types = featureValueRaw
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);

  const textLabel = $modal.find(".text h3").text().trim();
  const textValueRaw = normalizeLabelValue($modal.find(".text").text(), textLabel);
  const text = textValueRaw ? textValueRaw.replace(/\s+/g, " ").trim() : null;

  const triggerLabel = $modal.find(".trigger h3").text().trim();
  const triggerValueRaw = normalizeLabelValue($modal.find(".trigger").text(), triggerLabel);
  const trigger = triggerValueRaw ? triggerValueRaw.replace(/\s+/g, " ").trim() : null;

  const setCode = options.emptySetCode ? "" : baseCode.split("-")[0];
  const order = isAlternate && variantKey ? variantKey.replace("p", "") : "0";
  const alias = isAlternate && variantKey ? variantKey : "0";

  const getInfoLabel = $modal.find(".getInfo h3").first().text().trim();
  const getInfoRaw = normalizeLabelValue($modal.find(".getInfo").text(), getInfoLabel);
  const originTitle =
    getInfoLabel.includes("入手情報") && getInfoRaw ? getInfoRaw : null;
  if (originTitle) {
    console.log(`[offer][detail] ${baseCode} -> ${originTitle}`);
  }

  return {
    id: variantKey ? `${baseCode}_${variantKey}` : baseCode,
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
  const url = new URL(CARDLIST_PATH, BASE_URL);
  url.searchParams.set("series", series);
  const response = await axios.get(url.toString());
  const $ = cheerio.load(response.data);

  const cards = $("dl.modalCol")
    .map((_, el) => parseCardModal($, el, options))
    .get()
    .filter(Boolean) as ScrapedCard[];

  return cards;
};

const resolveSeriesList = (options: ScriptOptions): SeriesEntry[] => {
  let list = SERIES_LIST;

  if (options.seriesFilter?.length) {
    const filterSet = new Set(options.seriesFilter);
    list = list.filter((entry) => filterSet.has(entry.series));
  }

  if (options.setFilter?.length) {
    const filterSet = new Set(options.setFilter.map((value) => value.toUpperCase()));
    list = list.filter((entry) => filterSet.has(entry.setCode.toUpperCase()));
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
      source: "JP",
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
      source: "JP",
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

  await prisma.cardSource.create({
    data: {
      cardId,
      source: "JP",
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

const upsertCard = async (
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
      (await prisma.card.findFirst({
        where: {
          code: card.baseCode,
          region: options.region,
          isFirstEdition: true,
        },
        select: { id: true },
      }))?.id ??
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
  const relationTypes =
    usBaseCard.types.map((item) => item.type) ?? card.types;
  const relationEffects = usBaseCard.effects.map((item) => item.effect) ?? [];
  const relationConditions =
    usBaseCard.conditions.map((item) => item.condition) ?? [];
  const relationTexts =
    usBaseCard.texts.map((item) => item.text) ??
    (card.text ? [card.text] : []);

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
      console.log(`[skip][exists] ${card.id}`);
      return existing.id;
    }
  }

  let uploadedSrc = card.imageUrl;
  let imageKey: string | null = null;

  if (!s3Client || !bucketName || !publicUrl) {
    throw new Error("R2 client not configured for image upload.");
  }

  const uploadResult = await uploadCardImage(
    card,
    options,
    s3Client,
    bucketName,
    publicUrl
  );
  uploadedSrc = uploadResult.src;
  imageKey = uploadResult.imageKey;

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
  console.log(`[create] ${card.id} -> ${created.id}`);
  return created.id;
};

const main = async () => {
  const options = parseArgs();
  if (!options.dryRun) {
    ensureEnvVars();
  }
  const existingMissing = await loadExistingMissingUsBaseCards();
  for (const entry of existingMissing) {
    if (!missingUsBaseLookup.has(entry.id)) {
      missingUsBaseLookup.add(entry.id);
      missingUsBaseCards.push(entry);
    }
  }
  const s3Client = options.dryRun ? null : createS3Client();
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const seriesList = resolveSeriesList(options);

  if (!seriesList.length) {
    console.log("No series matched the provided filters.");
    return;
  }

  console.log(`[start] Series=${seriesList.length} Region=${options.region} Lang=${options.language}`);

  let processed = 0;

  for (const entry of seriesList) {
    console.log(`\n[series] ${entry.series} (${entry.setCode})`);
    const cards = (await fetchSeriesCards(entry.series, options)).map((card) => ({
      ...card,
      setCode: entry.setCode,
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
    const normalizedCards =
      options.overrideSetCode && entry.setCode
        ? filteredCards.map((card) => ({
            ...card,
            setCode: entry.setCode ?? card.setCode,
          }))
        : filteredCards;

    const bases = normalizedCards
      .filter((card) => !card.isAlternate)
      .sort((a, b) => a.baseCode.localeCompare(b.baseCode));
    const alternates = normalizedCards
      .filter((card) => card.isAlternate)
      .sort((a, b) => a.baseCode.localeCompare(b.baseCode));

    const setIdByCode = new Map<string, number | null>();
    const resolveSetIdCached = async (code: string) => {
      const normalized = code.trim().toUpperCase();
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
      const resolved = await ensureSetForTitle(normalized, options.region ?? null, null);
      setIdByOriginTitle.set(normalized, resolved ?? null);
      return resolved ?? null;
    };

    const baseCardIdByCode = new Map<string, number>();

    for (const card of bases) {
      if (options.limit && processed >= options.limit) {
        console.log("[limit] Reached limit, stopping.");
        return;
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
        return;
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
    await cleanupDuplicateSources("JP", options.region, options.dryRun);
  }
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (missingUsBaseCards.length) {
      await fs.writeFile(
        missingUsBasePath,
        JSON.stringify({ missingUsBaseCards }, null, 2)
      );
      console.log(
        `[summary] Saved missing US base cards to ${missingUsBasePath} (${missingUsBaseCards.length})`
      );
    }
    if (unresolvedAlternates.length) {
      const outPath = path.join(
        process.cwd(),
        "scripts",
        "missing-jp-alternates.json"
      );
      await fs.writeFile(
        outPath,
        JSON.stringify({ unresolvedAlternates }, null, 2)
      );
      console.log(
        `[summary] Saved unresolved alternates to ${outPath} (${unresolvedAlternates.length})`
      );
    }
    await prisma.$disconnect();
  });
