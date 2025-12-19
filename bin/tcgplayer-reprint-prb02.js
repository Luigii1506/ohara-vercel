#!/usr/bin/env node
const { chromium } = require("playwright");

const BASE_URL =
  "https://www.tcgplayer.com/search/one-piece-card-game/premium-booster-the-best-vol-2";
const QUERY = "reprint";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const ORIGIN = "https://www.tcgplayer.com";

function pickBestImage(srcset, fallback) {
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapePage(context, pageNumber = 1) {
  const url = `${BASE_URL}?productLineName=one-piece-card-game&q=${encodeURIComponent(
    QUERY
  )}&view=grid&ProductTypeName=Cards&page=${pageNumber}&setName=premium-booster-the-best-vol-2`;
  console.log(`[navigate][page ${pageNumber}] ${url}`);

  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  const currentUrl = page.url();
  if (!currentUrl.includes("premium-booster-the-best-vol-2")) {
    console.log(
      `[redirect][page ${pageNumber}] Landed on unexpected URL (${currentUrl}), stopping pagination.`
    );
    await page.close();
    return [];
  }
  await page.waitForTimeout(4000 + Math.random() * 1000);

  const cards = await page.$$eval(".product-card__title", (titles) => {
    const CODE_PATTERN = /#?\b([A-Z]{1,5}(?:-\d{1,4}|\d{1,4})[A-Z0-9-]*)\b/;
    const extractCode = (text) => {
      if (!text) return "";
      const match = text.match(CODE_PATTERN);
      return match ? match[1].toUpperCase() : "";
    };

    return titles
      .map((titleEl) => {
        const rawTitle = titleEl.textContent?.trim() ?? "";
        if (!rawTitle.includes("(Reprint)")) {
          return null;
        }
        const cardRoot = titleEl.closest(".search-result__content");
        if (!cardRoot) return null;

        let code = "";
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
          code = extractCode(rawTitle);
        }
        if (!code) {
          return null;
        }
        const anchors = Array.from(cardRoot.querySelectorAll("a"));
        const detailAnchor = anchors.find((a) =>
          (a.getAttribute("href") || "").includes("/product/")
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
      .filter(Boolean);
  });

  const results = [];
  for (const card of cards) {
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
        const detailImageInfo = await detailPage.evaluate((title) => {
          const imgs = Array.from(
            document.querySelectorAll(
              'img[data-testid^="product-image__container"]'
            )
          );
          if (!imgs.length) return null;
          const target =
            imgs.find((img) =>
              (img.getAttribute("alt") || "").includes("(Reprint)")
            ) || imgs[0];
          if (!target) return null;
          return {
            src: target.getAttribute("src") || "",
            srcset: target.getAttribute("srcset") || "",
            alt: target.getAttribute("alt") || "",
          };
        }, card.title);
        if (detailImageInfo) {
          bestImage = pickBestImage(
            detailImageInfo.srcset,
            detailImageInfo.src
          );
        }
      } catch (error) {
        console.warn(`Failed to load detail for ${card.code}:`, error.message);
      } finally {
        await detailPage.close();
        await delay(1500 + Math.random() * 1000);
      }
    }

    results.push({
      code: card.code,
      title: card.title,
      image: bestImage,
    });
    console.log(`[card] Finished ${card.code}`);
  }

  await page.close();
  return results;
}

async function scrapeReprintCards({ maxPages = 7 } = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const allCards = [];
  try {
    let pageNumber = 1;
    while (pageNumber <= maxPages) {
      const pageCards = await scrapePage(context, pageNumber);
      if (!pageCards.length) {
        console.log(
          `[page ${pageNumber}] No cards found, stopping pagination.`
        );
        break;
      }
      allCards.push(...pageCards);
      console.log(
        `[aggregate] After page ${pageNumber}, total cards: ${allCards.length}`
      );
      pageNumber += 1;
      await delay(1500 + Math.random() * 1000);
    }
  } finally {
    await browser.close();
  }
  return allCards;
}

async function main() {
  const cards = await scrapeReprintCards();
  console.log(`Found ${cards.length} reprint cards`);
  cards.forEach((card) => {
    console.log(`- ${card.code} :: ${card.title} :: ${card.image}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  scrapeReprintCards,
};
