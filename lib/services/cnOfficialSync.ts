import axios from "axios";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import sharp from "sharp";

/**
 * Sincronización con el sitio oficial de China continental —
 * onepiece-cardgame.cn. A diferencia de en/asia-en/jp/fr (HTML estático,
 * ver officialSync.ts), es una SPA; el catálogo real vive detrás de una API
 * REST (https://webadmin.windoent.com/front/op-public) sin autenticación:
 *   - cardType/cardofferingtype/cachelist  -> lista de "offer types" (series/producto)
 *   - cardList/cardlist/weblist?page=N     -> ids + imagen por página (paginado)
 *   - cardList/cardlist/webInfo/{id}       -> detalle completo por carta
 *
 * Este módulo es la extracción reutilizable de scripts/scrape-onepiece-cardlist-cn.ts
 * (script original, escrito para correrse a mano) — mismo comportamiento,
 * ahora expuesto como runCnSync() para poder llamarlo también desde un cron.
 * El campo cardOfferType de cada carta trae el código del producto entre
 * corchetes 【...】 (mismo formato que JP/EN/FR), salvo para las páginas
 * "bolsa de promos" (宣传卡, 限定商品收录卡牌...) que no tienen corchete —
 * esas quedan enlazadas por título, no por código.
 */

export type OfferTypeEntry = {
  offerType: string;
  setCode: string | null;
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

export type CnSyncOptions = {
  dryRun: boolean;
  updateExisting: boolean;
  limit: number | null;
  region: string;
  language: string;
  markExclusive: boolean;
  offerTypeFilter: string[] | null;
  offerTypePattern: string | null;
  offerTypeOrder: "asc" | "desc";
  offerTypeOrderProvided: boolean;
  setFilter: string[] | null;
  onlyIds: string[] | null;
  linkByCardSetCode: boolean;
  forceAlternates: boolean;
  promoteAlternateToBase: boolean;
  overrideSetCode: boolean;
  emptySetCode: boolean;
  backfillCardSource: boolean;
  ensureSetId: number | null;
  cleanupDuplicates: boolean;
};

export const DEFAULT_CN_SYNC_OPTIONS: CnSyncOptions = {
  dryRun: false,
  updateExisting: false,
  limit: null,
  region: "CN",
  language: "zh",
  markExclusive: false,
  offerTypeFilter: null,
  offerTypePattern: null,
  offerTypeOrder: "desc",
  offerTypeOrderProvided: false,
  setFilter: null,
  onlyIds: null,
  linkByCardSetCode: false,
  forceAlternates: false,
  promoteAlternateToBase: false,
  overrideSetCode: false,
  emptySetCode: false,
  backfillCardSource: false,
  ensureSetId: null,
  cleanupDuplicates: true,
};

export type CnSyncSummary = {
  offerTypesProcessed: number;
  cardsProcessed: number;
  created: number;
  updated: number;
  skippedExisting: number;
  missingUsBase: Array<{ id: string; code: string; set: string }>;
  missingImages: Array<{ id: string; url: string }>;
  networkErrors: Array<{ id: string; url: string; code?: string }>;
  unresolvedAlternates: number;
};

type CardListResponse = {
  code: number;
  msg: string;
  page: {
    currPage: number;
    totalPage: number;
    pageSize: number;
    totalCount: number;
    list: { id: number; cardImg: string }[];
  };
};

type CardInfoResponse = {
  code: number;
  msg: string;
  info: {
    id: number;
    cardName: string;
    cardTextDesc: string | null;
    cardType: string;
    cardCartograph: string | null;
    cardColor: string | string[] | null;
    cardAttribute: string[] | null;
    cardLife: string | number | null;
    cardAttack: string | number | null;
    cardTrigger: string | null;
    cardImg: string;
    cardRarity: string | null;
    cardOfferType: string | null;
    cardPower: string | number | null;
    cardFeatures: string | string[] | null;
    cardNumber: string;
    subscript?: number | string | null;
  };
};

type OfferTypeResponse = {
  code: number;
  msg: string;
  list: { name: string }[];
};

const BASE_URL = "https://webadmin.windoent.com/front/op-public";
const CARDLIST_PATH = "/cardList/cardlist/weblist";
const CARDINFO_PATH = "/cardList/cardlist/webInfo/";
const OFFER_TYPE_PATH = "/cardType/cardofferingtype/cachelist";

const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: "-tiny" },
  xs: { width: 100, height: 140, quality: 60, suffix: "-xs" },
  thumb: { width: 200, height: 280, quality: 70, suffix: "-thumb" },
  small: { width: 300, height: 420, quality: 75, suffix: "-small" },
  medium: { width: 600, height: 840, quality: 80, suffix: "-medium" },
  large: { width: 800, height: 1120, quality: 85, suffix: "-large" },
  original: { width: null, height: null, quality: 90, suffix: "" },
} as const;

const CATEGORY_MAP: Record<string, string> = {
  领袖: "Leader",
  角色: "Character",
  事件: "Event",
  舞台: "Stage",
  DON: "DON",
};

const COLOR_MAP: Record<string, string> = {
  红: "red",
  蓝: "blue",
  绿: "green",
  紫: "purple",
  黑: "black",
  黄: "yellow",
};

const ATTRIBUTE_MAP: Record<string, string> = {
  斩: "Slash",
  打: "Strike",
  知: "Wisdom",
  射: "Ranged",
  特: "Special",
};

const RARITY_FALLBACKS: Array<[RegExp, string]> = [
  [/领袖|LEADER/i, "Leader"],
  [/普通|C\b/i, "Common"],
  [/不凡|UC\b/i, "Uncommon"],
  [/稀有|R\b/i, "Rare"],
  [/超稀有|SR\b/i, "Super Rare"],
  [/秘密|SEC\b/i, "Secret Rare"],
  [/宣传|推广|P\b/i, "Promo"],
];

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
        code === "EAI_AGAIN" ||
        code === "ECONNABORTED" ||
        code === "ERR_BAD_RESPONSE" ||
        message.toLowerCase().includes("stream has been aborted") ||
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
  for (const [, config] of Object.entries(IMAGE_SIZES)) {
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

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: r2Key,
        Body: transformed,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  }

  return `${publicUrl}/cards/${filename}.webp`;
};

const uploadCardImage = async (
  card: ScrapedCard,
  options: CnSyncOptions,
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

const parseNumericValue = (
  value: string | number | null | undefined
): string | null => {
  if (value === null || value === undefined) return null;
  const match = String(value).replace(/,/g, "").match(/\d+/);
  return match ? match[0] : null;
};

const normalizeSetCodeFromOfferType = (value: string): string | null => {
  const match = value.match(/【([^】]+)】/);
  if (!match) return null;
  const raw = match[1].trim().toUpperCase();
  if (!raw) return null;
  return raw.replace(/C-/g, "").replace(/-/g, "");
};

const splitBySlash = (
  value: string | string[] | null | undefined
): string[] => {
  if (!value) return [];
  // La API es inconsistente entre cartas: cardColor/cardFeatures vienen a
  // veces como string "红/蓝" y a veces como array ["红"] ya parseado.
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return value
    .split(/[/／]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeRarity = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  for (const [pattern, label] of RARITY_FALLBACKS) {
    if (pattern.test(trimmed)) return label;
  }
  return trimmed;
};

const CARD_CODE_REGEX = /(?:OP|ST|EB|PRB)\d{2}-\d{3}|P-\d{3,4}/i;

const normalizeVariantSuffix = (value: string) => {
  if (!value) return null;
  let normalized = value.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  normalized = normalized.replace(/^[^a-z0-9]+/gi, "");
  normalized = normalized.replace(/[^a-z0-9]+/gi, "");
  return normalized ? normalized.toUpperCase() : null;
};

const extractFromText = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  const match = normalized.match(CARD_CODE_REGEX);
  if (!match) return null;
  const baseCode = match[0];
  const suffix = normalized.slice((match.index ?? 0) + baseCode.length);
  const variantKey = normalizeVariantSuffix(suffix);
  return { baseCode, variantKey };
};

const extractFromImage = (cardImg: string) => {
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
  const direct = extractFromText(filename);
  if (direct) return direct;
  const normalized = filename.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  const specialMatch = normalized.match(
    /O[_-]?(\d{3,4})-(\d{3})(?:[_-]([A-Za-z0-9]+))?/i
  );
  if (!specialMatch) return null;
  const setDigits = specialMatch[1];
  const cardNumber = specialMatch[2];
  const variant = specialMatch[3] ?? null;
  const setSuffix = setDigits.slice(-2);
  const baseCode = `OP${setSuffix}-${cardNumber}`;
  return {
    baseCode,
    variantKey: variant ? normalizeVariantSuffix(variant) : null,
  };
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
};

const parseCardIdentifiers = (rawCode: string, cardImg: string) => {
  const imageMatch = extractFromImage(cardImg);
  const rawMatch = extractFromText(rawCode);
  if (imageMatch) {
    return {
      baseCode: imageMatch.baseCode,
      variantKey: imageMatch.variantKey ?? rawMatch?.variantKey ?? null,
    };
  }
  if (rawMatch) return rawMatch;
  return { baseCode: rawCode.trim().toUpperCase(), variantKey: null };
};

const parseCardInfo = (
  info: CardInfoResponse["info"],
  setFilter: Set<string> | null,
  options: CnSyncOptions,
  cardImgOverride?: string | null
): ScrapedCard | null => {
  const rawCode = info.cardNumber?.trim();
  if (!rawCode) return null;
  const cardImg = cardImgOverride ?? info.cardImg ?? "";
  const parsedCode = parseCardIdentifiers(rawCode, cardImg);
  const baseCode = parsedCode.baseCode;
  if (!baseCode) return null;

  const setCode = options.emptySetCode ? "" : baseCode.split("-")[0];
  if (setFilter && !setFilter.has(setCode.toUpperCase())) {
    return null;
  }

  let variantKey = parsedCode.variantKey;
  if (options.forceAlternates && !variantKey) {
    variantKey = `ALT${hashString(`${baseCode}-${info.cardImg || ""}`)}`;
  }
  const isAlternate = options.forceAlternates ? true : Boolean(variantKey);
  const id = variantKey ? `${baseCode}_${variantKey}` : baseCode;

  const category = CATEGORY_MAP[info.cardType] || info.cardType || "Character";
  const rarity = normalizeRarity(info.cardRarity);

  const costNumber =
    category === "Leader" ? null : parseNumericValue(info.cardLife);
  const lifeNumber =
    category === "Leader" ? parseNumericValue(info.cardLife) : null;
  const counterNumber = parseNumericValue(info.cardAttack);
  const powerNumber = parseNumericValue(info.cardPower);

  const colors = splitBySlash(info.cardColor).map(
    (color) => COLOR_MAP[color] || color.toLowerCase()
  );
  const types = splitBySlash(info.cardFeatures);
  const attributes = info.cardAttribute ?? [];
  const attribute = attributes.length
    ? ATTRIBUTE_MAP[attributes[0]] || null
    : null;

  const text = info.cardTextDesc
    ? info.cardTextDesc.replace(/\s+/g, " ").trim()
    : null;
  const trigger = info.cardTrigger
    ? String(info.cardTrigger).replace(/\s+/g, " ").trim()
    : null;

  const order = variantKey ?? "0";
  const alias = variantKey ?? "0";

  const sourceId = info.id ? String(info.id) : null;

  return {
    id,
    baseCode,
    isAlternate,
    variantKey,
    originTitle: info.cardOfferType?.trim() || null,
    sourceId,
    name: info.cardName?.trim() ?? "",
    rarity,
    category,
    cost: costNumber ? `${costNumber} Cost` : null,
    power: powerNumber ? `${powerNumber} Power` : null,
    attribute,
    counter: counterNumber ? `+${counterNumber} Counter` : null,
    life: lifeNumber ? `${lifeNumber} Life` : null,
    colors,
    types,
    text,
    trigger,
    imageUrl: cardImg || info.cardImg,
    setCode,
    order,
    alias,
  };
};

const fetchOfferTypes = async (): Promise<OfferTypeEntry[]> => {
  const response = await axios.get<OfferTypeResponse>(
    `${BASE_URL}${OFFER_TYPE_PATH}`
  );
  const list = response.data.list ?? [];
  return list
    .map((item) => item.name?.trim())
    .filter(Boolean)
    .map((offerType) => ({
      offerType,
      setCode: normalizeSetCodeFromOfferType(offerType),
    }));
};

const fetchCardListPage = async (
  offerType: string | null,
  page: number,
  limit: number
): Promise<CardListResponse> => {
  const params: Record<string, string | number> = { page, limit };
  if (offerType) params.cardOfferType = offerType;
  const response = await axios.get<CardListResponse>(
    `${BASE_URL}${CARDLIST_PATH}`,
    { params }
  );
  return response.data;
};

const fetchCardInfo = async (
  id: number
): Promise<CardInfoResponse["info"] | null> => {
  const response = await axios.get<CardInfoResponse>(
    `${BASE_URL}${CARDINFO_PATH}${id}`
  );
  if (response.data.code !== 0) return null;
  return response.data.info ?? null;
};

const resolveOfferTypeList = (
  offerTypes: OfferTypeEntry[],
  options: CnSyncOptions
): OfferTypeEntry[] => {
  let list = offerTypes;
  if (options.offerTypeFilter?.length) {
    const filterSet = new Set(options.offerTypeFilter);
    list = list.filter((entry) => filterSet.has(entry.offerType));
  }
  if (options.offerTypePattern) {
    const regex = new RegExp(options.offerTypePattern, "i");
    list = list.filter((entry) => regex.test(entry.offerType));
  }
  if (options.setFilter?.length) {
    const normalizedOrder = options.setFilter.map((value) =>
      value.toUpperCase()
    );
    const filterSet = new Set(normalizedOrder);
    list = list
      .filter((entry) =>
        entry.setCode ? filterSet.has(entry.setCode.toUpperCase()) : false
      )
      .sort(
        (a, b) =>
          normalizedOrder.indexOf(a.setCode?.toUpperCase() ?? "") -
          normalizedOrder.indexOf(b.setCode?.toUpperCase() ?? "")
      );
  }
  if (!options.offerTypeOrderProvided) {
    const priorityOrder = ["OP", "ST", "EB", "PRB"];
    const parseNumericSuffix = (value: string | null) => {
      if (!value) return null;
      const match = value.match(/(\d+)\s*$/);
      return match ? Number(match[1]) : null;
    };
    list = [...list].sort((a, b) => {
      const aCode = a.setCode?.toUpperCase() ?? "";
      const bCode = b.setCode?.toUpperCase() ?? "";
      const aPrefix = aCode.slice(0, 3);
      const bPrefix = bCode.slice(0, 3);
      const aPriority = priorityOrder.includes(aPrefix)
        ? priorityOrder.indexOf(aPrefix)
        : priorityOrder.length;
      const bPriority = priorityOrder.includes(bPrefix)
        ? priorityOrder.indexOf(bPrefix)
        : priorityOrder.length;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aNum =
        parseNumericSuffix(aCode) ?? parseNumericSuffix(a.offerType) ?? null;
      const bNum =
        parseNumericSuffix(bCode) ?? parseNumericSuffix(b.offerType) ?? null;
      if (aNum !== null && bNum !== null && aNum !== bNum) return aNum - bNum;
      const aLabel = aCode || a.offerType;
      const bLabel = bCode || b.offerType;
      return aLabel.localeCompare(bLabel, "en", { numeric: true });
    });
  } else if (
    options.offerTypeOrder === "asc" ||
    options.offerTypeOrder === "desc"
  ) {
    const direction = options.offerTypeOrder === "asc" ? 1 : -1;
    const parseNumericSuffix = (value: string | null) => {
      if (!value) return null;
      const match = value.match(/(\d+)\s*$/);
      return match ? Number(match[1]) : null;
    };
    list = [...list].sort((a, b) => {
      const aCode = a.setCode?.toUpperCase() ?? "";
      const bCode = b.setCode?.toUpperCase() ?? "";
      const aNum =
        parseNumericSuffix(aCode) ?? parseNumericSuffix(a.offerType) ?? null;
      const bNum =
        parseNumericSuffix(bCode) ?? parseNumericSuffix(b.offerType) ?? null;
      if (aNum !== null && bNum !== null && aNum !== bNum) {
        return (aNum - bNum) * direction;
      }
      const aLabel = aCode || a.offerType;
      const bLabel = bCode || b.offerType;
      return aLabel.localeCompare(bLabel, "en", { numeric: true }) * direction;
    });
  }
  return list;
};

const fetchOfferTypeCards = async (
  offerType: string | null,
  options: CnSyncOptions
): Promise<ScrapedCard[]> => {
  const cards: ScrapedCard[] = [];
  const setFilter = options.setFilter?.length
    ? new Set(options.setFilter.map((value) => value.toUpperCase()))
    : null;
  const onlyIds = options.onlyIds?.length
    ? new Set(options.onlyIds.map((value) => value.trim()))
    : null;
  const pageSize = 50;
  let page = 1;
  let totalPage = 1;

  while (page <= totalPage) {
    const listResponse = await fetchCardListPage(offerType, page, pageSize);
    totalPage = listResponse.page?.totalPage ?? 1;
    const listItems = listResponse.page?.list ?? [];
    for (let i = 0; i < listItems.length; i += 5) {
      const batch = listItems.slice(i, i + 5);
      const infos = await Promise.all(
        batch.map(async (item) => ({
          info: await fetchCardInfo(item.id),
          cardImg: item.cardImg,
        }))
      );
      for (const entry of infos) {
        const info = entry.info;
        if (!info) continue;
        const parsed = parseCardInfo(info, setFilter, options, entry.cardImg);
        if (parsed) cards.push(parsed);
      }
    }
    page += 1;
  }

  if (!onlyIds) return cards;
  return cards.filter(
    (card) =>
      onlyIds.has(card.id) ||
      onlyIds.has(card.baseCode) ||
      (card.variantKey && onlyIds.has(`${card.baseCode}_${card.variantKey}`))
  );
};

const resolveSetId = async (setCode: string, region?: string | null) => {
  const set = await prisma.set.findFirst({
    where: {
      code: { equals: setCode, mode: "insensitive" },
      region: region ?? undefined,
    },
    select: { id: true },
  });
  return set?.id ?? null;
};

const SPECIAL_OFFER_TYPE_TITLES: Record<string, string> = {
  宣传卡: "Promotional Card",
  限定商品收录卡牌: "Limited Edition",
  豪华训练套装: "Luxury Training Set",
  对战进阶套组2025: "Advanced Battle Sets 2025",
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
        { originalTitle: { equals: title, mode: "insensitive" } },
        { title: { equals: title, mode: "insensitive" } },
      ],
    },
    select: { id: true, originalTitle: true, translatedTitle: true },
  });
  if (existing?.id) {
    const updates: { originalTitle?: string; translatedTitle?: string } = {};
    if (!existing.originalTitle) updates.originalTitle = title;
    if (translatedTitle && !existing.translatedTitle) {
      updates.translatedTitle = translatedTitle;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.set.update({ where: { id: existing.id }, data: updates });
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
    where: { code: baseCode, isFirstEdition: true, region: { not: region } },
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

/** Estado por-corrida: contadores + listas de fallos, para el summary. */
class CnSyncRun {
  missingImages: Array<{ id: string; url: string }> = [];
  missingImagesLookup = new Set<string>();
  networkErrors: Array<{ id: string; url: string; code?: string }> = [];
  missingUsBaseCards: Array<{ id: string; code: string; set: string }> = [];
  missingUsBaseLookup = new Set<string>();
  missingSetId: number | null = null;
  created = 0;
  updated = 0;
  skippedExisting = 0;
  cardsProcessed = 0;

  addMissingImage(entry: { id: string; url: string }) {
    const key = `${entry.id}::${entry.url}`;
    if (this.missingImagesLookup.has(key)) return;
    this.missingImagesLookup.add(key);
    this.missingImages.push(entry);
  }

  async ensureMissingSet() {
    if (this.missingSetId) return this.missingSetId;
    const existing = await prisma.set.findFirst({
      where: { title: { equals: "Missing", mode: "insensitive" } },
      select: { id: true },
    });
    if (existing?.id) {
      this.missingSetId = existing.id;
      return this.missingSetId;
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
    this.missingSetId = created.id;
    return this.missingSetId;
  }
}

const ensureCardSource = async (
  cardId: number,
  card: ScrapedCard
) => {
  if (!card.sourceId || !card.imageUrl) return;
  const existingExact = await prisma.cardSource.findFirst({
    where: {
      source: "CN",
      sourceId: card.sourceId,
      sourceImageUrl: card.imageUrl,
    },
    select: { id: true },
  });

  if (existingExact) {
    await prisma.cardSource.update({
      where: { id: existingExact.id },
      data: { cardId, offerType: card.originTitle ?? undefined },
    });
    return;
  }

  const existingEmpty = await prisma.cardSource.findFirst({
    where: { source: "CN", sourceId: card.sourceId, sourceImageUrl: null },
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
      source: "CN",
      sourceId: card.sourceId,
      sourceImageUrl: card.imageUrl,
      offerType: card.originTitle,
    },
  });
};

export const cleanupDuplicateSources = async (
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
    where: { source, sourceImageUrl: { not: null }, card: { region } },
    select: {
      cardId: true,
      sourceImageUrl: true,
      card: { select: { id: true, isFirstEdition: true } },
    },
  });

  type SourceRow = (typeof rows)[number];
  const groups = new Map<string, SourceRow[]>();
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

  for (const [imageUrl, entries] of Array.from(groups.entries())) {
    const base = entries.find((entry: SourceRow) => entry.card?.isFirstEdition);
    if (!base) continue;
    const baseId = base.cardId;
    const alternates = entries.filter(
      (entry: SourceRow) => entry.cardId !== baseId
    );
    if (!alternates.length) continue;

    for (const alt of alternates) {
      if (dryRun) {
        console.log(
          `[cleanup][dry-run] image=${imageUrl} base=${baseId} drop=${alt.cardId}`
        );
        continue;
      }

      await prisma.cardSource.updateMany({
        where: { cardId: alt.cardId, source, sourceImageUrl: imageUrl },
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
    where: { region, isFirstEdition: true, sources: { none: {} } },
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
      select: { id: true, sources: { select: { id: true, sourceImageUrl: true } } },
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

  console.log(
    `[cleanup][${dryRun ? "dry-run" : "done"}] promotedBases=${promoted} removed=${removed} skipped=${skipped} reassignedBaseSources=${reassigned}`
  );
};

const upsertCard = async (
  card: ScrapedCard,
  options: CnSyncOptions,
  setIds: number[],
  run: CnSyncRun,
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

    if (!existing) return null;
    if (options.dryRun) return existing.id;
    await ensureCardSource(existing.id, card);
    return existing.id;
  }

  const existing = await prisma.card.findFirst({
    where: {
      code: card.baseCode,
      region: options.region,
      isFirstEdition: card.isAlternate ? false : true,
      ...(card.isAlternate ? { alias: card.alias } : {}),
    },
    select: { id: true, baseCardId: true },
  });

  if (existing && !options.updateExisting) {
    if (setIds.length) await ensureCardSetLinks(existing.id, setIds);
    await ensureCardSource(existing.id, card);
    run.skippedExisting += 1;
    return existing.id;
  }

  const baseCardId = card.isAlternate
    ? baseCardIdOverride ??
      existing?.baseCardId ??
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
    return null;
  }

  const isRegionalExclusive = options.markExclusive
    ? await checkRegionalExclusive(card.baseCode, options.region)
    : false;

  const usBaseCard = await prisma.card.findFirst({
    where: { code: card.baseCode, isFirstEdition: true, region: "US" },
    include: {
      colors: true,
      types: true,
      effects: true,
      conditions: true,
      texts: true,
      rulings: true,
    },
  });

  if (!usBaseCard) {
    if (!run.missingUsBaseLookup.has(card.id)) {
      run.missingUsBaseLookup.add(card.id);
      run.missingUsBaseCards.push({
        id: card.id,
        code: card.baseCode,
        set: card.setCode,
      });
    }
    return null;
  }

  const relationColors = usBaseCard.colors.map((item) => item.color) ?? card.colors;
  const relationTypes = usBaseCard.types.map((item) => item.type) ?? card.types;
  const relationEffects = usBaseCard.effects.map((item) => item.effect) ?? [];
  const relationConditions =
    usBaseCard.conditions.map((item) => item.condition) ?? [];
  const relationTexts =
    usBaseCard.texts.map((item) => item.text) ?? (card.text ? [card.text] : []);

  if (options.dryRun) {
    if (existing) run.updated += 1;
    else run.created += 1;
    return existing?.id ?? null;
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
      run.addMissingImage({ id: card.id, url: card.imageUrl });
      uploadedSrc = card.imageUrl;
      imageKey = null;
    } else {
      const code = error?.code;
      const message =
        typeof error?.message === "string" ? error.message.toLowerCase() : "";
      if (
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "EAI_AGAIN" ||
        code === "ECONNABORTED" ||
        code === "ERR_BAD_RESPONSE" ||
        message.includes("stream has been aborted")
      ) {
        run.networkErrors.push({ id: card.id, url: card.imageUrl, code });
        run.addMissingImage({ id: card.id, url: card.imageUrl });
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
      colors: { deleteMany: {}, create: relationColors.map((color) => ({ color })) },
      types: { deleteMany: {}, create: relationTypes.map((type) => ({ type })) },
      texts: { deleteMany: {}, create: relationTexts.map((text) => ({ text })) },
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
    if (setIds.length) await ensureCardSetLinks(updated.id, setIds);
    await prisma.card.update({
      where: { id: updated.id },
      data: {
        collectionOrder: buildCollectionOrder({
          id: updated.id,
          code: card.baseCode,
          category: usBaseCard.category,
          baseCardId: card.isAlternate ? baseCardId ?? null : null,
          order: card.order,
        }),
      },
    });
    run.updated += 1;
    return updated.id;
  }

  const createData = {
    ...baseData,
    colors: { create: relationColors.map((color) => ({ color })) },
    types: { create: relationTypes.map((type) => ({ type })) },
    texts: { create: relationTexts.map((text) => ({ text })) },
    effects: { create: relationEffects.map((effect) => ({ effect })) },
    conditions: { create: relationConditions.map((condition) => ({ condition })) },
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

  const created = await prisma.card.create({ data: createData, select: { id: true } });
  await ensureCardSource(created.id, card);
  if (setIds.length) await ensureCardSetLinks(created.id, setIds);
  await prisma.card.update({
    where: { id: created.id },
    data: {
      collectionOrder: buildCollectionOrder({
        id: created.id,
        code: card.baseCode,
        category: usBaseCard.category,
        baseCardId: card.isAlternate ? baseCardId ?? null : null,
        order: card.order,
      }),
    },
  });
  run.created += 1;
  return created.id;
};

/**
 * Corre la sincronización completa (o filtrada por opts) contra el catálogo
 * CN. Reutilizable desde el script CLI y desde el cron — cada llamada usa su
 * propio `CnSyncRun` (contadores/listas de fallos aislados, sin estado de
 * módulo compartido entre corridas).
 */
export async function runCnSync(
  opts: Partial<CnSyncOptions> = {}
): Promise<CnSyncSummary> {
  const options: CnSyncOptions = { ...DEFAULT_CN_SYNC_OPTIONS, ...opts };
  const run = new CnSyncRun();

  const s3Client = options.dryRun ? null : createS3Client();
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  const offerTypes = await fetchOfferTypes();
  const offerTypeList = resolveOfferTypeList(offerTypes, options);

  const unresolvedAlternates: ScrapedCard[] = [];
  let offerTypesProcessed = 0;

  outer: for (const entry of offerTypeList) {
    offerTypesProcessed += 1;
    console.log(`\n[offer-type] ${entry.offerType}`);
    const cards = await fetchOfferTypeCards(entry.offerType, options);
    const normalizedCards =
      options.overrideSetCode && entry.setCode
        ? cards.map((card) => ({ ...card, setCode: entry.setCode ?? card.setCode }))
        : cards;

    const bases = normalizedCards
      .filter((card) => !card.isAlternate)
      .sort((a, b) => a.baseCode.localeCompare(b.baseCode));
    const alternates = normalizedCards
      .filter((card) => card.isAlternate)
      .sort((a, b) => a.baseCode.localeCompare(b.baseCode));

    const setIdByCode = new Map<string, number | null>();
    const resolveSetIdCached = async (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (setIdByCode.has(normalized)) return setIdByCode.get(normalized) ?? null;
      const resolved = await resolveSetId(normalized, options.region);
      if (!resolved) {
        const fallbackId = await run.ensureMissingSet();
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
      const translatedTitle = SPECIAL_OFFER_TYPE_TITLES[normalized];
      const resolved = await ensureSetForTitle(
        normalized,
        options.region ?? null,
        translatedTitle ?? null
      );
      setIdByOriginTitle.set(normalized, resolved ?? null);
      return resolved ?? null;
    };

    const buildSetIds = (originSetId: number | null, resolvedSetId: number | null) => {
      const merged = [originSetId, resolvedSetId, options.ensureSetId].filter(
        (value): value is number => Boolean(value)
      );
      return Array.from(new Set(merged));
    };

    const baseCardIdByCode = new Map<string, number>();

    for (const card of bases) {
      if (options.limit && run.cardsProcessed >= options.limit) break outer;
      run.cardsProcessed += 1;
      const originTitle = card.originTitle?.trim() || entry.offerType?.trim() || null;
      const originSetId = await resolveOriginSetId(originTitle);
      const resolvedSetId = options.linkByCardSetCode
        ? await resolveSetIdCached(card.setCode)
        : null;
      const setIds = buildSetIds(originSetId, resolvedSetId);
      const id = await upsertCard(
        card,
        options,
        setIds,
        run,
        null,
        s3Client ?? undefined,
        bucketName,
        publicUrl
      );
      if (id) baseCardIdByCode.set(card.baseCode, id);
    }

    const pendingAlternates: Array<{ card: ScrapedCard; setIds: number[] }> = [];

    const promoteAlternate = async (
      card: ScrapedCard,
      setIds: number[]
    ): Promise<number | null> => {
      if (!options.promoteAlternateToBase) return null;
      const promoted: ScrapedCard = {
        ...card,
        id: card.baseCode,
        isAlternate: false,
        variantKey: null,
        alias: "0",
        order: "0",
      };
      const createdId = await upsertCard(
        promoted,
        options,
        setIds,
        run,
        null,
        s3Client ?? undefined,
        bucketName,
        publicUrl
      );
      if (createdId) baseCardIdByCode.set(card.baseCode, createdId);
      return createdId;
    };

    for (const card of alternates) {
      if (options.limit && run.cardsProcessed >= options.limit) break outer;
      run.cardsProcessed += 1;
      let baseCardIdOverride = baseCardIdByCode.get(card.baseCode) ?? null;
      const originTitle = card.originTitle?.trim() || entry.offerType?.trim() || null;
      const originSetId = await resolveOriginSetId(originTitle);
      const resolvedSetId = options.linkByCardSetCode
        ? await resolveSetIdCached(card.setCode)
        : null;
      const setIds = buildSetIds(originSetId, resolvedSetId);
      if (!baseCardIdOverride) {
        const existingBase = await prisma.card.findFirst({
          where: { code: card.baseCode, region: options.region, isFirstEdition: true },
          select: { id: true },
        });
        if (existingBase?.id) {
          baseCardIdOverride = existingBase.id;
          baseCardIdByCode.set(card.baseCode, existingBase.id);
        }
      }
      if (!baseCardIdOverride) {
        const promotedId = await promoteAlternate(card, setIds);
        if (!promotedId) {
          pendingAlternates.push({ card, setIds });
          continue;
        }
        continue;
      }

      await upsertCard(
        card,
        options,
        setIds,
        run,
        baseCardIdOverride,
        s3Client ?? undefined,
        bucketName,
        publicUrl
      );
    }

    for (const pending of pendingAlternates) {
      const { card, setIds } = pending;
      let baseCardIdOverride = baseCardIdByCode.get(card.baseCode) ?? null;
      if (!baseCardIdOverride) {
        const existingBase = await prisma.card.findFirst({
          where: { code: card.baseCode, region: options.region, isFirstEdition: true },
          select: { id: true },
        });
        if (existingBase?.id) {
          baseCardIdOverride = existingBase.id;
          baseCardIdByCode.set(card.baseCode, existingBase.id);
        }
      }
      if (!baseCardIdOverride) {
        const promotedId = await promoteAlternate(card, setIds);
        if (!promotedId) {
          unresolvedAlternates.push(card);
          continue;
        }
        continue;
      }
      await upsertCard(
        card,
        options,
        setIds,
        run,
        baseCardIdOverride,
        s3Client ?? undefined,
        bucketName,
        publicUrl
      );
    }
  }

  if (options.cleanupDuplicates) {
    await cleanupDuplicateSources("CN", options.region, options.dryRun);
  }

  return {
    offerTypesProcessed,
    cardsProcessed: run.cardsProcessed,
    created: run.created,
    updated: run.updated,
    skippedExisting: run.skippedExisting,
    missingUsBase: run.missingUsBaseCards,
    missingImages: run.missingImages,
    networkErrors: run.networkErrors,
    unresolvedAlternates: unresolvedAlternates.length,
  };
}
