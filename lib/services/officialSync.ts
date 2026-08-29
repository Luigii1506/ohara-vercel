import axios from "axios";
import * as cheerio from "cheerio";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import {
  officialVariantTokens,
  normalizeOfficialVariantToken,
  inferOfficialVariantCode,
} from "@/lib/cards/officialVariant";

/**
 * Sincronización con los sitios OFICIALES (plataforma Bandai): en/asia-en/jp/fr.
 * Escanea una región, compara contra la BD y arma una cola de revisión
 * (OfficialSyncItem). Al "Aceptar" un item, sube la carta (BD + R2).
 */

export const OFFICIAL_REGIONS: Record<
  string,
  {
    baseUrl: string;
    region: string;
    // Región REAL de la carta física a crear/enlazar, si es distinta de
    // `region` (que solo identifica la fuente/serie escaneada para la cola).
    // EN (en.onepiece-cardgame.com) es el catálogo oficial "mundial", pero
    // las cartas físicas que representa SON las de EE.UU. — deben enlazarse
    // a la carta base region=US existente, no crear una región "EN" aparte.
    cardRegion?: string;
    language: string;
    label: string;
  }
> = {
  EN: { baseUrl: "https://en.onepiece-cardgame.com", region: "EN", cardRegion: "US", language: "en", label: "Inglés (mundial)" },
  "ASIA-EN": { baseUrl: "https://asia-en.onepiece-cardgame.com", region: "ASIA-EN", language: "en", label: "Inglés (Asia)" },
  JP: { baseUrl: "https://www.onepiece-cardgame.com", region: "JP", language: "ja", label: "Japonés" },
  FR: { baseUrl: "https://fr.onepiece-cardgame.com", region: "FR", language: "fr", label: "Francés" },
  // Chino tradicional (Taiwán/HK/Macao) — misma plataforma HTML que
  // JP/EN/FR (mismo dl.modalCol, mismos corchetes 【】, rareza/categoría ya
  // en inglés en .infoCol). Región de carta REAL "TC", distinta de "CN"
  // (simplificado/continental, plataforma y catálogo totalmente aparte) —
  // no es un alias de otra región existente.
  "ASIA-TC": { baseUrl: "https://asia-tc.onepiece-cardgame.com", region: "ASIA-TC", cardRegion: "TC", language: "zh-Hant", label: "Chino tradicional (Asia)" },
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
  TR: "Treasure Rare",
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
  attribute: string | null;
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
  const map = new Map<
    string,
    { series: string; setCode: string; label: string; hasBracketCode: boolean }
  >();
  $("option").each((_, el) => {
    const series = ($(el).attr("value") || "").trim();
    if (!/^\d+$/.test(series)) return;
    const label = $(el).text().replace(/\s+/g, " ").trim();
    // JP usa corchetes de ancho completo 【...】 en vez de ASCII [...] — sin
    // aceptar ambos, esto nunca matchea para JP y s.setCode cae siempre al
    // label completo (mezcla de texto japonés), perdiendo la única señal
    // confiable de "esta serie es la página propia y dedicada de este set"
    // (ver el filtro de series "bundle"/bolsa-de-promos más abajo).
    const m = label.match(/[\[【]([^\]】]+)[\]】]/);
    map.set(series, {
      series,
      setCode: m ? m[1].trim() : label,
      label,
      hasBracketCode: Boolean(m),
    });
  });
  return Array.from(map.values());
}

export async function fetchOfficialCards(
  baseUrl: string,
  series: string,
  seriesLabel: string,
  // Código de la SERIE (ej. "PRB-01", "ST-31"), solo cuando esa página tiene
  // su propio corchete de producto dedicado (`hasBracketCode`). Sin esto, una
  // carta escaneada de una página promo/bonus (una reimpresión especial de un
  // starter deck que sale en un booster distinto, o un alt-art de evento)
  // quedaba con `setCode = code.split("-")[0]` — el prefijo de SU PROPIO
  // código — asignándole siempre el set base de origen aunque la página real
  // de la que se scrapeó sea un producto totalmente distinto (ver ST31-004:
  // el especial que sale en OP17 se filiaba mal como si fuera "Romance Dawn").
  seriesSetCode?: string,
  seriesHasBracketCode?: boolean
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
    const attributeRaw =
      $m.find(".attribute img").attr("alt")?.trim() ||
      norm($m.find(".attribute").text(), $m.find(".attribute h3").text().trim());
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
      // La página de la que se scrapeó SÍ tiene su propio código de producto
      // dedicado (bracket) -> usarlo, es la señal correcta de "de qué caja
      // física viene este print exacto". Si no (una página bolsa-de-promos
      // sin bracket propio), no hay mejor señal que el prefijo del código de
      // la carta.
      setCode:
        seriesHasBracketCode && seriesSetCode
          ? seriesSetCode.replace(/-/g, "").toUpperCase()
          : code.split("-")[0],
      seriesLabel,
      // ASIA-TC trae la rareza con texto pegado (ej. "SP卡" = "SP" + 卡
      // "carta") en vez del código limpio que usan JP/EN/FR — se toma solo
      // el prefijo de letras ASCII antes de buscar en RARITY_MAP.
      rarity: rarityRaw
        ? RARITY_MAP[(rarityRaw.match(/^[A-Za-z]+/)?.[0] ?? rarityRaw).toUpperCase()] ||
          rarityRaw
        : null,
      category: CATEGORY_MAP[categoryRaw.toUpperCase()] || categoryRaw || "Character",
      attribute: attributeRaw || null,
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

  const cardRegion = cfg.cardRegion ?? cfg.region;
  const setRegionWhere =
    cardRegion === "US"
      ? { OR: [{ region: null }, { region: "" }, { region: "US" }] }
      : { region: cardRegion };

  const all: OfficialScrapedCard[] = [];
  // Mejor conteo visto por código, SOLO de series con código propio
  // inequívoco (bracket "[XXX-YY]"/"【XXX-YY】" en su label — así es como el
  // propio sitio oficial identifica "esta página ES el producto XXX-YY", y
  // como el admin verifica a mano: entra a la página de esa serie específica
  // y cuenta). Series SIN código propio se ignoran para este cálculo —
  // suelen ser una bolsa de reimpresiones promocionales sueltas que toca
  // decenas de códigos ajenos con 1-2 cartas cada uno ("プロモーションカード",
  // "限定商品収録カード") o un bundle de varios productos completos juntos
  // (JP "ファミリーデッキセット" combina 3 starter decks) — ninguna de esas
  // dos páginas representa el producto original de ningún Set, contarlas
  // infla el conteo de todo lo que tocan sin que sea un hueco real.
  //
  // Dentro de una serie SÍ dueña de su código se usa `cards.length` TAL
  // CUAL (no filtrado por código de carta) porque el contenido real de un
  // producto no siempre comparte el código de la caja: un starter deck
  // nuevo puede traer 10 cartas reimpresas de sets viejos + 5 exclusivas
  // (ST-19..28), y un booster "CARD THE BEST" son casi puras reimpresiones
  // alternas de docenas de sets distintos (PRB-01/02) — en ambos casos la
  // serie SIGUE siendo la página propia y dedicada de ESE producto.
  const bestByCode = new Map<string, { count: number; seriesId: string }>();

  for (const s of series) {
    try {
      const cards = await fetchOfficialCards(cfg.baseUrl, s.series, s.label, s.setCode, s.hasBracketCode);
      all.push(...cards);

      if (s.hasBracketCode && cards.length) {
        const ownCode = s.setCode.replace(/-/g, "").toUpperCase();
        const prev = bestByCode.get(ownCode);
        if (!prev || cards.length > prev.count) {
          bestByCode.set(ownCode, { count: cards.length, seriesId: s.series });
        }
      }
    } catch {
      // sigue con las demás series
    }
    await sleep(200);
  }

  for (const [setCode, { count, seriesId }] of Array.from(bestByCode.entries())) {
    const matchedSet = await prisma.set.findFirst({
      where: { code: setCode, ...setRegionWhere },
      select: { id: true },
    });
    if (matchedSet) {
      const sourceUrl = `${cfg.baseUrl}${CARDLIST_PATH}?series=${seriesId}`;
      await prisma.setSource.upsert({
        where: { setId_source: { setId: matchedSet.id, source: "official" } },
        create: {
          setId: matchedSet.id,
          source: "official",
          sourceUrl,
          sourceSlug: seriesId,
          declaredCount: count,
          lastCheckedAt: new Date(),
        },
        update: {
          sourceUrl,
          sourceSlug: seriesId,
          declaredCount: count,
          lastCheckedAt: new Date(),
        },
      });
    } else {
      console.warn(
        `[official-sync] no matching Set for code=${setCode} region=${cardRegion}`
      );
    }
  }

  // Comparar contra BD
  const bases = Array.from(new Set(all.map((c) => c.code)));
  const dbRows = await prisma.card.findMany({
    where: { code: { in: bases } },
    select: { code: true, officialVariantCode: true, region: true },
  });
  // "¿ya la tenemos?" tiene que compararse contra la región REAL de la
  // carta que se va a crear (cardRegion), no contra la BD entera — sin
  // esto, escanear una región nueva (p.ej. ASIA-TC, sin ninguna carta
  // propia todavía) marca como "ya la tenemos" cualquier código que ya
  // exista en JP/US/etc., aunque no exista NINGUNA carta de esa región
  // nueva. `codeRegions` es la única excepción: se usa para "exclusive"
  // (¿existe en US?), una comparación cross-región a propósito.
  const cardRegionMatches = (region: string | null) =>
    cardRegion === "US"
      ? region === null || region === "" || region === "US"
      : region === cardRegion;

  const tokensByCode = new Map<string, Set<string>>();
  const codesInDb = new Set<string>();
  const codeRegions = new Map<string, Set<string>>();
  for (const r of dbRows) {
    if (!codeRegions.has(r.code)) codeRegions.set(r.code, new Set());
    if (r.region) codeRegions.get(r.code)!.add(r.region);

    if (!cardRegionMatches(r.region)) continue;
    codesInDb.add(r.code);
    if (!tokensByCode.has(r.code)) tokensByCode.set(r.code, new Set());
    officialVariantTokens(r.officialVariantCode).forEach((t) =>
      tokensByCode.get(r.code)!.add(t)
    );
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
  // Los 7 tamaños son independientes entre sí (mismo buffer de origen,
  // cada uno a su propia key de R2) — generarlos y subirlos en paralelo
  // en vez de uno por uno corta el tiempo por carta varias veces.
  await Promise.all(
    IMAGE_SIZES.map(async (cfg) => {
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
    })
  );
}

async function ensureSet(
  setCode: string,
  region: string,
  seriesLabel?: string | null
): Promise<number | null> {
  if (!setCode) return null;
  // Buscar/crear SIEMPRE dentro de la región de la carta — sin esto, un
  // código que ya existe como Set de OTRA región (p.ej. "OP17" ya creado
  // para US o CN) se reutiliza para todas, mezclando cartas de regiones
  // distintas en el mismo Set.
  const regionWhere =
    region === "US"
      ? { OR: [{ region: null }, { region: "" }, { region: "US" }] }
      : { region };
  const existing = await prisma.set.findFirst({
    where: { code: setCode, ...regionWhere },
    select: { id: true },
  });
  if (existing) return existing.id;
  // El título real (p.ej. "ブースターパック 神の島の冒険【OP-15】") viene del
  // propio label de la serie escaneada — sin él, el Set quedaría con el
  // código pelado como título ("OP15") en vez del nombre real de la página.
  const title = seriesLabel?.trim() || setCode;
  const created = await prisma.set.create({
    data: {
      image: "",
      title,
      code: setCode,
      region: region === "US" ? null : region,
      releaseDate: new Date(0),
      isOpen: false,
    } as never,
    select: { id: true },
  });
  console.log(
    `[ensureSet] Set nuevo creado: code=${setCode} region=${region} title="${title}" (id=${created.id}) — revisar imagen/fecha en /admin/sets`
  );
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

/**
 * Alterna YA EXISTENTE de un código+región para el token de variante dado
 * (ej. "p1"/"r2"), si la hay. La gran mayoría del catálogo pre-existente
 * (import original de TCGplayer) nunca tuvo `officialVariantCode` asignado
 * — comparar solo por ese campo dejaría pasar esas filas como "no existe" y
 * el cron volvería a crear la misma alterna que ya tenemos (la causa real
 * de la duplicación masiva reportada). Por eso, para las filas sin ese
 * campo, se infiere el token desde alias/nombre de archivo del src
 * (`inferOfficialVariantCode` — mismo patrón "_pN"/"_rN" que ya usan estas
 * imágenes) antes de concluir que de verdad falta.
 */
async function findRegionAlternate(
  code: string,
  region: string,
  variantToken: string | null
) {
  if (!variantToken) return null;
  const candidates = await prisma.card.findMany({
    where: { code, region, baseCardId: { not: null } },
    select: { id: true, alias: true, src: true, officialVariantCode: true },
  });
  for (const c of candidates) {
    const token = c.officialVariantCode?.toLowerCase() || inferOfficialVariantCode(c);
    if (token === variantToken) return c;
  }
  return null;
}

type PersistArgs = {
  region: string; // región REAL de la carta (Card.region) — puede diferir de la fuente escaneada
  source: string; // fuente escaneada (CardSource.source), para trazabilidad
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
  const keyBase = imageBase(a.source, a.cardId);
  const resp = await axios.get<ArrayBuffer>(a.imageUrl, {
    responseType: "arraybuffer",
    headers: { "User-Agent": UA, Referer: a.refererBase },
  });
  await uploadVariants(Buffer.from(resp.data), keyBase);
  const src = `${R2_PUBLIC.replace(/\/$/, "")}/cards/${keyBase}.webp`;
  const p = a.payload;
  const setId = await ensureSet(
    a.setCode || a.code.split("-")[0],
    a.region,
    p?.seriesLabel
  );

  // El atributo/color/tipo de una carta no cambia entre regiones (mismo
  // juego, mismas reglas) — si el scrape no trajo attribute (ej. por un
  // layout distinto) pero YA tenemos ese code en otra región, lo reusamos en
  // vez de depender únicamente del scrape de esta página.
  let attribute = p?.attribute ?? null;
  if (!attribute) {
    const sibling = await prisma.card.findFirst({
      where: { code: a.code, attribute: { not: null } },
      select: { attribute: true },
    });
    attribute = sibling?.attribute ?? null;
  }

  const created = await prisma.card.create({
    data: {
      src,
      name: a.name || a.code,
      code: a.code,
      setCode: a.setCode || a.code.split("-")[0],
      category: p?.category || "Character",
      rarity: p?.rarity ?? null,
      attribute,
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
        source: a.source,
        sourceId: a.cardId,
        sourceImageUrl: a.imageUrl,
        cardId: created.id,
      } as never,
    })
    .catch(() => {});
  if (p?.colors?.length) {
    await prisma.cardColor.createMany({
      data: p.colors.map((color) => ({ cardId: created.id, color })),
    });
  }
  if (p?.types?.length) {
    await prisma.cardType.createMany({
      data: p.types.map((type) => ({ cardId: created.id, type })),
    });
  }
  if (p?.text) {
    await prisma.cardText.create({ data: { cardId: created.id, text: p.text } });
  }
  return created.id;
}

/**
 * Aplica un item aceptado. Las alternas se ENLAZAN a la carta base de SU MISMA
 * región (baseCardId); si esa base no existe en la región, se crea primero.
 */
// Sentinel de "procesándose" en appliedCardId — evita que dos clicks (o un
// doble-submit) casi simultáneos sobre el mismo item disparen dos
// persistCard() y creen cartas duplicadas (ver claim más abajo).
const CLAIM_SENTINEL = -1;

export async function applyOfficialItem(
  itemId: number
): Promise<{ cardId: number }> {
  const item = await prisma.officialSyncItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Item no encontrado");
  if (item.decisionStatus === "APPLIED" && item.appliedCardId)
    return { cardId: item.appliedCardId };

  // Reclamar atómicamente: el UPDATE solo afecta una fila si decisionStatus
  // sigue PENDING y nadie más lo reclamó todavía (appliedCardId sigue null).
  // Si dos requests llegan casi juntas, Postgres serializa el UPDATE por fila
  // y la segunda ve appliedCardId ya distinto de null -> count 0.
  const claim = await prisma.officialSyncItem.updateMany({
    where: { id: item.id, decisionStatus: "PENDING", appliedCardId: null },
    data: { appliedCardId: CLAIM_SENTINEL },
  });
  if (claim.count === 0) {
    const fresh = await prisma.officialSyncItem.findUnique({ where: { id: item.id } });
    if (fresh?.decisionStatus === "APPLIED" && fresh.appliedCardId) {
      return { cardId: fresh.appliedCardId };
    }
    throw new Error(
      "Este item ya se está procesando (otro click/pestaña) — esperá unos segundos y refrescá."
    );
  }

  try {
    const p = (item.payload as unknown as OfficialScrapedCard) || null;
    const cfg = OFFICIAL_REGIONS[item.region.toUpperCase()];
    const language = cfg?.language ?? null;
    const refererBase = cfg?.baseUrl ?? "";
    const setCode = item.setCode || item.code.split("-")[0];
    // Región REAL de la carta a crear/enlazar (ej. EN -> US, la carta física
    // ya existente); si no hay override, es la misma región escaneada.
    const cardRegion = cfg?.cardRegion ?? item.region;

    const markApplied = (cardId: number) =>
      prisma.officialSyncItem.update({
        where: { id: item.id },
        data: { decisionStatus: "APPLIED", appliedCardId: cardId },
      });

    // Carta BASE: si ya existe en la región (real) se reusa; si no, se crea.
    if (!item.isAlternate) {
      const existing = await findRegionBase(item.code, cardRegion);
      if (existing) {
        await markApplied(existing.id);
        return { cardId: existing.id };
      }
      const id = await persistCard({
        region: cardRegion, source: item.region, language, code: item.code, setCode,
        cardId: item.code, variant: null, isAlternate: false, baseCardId: null,
        imageUrl: item.imageUrl, name: item.name || item.code, payload: p,
        refererBase,
      });
      await markApplied(id);
      return { cardId: id };
    }

    // ALTERNA: asegurar la base de la región REAL (crearla si falta), luego enlazar.
    let base = await findRegionBase(item.code, cardRegion);
    if (!base) {
      // item.name es el nombre de la ALTERNA (ej. "...(異圖卡)") — nunca hay
      // que ponérselo a esta base "de emergencia" o queda una fila
      // isFirstEdition=true con nombre de alterna. Sin el nombre real de la
      // base (todavía no se escaneó), usamos el código — applyPendingOfficialItems
      // ya serializa los items del mismo código, así que esto solo ocurre
      // cuando la alterna se procesa antes que su base en un batch distinto.
      const baseId = await persistCard({
        region: cardRegion, source: item.region, language, code: item.code, setCode,
        cardId: item.code, variant: null, isAlternate: false, baseCardId: null,
        imageUrl: baseImageUrlFrom(item.imageUrl, item.variant),
        name: item.code, payload: p, refererBase,
      });
      base = { id: baseId };
    }

    // Antes de crear, chequear si esta alterna YA existe (ver
    // findRegionAlternate) — sin esto, cualquier alterna pre-existente sin
    // `officialVariantCode` asignado (la mayoría del catálogo importado de
    // TCGplayer) se vuelve a crear cada vez que el scan la marca como
    // "faltante", generando duplicados.
    const variantToken = normalizeOfficialVariantToken(item.variant);
    const existingAlt = await findRegionAlternate(item.code, cardRegion, variantToken);
    if (existingAlt) {
      if (variantToken && !existingAlt.officialVariantCode) {
        await prisma.card.update({
          where: { id: existingAlt.id },
          data: { officialVariantCode: variantToken },
        });
      }
      await markApplied(existingAlt.id);
      return { cardId: existingAlt.id };
    }

    // Guard de "TCGplayer ya cubre este código" — solo aplica a la región US,
    // donde el mirror local de TCGplayer (TcgCatalogProduct) es la fuente de
    // verdad de cuántos prints reales existen. Si TODOS sus productos para
    // este código ya están vinculados a una Card, esta alterna scrapeada (sin
    // su propio tcgplayerProductId) casi seguro es un re-scrape de algo que
    // ya tenemos bajo otra numeración "p"/"r" — el sitio oficial no numera
    // sus variantes de forma estable entre escaneos, y una misma carta puede
    // aparecer con índices distintos en pasadas distintas, o estar listada en
    // más de una página (ver Vergo OP03-079: "r1"/"r2" resultaron ser el
    // Reprint/Jolly Roger Foil/alterna de ST19 que ya teníamos, confirmado
    // contra TCGplayer). Se deja PENDIENTE para revisión manual en vez de
    // crear otro duplicado.
    if (cardRegion === "US") {
      const tcgProducts = await prisma.tcgCatalogProduct.findMany({
        where: { number: item.code },
        select: { linkedCardId: true },
      });
      if (tcgProducts.length > 0 && tcgProducts.every((prod) => prod.linkedCardId !== null)) {
        throw new Error(
          `TCGplayer ya tiene ${tcgProducts.length} producto(s) para ${item.code}, todos ya vinculados — probable re-scrape duplicado, requiere revisión manual.`
        );
      }
    }

    const altId = await persistCard({
      region: cardRegion, source: item.region, language, code: item.code, setCode,
      cardId: item.cardId, variant: item.variant, isAlternate: true,
      baseCardId: base.id, imageUrl: item.imageUrl,
      name: item.name || item.code, payload: p, refererBase,
    });
    await markApplied(altId);
    return { cardId: altId };
  } catch (e) {
    // Liberar el claim para que se pueda reintentar (si no, quedaría
    // atascado en "procesándose" para siempre tras un error).
    await prisma.officialSyncItem
      .updateMany({
        where: { id: item.id, appliedCardId: CLAIM_SENTINEL },
        data: { appliedCardId: null },
      })
      .catch(() => {});
    throw e;
  }
}

/**
 * Vincula un item de la cola a una carta EXISTENTE (en vez de crear una
 * nueva): solo etiqueta esa carta con el officialVariantCode correcto y
 * marca el item como aplicado. Para cuando el admin ya tiene la carta mismo
 * catalogada de otra forma (alias libre, sin el token oficial).
 */
export async function linkOfficialItemToExistingCard(
  itemId: number,
  existingCardId: number
): Promise<{ cardId: number }> {
  const item = await prisma.officialSyncItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Item no encontrado");
  if (item.decisionStatus === "APPLIED" && item.appliedCardId)
    return { cardId: item.appliedCardId };

  const card = await prisma.card.findUnique({ where: { id: existingCardId } });
  if (!card) throw new Error("Carta no encontrada");
  if (card.code !== item.code) {
    throw new Error(
      `La carta #${existingCardId} es del código ${card.code}, no ${item.code}`
    );
  }

  const officialVariantCode = normalizeOfficialVariantToken(item.variant);
  await prisma.card.update({
    where: { id: existingCardId },
    data: officialVariantCode ? { officialVariantCode } : {},
  });
  await prisma.officialSyncItem.update({
    where: { id: item.id },
    data: { decisionStatus: "APPLIED", appliedCardId: existingCardId },
  });
  return { cardId: existingCardId };
}

export async function ignoreOfficialItem(itemId: number) {
  await prisma.officialSyncItem.update({
    where: { id: itemId },
    data: { decisionStatus: "IGNORED" },
  });
}

export type ApplyPendingResult = {
  region: string;
  attempted: number;
  applied: number;
  failed: number;
  failures: Array<{ itemId: number; code: string; error: string }>;
};

/**
 * Aplica automáticamente items PENDIENTES de una región (usado por el cron
 * de official-sync). Si un item falla al aplicarse (imagen rota, layout
 * raro del sitio oficial, etc.) queda PENDING — visible en
 * /admin/official-sync para revisión manual — en vez de bloquear el resto
 * del batch.
 */
export async function applyPendingOfficialItems(
  regionKey: string,
  opts: { limit?: number; concurrency?: number } = {}
): Promise<ApplyPendingResult> {
  const cfg = OFFICIAL_REGIONS[regionKey.toUpperCase()];
  if (!cfg) throw new Error(`Región no soportada: ${regionKey}`);
  const limit = opts.limit ?? 25;
  // Cada item se reclama atómicamente (CLAIM_SENTINEL en applyOfficialItem),
  // eso evita procesar el MISMO item dos veces — pero no evita que dos items
  // DISTINTOS del mismo código (ej. la base y su alterna) se procesen en
  // paralelo, y cada uno decida por su cuenta "no existe la base, la creo"
  // (findRegionBase + create sin lock) → dos filas base para el mismo
  // código. Por eso claimNext() nunca deja que dos workers tengan un item
  // del mismo código en vuelo a la vez.
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  const pending = await prisma.officialSyncItem.findMany({
    where: { region: cfg.region, decisionStatus: "PENDING", appliedCardId: null },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, code: true },
  });

  const failures: ApplyPendingResult["failures"] = [];
  let applied = 0;
  let processed = 0;

  const claimed = new Array(pending.length).fill(false);
  const inFlightCodes = new Set<string>();

  // Nada de esto puede correr concurrentemente entre sí — JS solo cede el
  // control en un `await`, así que esta función síncrona es efectivamente
  // una sección crítica sin necesidad de ningún lock real.
  const claimNext = (): number | null => {
    for (let i = 0; i < pending.length; i++) {
      if (!claimed[i] && !inFlightCodes.has(pending[i].code)) {
        claimed[i] = true;
        inFlightCodes.add(pending[i].code);
        return i;
      }
    }
    return null;
  };

  const worker = async () => {
    while (true) {
      const i = claimNext();
      if (i === null) {
        if (claimed.every(Boolean)) return;
        // Todo lo que queda es de un código que otro worker tiene en
        // vuelo — esperar a que lo suelte en vez de terminar temprano.
        await sleep(150);
        continue;
      }
      const item = pending[i];
      try {
        await applyOfficialItem(item.id);
        applied += 1;
        processed += 1;
        console.log(
          `[apply][${processed}/${pending.length}] ${item.code} (item #${item.id}) -> ok`
        );
      } catch (e) {
        failures.push({ itemId: item.id, code: item.code, error: (e as Error).message });
        processed += 1;
        console.log(
          `[apply][${processed}/${pending.length}] ${item.code} (item #${item.id}) -> FAILED: ${(e as Error).message}`
        );
      } finally {
        inFlightCodes.delete(item.code);
      }
      await sleep(200);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, () => worker())
  );

  return {
    region: cfg.region,
    attempted: pending.length,
    applied,
    failed: failures.length,
    failures,
  };
}
