#!/usr/bin/env node
import { chromium } from 'playwright';

const BASE_URL =
  'https://www.tcgplayer.com/search/one-piece-card-game/premium-booster-the-best-vol-2';
const QUERY = 'reprint';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

async function scrapePage(pageNumber = 1) {
  const url = `${BASE_URL}?productLineName=one-piece-card-game&q=${encodeURIComponent(
    QUERY
  )}&view=grid&ProductTypeName=Cards&page=${pageNumber}&setName=premium-booster-the-best-vol-2`;
  console.log(`[navigate] ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: USER_AGENT });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000 + Math.random() * 1000);

  const cards = await page.$$eval('article.product-card', (nodes) =>
    nodes
      .map((node) => {
        const title =
          node.querySelector('.product-card__title')?.textContent?.trim() ?? '';
        if (!title.includes('(Reprint)')) {
          return null;
        }
        const subtitleSpans = Array.from(
          node.querySelectorAll('.product-card__subtitle span')
        );
        const codeSpan = subtitleSpans.find((span) =>
          span.textContent?.includes('#')
        );
        const code = codeSpan?.textContent?.replace('#', '').trim() ?? '';
        if (!code) {
          return null;
        }
        const img = node.querySelector('.lazy-image__wrapper img');
        const src = img?.getAttribute('src') ?? '';
        const srcset = img?.getAttribute('srcset') ?? '';
        return { title, code, image: src, srcset };
      })
      .filter(Boolean)
  );

  await browser.close();
  return cards;
}

async function main() {
  const cards = await scrapePage(1);
  console.log(`Found ${cards.length} reprint cards`);
  cards.forEach((card) => {
    if (!card) return;
    console.log(`- ${card.code} :: ${card.title} :: ${card.image}`);
    if (card.srcset) {
      console.log(`  srcset: ${card.srcset}`);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
