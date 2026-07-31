#!/usr/bin/env ts-node

import { chromium } from "playwright";
import type { BrowserContext } from "playwright";

type ScrapedCard = {
  code: string;
  title: string;
  image: string;
  detailPath?: string;
  imageSet?: string;
};

type CliArgs = {
  slug: string;
  setName?: string;
  query?: string;
  maxPages: number;
  limit?: number;
};

const DEFAULT_ARGS: CliArgs = {
  slug: "two-legends-pre-release-cards",
  setName: "two-legends-pre-release-cards",
  query: "",
  maxPages: 1,
  limit: undefined,
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const ORIGIN = "https://www.tcgplayer.com";
const CODE_PATTERN = /#?\b([A-Z]{1,5}(?:-\d{1,4}|\d{1,4})[A-Z0-9-]*)\b/;

function parseCliArgs(): CliArgs {
  const raw = process.argv.slice(2);
  const parsed: Partial<CliArgs> = {};
  raw.forEach((entry) => {
    if (!entry.startsWith("--")) return;
    const [key, ...rest] = entry.split("=");
    const normalizedKey = key.replace(/^--/, "");
    const value = rest.join("=");
    switch (normalizedKey) {
      case "slug":
        parsed.slug = value;
        break;
      case "setName":
        parsed.setName = value;
        break;
      case "query":
        parsed.query = value;
        break;
      case "maxPages": {
        const num = Number(value);
        if (Number.isFinite(num) && num > 0) {
          parsed.maxPages = num;
        }
        break;
      }
      case "limit": {
        const num = Number(value);
        parsed.limit = Number.isFinite(num) && num > 0 ? num : undefined;
        break;
      }
      default:
        break;
    }
  });

  return {
    slug: parsed.slug || DEFAULT_ARGS.slug,
    setName:
      parsed.setName === undefined
        ? DEFAULT_ARGS.setName
        : parsed.setName.length
        ? parsed.setName
        : undefined,
    query:
      parsed.query === undefined
        ? DEFAULT_ARGS.query
        : parsed.query.length
        ? parsed.query
        : undefined,
    maxPages:
      parsed.maxPages && parsed.maxPages > 0
        ? parsed.maxPages
        : DEFAULT_ARGS.maxPages,
    limit: parsed.limit,
  };
}

const cli = parseCliArgs();

function buildUrl(pageNumber: number): string {
  const params = new URLSearchParams({
    productLineName: "one-piece-card-game",
    page: String(pageNumber),
    view: "grid",
    ProductTypeName: "Cards",
  });
  if (cli.query) {
    params.set("q", cli.query);
  }
  if (cli.setName) {
    params.set("setName", cli.setName);
  }
  return `https://www.tcgplayer.com/search/one-piece-card-game/${cli.slug}?${params.toString()}`;
}

function extractCode(text?: string | null): string {
  if (!text) return "";
  const match = text.match(CODE_PATTERN);
  return match ? match[1].toUpperCase() : "";
}

function pickBestImage(srcset?: string | null, fallback?: string | null) {
  if (!srcset) {
    return fallback || "";
  }
  const entries = srcset
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      const size = parseInt(parts[1], 10) || 0;
      return { url, size };
    })
    .filter((entry) => Boolean(entry.url));
  if (!entries.length) {
    return fallback || "";
  }
  entries.sort((a, b) => b.size - a.size);
  return entries[0].url || fallback || "";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapePage(context: BrowserContext, pageNumber: number) {
  const url = buildUrl(pageNumber);
  console.log(`[navigate][page ${pageNumber}] ${url}`);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000 + Math.random() * 1000);

  const cards = await page.$$eval(".product-card__title", (titles) => {
    const CODE_PATTERN = /#?\b([A-Z]{1,5}(?:-\d{1,4}|\d{1,4})[A-Z0-9-]*)\b/;
    const extractCode = (text?: string | null) => {
      if (!text) return "";
      const match = text.match(CODE_PATTERN);
      return match ? match[1].toUpperCase() : "";
    };

    return titles
      .map((titleEl) => {
        const rawTitle = titleEl.textContent?.trim() ?? "";
        const cardRoot = titleEl.closest(".search-result__content");
        if (!cardRoot) return null;

        let code = extractCode(rawTitle);
        if (!code) {
          const subtitleText = Array.from(
            cardRoot.querySelectorAll(".product-card__subtitle span")
          )
            .map((span) => span.textContent?.trim() || "")
            .join(" ");
          code = extractCode(subtitleText);
        }
        if (!code) {
          const rarityText = Array.from(
            cardRoot.querySelectorAll(".product-card__rarity__variant span")
          )
            .map((span) => span.textContent?.trim() || "")
            .join(" ");
          code = extractCode(rarityText);
        }
        if (!code) {
          const cardText = cardRoot.textContent || "";
          code = extractCode(cardText);
        }
        if (!code) {
          return null;
        }

        const anchors = Array.from(cardRoot.querySelectorAll("a"));
        const detailAnchor = anchors.find((anchor) =>
          (anchor.getAttribute("href") || "").includes("/product/")
        );
        const detailPath = detailAnchor?.getAttribute("href") || "";
        const img = cardRoot.querySelector(".lazy-image__wrapper img");
        const src = img?.getAttribute("src") ?? "";
        const srcset = img?.getAttribute("srcset") ?? "";
        return {
          title: rawTitle,
          code,
          image: src,
          imageSet: srcset,
          detailPath,
        };
      })
      .filter(Boolean) as ScrapedCard[];
  });

  await page.close();
  return cards;
}

async function scrapePreReleaseCards() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const aggregated: ScrapedCard[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= cli.maxPages; pageNumber += 1) {
      const pageCards = await scrapePage(context, pageNumber);
      if (!pageCards.length) {
        console.log(`[page ${pageNumber}] No cards found, stopping pagination.`);
        break;
      }
      aggregated.push(...pageCards);
      console.log(
        `[aggregate] After page ${pageNumber}, total cards collected: ${aggregated.length}`
      );
      if (cli.limit && aggregated.length >= cli.limit) {
        break;
      }
      await delay(1500 + Math.random() * 1000);
    }

    const limited = cli.limit ? aggregated.slice(0, cli.limit) : aggregated;
    const results: Array<{ code: string; title: string; image: string }> = [];

    for (const card of limited) {
      const detailUrl = card.detailPath
        ? card.detailPath.startsWith("http")
          ? card.detailPath
          : `${ORIGIN}${card.detailPath}`
        : "";

      let bestImage = pickBestImage(card.imageSet, card.image);
      if (detailUrl) {
        const detailPage = await context.newPage();
        try {
          await detailPage.goto(detailUrl, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          await detailPage.waitForTimeout(3000 + Math.random() * 1500);
          const detailImageInfo = await detailPage.evaluate(() => {
            const imgs = Array.from(
              document.querySelectorAll(
                'img[data-testid^="product-image__container"]'
              )
            );
            if (!imgs.length) return null;
            const target = imgs[0];
            return {
              src: target.getAttribute("src") || "",
              srcset: target.getAttribute("srcset") || "",
            };
          });
          if (detailImageInfo) {
            bestImage = pickBestImage(detailImageInfo.srcset, detailImageInfo.src);
          }
        } catch (error: any) {
          console.warn(`Failed to load detail for ${card.code}:`, error.message);
        } finally {
          await detailPage.close();
          await delay(1500 + Math.random() * 1000);
        }
      }

      console.log(`[card] Processed ${card.code}`);
      results.push({
        code: card.code,
        title: card.title,
        image: bestImage,
      });
    }

    return results;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  console.log(
    `Scraping slug="${cli.slug}" setName="${cli.setName ?? ""}" pages=${cli.maxPages} limit=${
      cli.limit ?? "∞"
    }`
  );
  const cards = await scrapePreReleaseCards();
  console.log(`\nFound ${cards.length} cards (limit ${cli.limit ?? "∞"}).`);
  cards.forEach((card) => {
    console.log(`- ${card.code} :: ${card.title} :: ${card.image}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
