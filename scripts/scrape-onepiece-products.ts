#!/usr/bin/env -S npx tsx

import "dotenv/config";
import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

// Scraper de productos oficiales (en.onepiece-cardgame.com).
//
// La página de productos se rediseñó (2026). Estructura NUEVA:
//   Lista:   ?page=N&view=normal → <li class="linkListColBox">
//              <a class="linkListColItem" href="/products/<slug>.html">
//              <div class="linkListColThumb"><img data-src="…img_item01.webp"></div>  (lazy)
//              <span class="linkListColCat">BOOSTERS</span>
//              <h4 class="linkListColTitle">…</h4>
//              <p class="linkListColPrice"><span class="data">USD $12.00</span></p>
//   Detalle: <dl><dt>Release Date</dt><dd>October 2026</dd></dl>
//              <dl><dt>MSRP</dt><dd>USD $4.99 per pack</dd></dl>
//              imágenes en el slider como data-src (lazy), img_item01.webp.
//
// Uso:
//   npx tsx scripts/scrape-onepiece-products.ts --dry-run
//   npx tsx scripts/scrape-onepiece-products.ts --pages=3
//   npx tsx scripts/scrape-onepiece-products.ts --limit=10

type ScrapedProduct = {
  title: string;
  href: string;
  thumbnailUrl: string | null;
  category: string;
  productType: string;
  releaseDateRaw: string | null;
  releaseDateIso: string | null;
  officialPrice: string | null;
  officialPriceCurrency: string | null;
  images: string[];
};

const ORIGIN = "https://en.onepiece-cardgame.com";
const listUrl = (page: number) => `${ORIGIN}/products/?page=${page}&view=normal`;

const HTTP_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const prisma = new PrismaClient() as unknown as {
  missingProduct: {
    findFirst: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
  };
  $disconnect: () => Promise<void>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const buildAbsoluteUrl = (value?: string | null) => {
  const v = (value || "").trim();
  if (!v) return "";
  try {
    return new URL(v, ORIGIN).href;
  } catch {
    return v;
  }
};

// Descarta placeholders (no-image / thumbnail genérico) que no son la carta real.
const isPlaceholderImage = (src: string) =>
  /img_noimage|img_thumbnail|thumbnail_sq|common\/thumbnail/i.test(src);

const parseReleaseDate = (value: string | null): string | null => {
  if (!value) return null;
  const monthDay = value.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (monthDay) {
    const parsed = new Date(`${monthDay[1]} ${monthDay[2]}, ${monthDay[3]}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const monthYear = value.match(/([A-Za-z]+)\s+(\d{4})/);
  if (monthYear) {
    const parsed = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
};

// "USD $12.00", "USD $4.99 per pack" → { amount:"12.00", currency:"USD" }
const parsePrice = (value: string | null) => {
  if (!value) return { amount: null as string | null, currency: null as string | null };
  const match = value.match(/([A-Z]{3})?\s*\$\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) return { amount: null, currency: null };
  return { amount: match[2], currency: (match[1] || "USD").toUpperCase() };
};

const resolveProductType = (category: string, title: string) => {
  const cat = category.toLowerCase();
  if (cat.includes("deck")) return "DECK";
  if (cat.includes("booster")) return "BOOSTER";

  const t = title.toLowerCase();
  if (t.includes("sleeve")) return "SLEEVE";
  if (t.includes("tin")) return "TIN_PACK";
  if (t.includes("illustration box")) return "ILLUSTRATION_BOX";
  if (t.includes("anniversary set")) return "ANNIVERSARY_SET";
  if (t.includes("premium card collection")) return "PREMIUM_CARD_COLLECTION";
  if (t.includes("playmat")) return "PLAYMAT";
  if (t.includes("double pack")) return "DOUBLE_PACK";
  if (t.includes("devil fruit")) return "DEVIL_FRUIT";
  if (t.includes("storage box")) return "STORAGE_BOX";
  return "OTHER";
};

type ListItem = {
  title: string;
  href: string;
  thumbnailUrl: string | null;
  category: string;
  priceText: string | null;
};

// Parsea UNA página de la lista de productos.
const parseListPage = (html: string): ListItem[] => {
  const $ = cheerio.load(html);
  return $("li.linkListColBox")
    .map((_, el) => {
      const $item = $(el);
      const anchor = $item.find("a.linkListColItem").first();
      const href = buildAbsoluteUrl(anchor.attr("href"));
      const $img = $item.find(".linkListColThumb img").first();
      const rawThumb = $img.attr("data-src") || $img.attr("src") || "";
      const thumb = buildAbsoluteUrl(rawThumb);
      const thumbnailUrl = thumb && !isPlaceholderImage(thumb) ? thumb : null;
      const category =
        $item.find(".linkListColCat").first().text().trim() ||
        ($item.attr("data-cat") || "").toUpperCase() ||
        "OTHER";
      const title = $item.find(".linkListColTitle").first().text().trim();
      const priceText = $item.find(".linkListColPrice .data").first().text().trim() || null;
      return { title, href, thumbnailUrl, category, priceText };
    })
    .get()
    .filter((it) => it.title && it.href);
};

type Detail = { images: string[]; releaseDateRaw: string | null; priceText: string | null };

// Parsea la página de DETALLE: imágenes (lazy) + Release Date + MSRP.
const parseDetail = (html: string): Detail => {
  const $ = cheerio.load(html);

  let releaseDateRaw: string | null = null;
  let priceText: string | null = null;
  $("dl").each((_, dl) => {
    const label = $(dl).find("dt").text().trim().toLowerCase();
    const value = $(dl).find("dd").text().trim();
    if (!value) return;
    if (label.includes("release date")) releaseDateRaw = value;
    else if (label.includes("msrp") || label.includes("price")) priceText = value;
  });

  const images = Array.from(
    new Set(
      $("img")
        .map((_, el) => $(el).attr("data-src") || $(el).attr("src") || "")
        .get()
        .map((s) => buildAbsoluteUrl(s))
        .filter(Boolean)
        .filter(
          (src) =>
            /\/products?\//.test(src) || /\/renewal\/images\/products\//.test(src)
        )
        .filter((src) => !isPlaceholderImage(src))
    )
  );

  return { images, releaseDateRaw, priceText };
};

const main = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const pagesArg = args.find((a) => a.startsWith("--pages="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : null;
  const maxPages = pagesArg ? Number(pagesArg.split("=")[1]) : 20;

  // 1) Recorrer páginas de la lista hasta que una venga vacía.
  const listItems: ListItem[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { data } = await axios.get<string>(listUrl(page), { headers: HTTP_HEADERS, timeout: 30000 });
    const pageItems = parseListPage(data);
    console.log(`[list] page ${page}: ${pageItems.length} productos`);
    if (pageItems.length === 0) break;
    listItems.push(...pageItems);
    await sleep(500);
  }

  // Dedupe por href.
  const seen = new Set<string>();
  const items = listItems.filter((it) => (seen.has(it.href) ? false : (seen.add(it.href), true)));
  console.log(`[list] ${items.length} productos únicos\n`);

  let processed = 0;
  let created = 0;
  let updated = 0;

  for (const item of items) {
    if (limit && processed >= limit) {
      console.log("[limit] alcanzado, deteniendo.");
      break;
    }
    if (!item.href) continue;
    try {
      const detailRes = await axios.get<string>(item.href, { headers: HTTP_HEADERS, timeout: 30000 });
      const detail = parseDetail(detailRes.data);

      const priceText = detail.priceText || item.priceText;
      const { amount, currency } = parsePrice(priceText);
      const productType = resolveProductType(item.category, item.title);
      const releaseDateIso = parseReleaseDate(detail.releaseDateRaw);

      const mergedImages = Array.from(
        new Set([...(detail.images ?? []), item.thumbnailUrl].filter(Boolean))
      ) as string[];

      const payload: ScrapedProduct = {
        title: item.title,
        href: item.href,
        thumbnailUrl: item.thumbnailUrl,
        category: item.category,
        productType,
        releaseDateRaw: detail.releaseDateRaw,
        releaseDateIso,
        officialPrice: amount,
        officialPriceCurrency: currency,
        images: mergedImages,
      };

      if (dryRun) {
        console.log(
          `[dry] ${payload.title} · ${payload.category} · ${payload.releaseDateRaw ?? "?"} · ${
            payload.officialPrice ? `$${payload.officialPrice}` : "?"
          } · ${payload.images.length} img`
        );
        processed += 1;
        await sleep(300);
        continue;
      }

      const existing = await prisma.missingProduct.findFirst({
        where: { title: payload.title, sourceUrl: payload.href || null },
      });

      if (existing?.isApproved) {
        console.log(`[skip][approved] ${payload.title}`);
        processed += 1;
        continue;
      }

      const data = {
        title: payload.title,
        sourceUrl: payload.href || null,
        productType: payload.productType || null,
        category: payload.category || null,
        releaseDate: payload.releaseDateIso ? new Date(payload.releaseDateIso) : null,
        officialPrice: payload.officialPrice || null,
        officialPriceCurrency: payload.officialPriceCurrency || null,
        thumbnailUrl: payload.thumbnailUrl || null,
        imagesJson: payload.images ?? [],
      };

      if (existing) {
        await prisma.missingProduct.update({ where: { id: existing.id }, data });
        updated += 1;
        console.log(`[update] ${payload.title}`);
      } else {
        await prisma.missingProduct.create({ data });
        created += 1;
        console.log(`[create] ${payload.title}`);
      }
      processed += 1;
      await sleep(400);
    } catch (error) {
      console.error(`[error] ${item.href}`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n[done] ${processed} procesados · ${created} nuevos · ${updated} actualizados`);
};

main()
  .catch((error) => {
    console.error("[error] Product scraper failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
