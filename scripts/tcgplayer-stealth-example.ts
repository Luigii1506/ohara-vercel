#!/usr/bin/env ts-node
/**
 * Ejemplo de scraping sigiloso para TCGPlayer
 * Usa el módulo stealth-browser para evitar detección
 */

import StealthScraper, {
  humanDelay,
  requestDelay,
  humanClick,
} from "../lib/scraping/stealth-browser";

const ORIGIN = "https://www.tcgplayer.com";

type ScrapedCard = {
  code: string;
  title: string;
  image: string;
  detailPath?: string;
  price?: string;
};

async function scrapeOnePieceCards(setSlug: string, maxPages = 1) {
  const scraper = new StealthScraper({
    headless: true, // Cambiar a false para debug
  });

  const cards: ScrapedCard[] = [];

  try {
    console.log("[init] Inicializando navegador sigiloso...");
    await scraper.init();

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await scraper.newPage();

      const url = `${ORIGIN}/search/one-piece-card-game/${setSlug}?productLineName=one-piece-card-game&page=${pageNum}&view=grid&ProductTypeName=Cards`;

      console.log(`[page ${pageNum}] Navegando a: ${url}`);
      await scraper.navigate(page, url, ".search-result__content");

      // Scroll para cargar lazy images
      await page.evaluate(async () => {
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 400);
          await new Promise((r) => setTimeout(r, 500));
        }
      });

      await humanDelay(2000);

      // Extraer datos
      const pageCards = await page.$$eval(".search-result__content", (elements) => {
        const CODE_PATTERN = /#?\b([A-Z]{1,5}(?:-\d{1,4}|\d{1,4})[A-Z0-9-]*)\b/;

        return elements
          .map((el) => {
            const titleEl = el.querySelector(".product-card__title");
            const title = titleEl?.textContent?.trim() ?? "";

            // Extraer código
            let code = "";
            const codeMatch = el.textContent?.match(CODE_PATTERN);
            if (codeMatch) {
              code = codeMatch[1].toUpperCase();
            }

            if (!code) return null;

            // Imagen
            const img = el.querySelector(".lazy-image__wrapper img");
            const srcset = img?.getAttribute("srcset") ?? "";
            const src = img?.getAttribute("src") ?? "";
            let image = src;
            if (srcset) {
              const entries = srcset.split(",").map((e) => {
                const [url, size] = e.trim().split(/\s+/);
                return { url, size: parseInt(size) || 0 };
              });
              entries.sort((a, b) => b.size - a.size);
              image = entries[0]?.url || src;
            }

            // Link al detalle
            const link = el.querySelector('a[href*="/product/"]');
            const detailPath = link?.getAttribute("href") ?? "";

            // Precio si está visible
            const priceEl = el.querySelector(".product-card__market-price__price");
            const price = priceEl?.textContent?.trim() ?? "";

            return { code, title, image, detailPath, price };
          })
          .filter(Boolean);
      });

      console.log(`[page ${pageNum}] Encontradas ${pageCards.length} cartas`);
      cards.push(...(pageCards as ScrapedCard[]));

      await page.close();

      // Delay entre páginas
      if (pageNum < maxPages) {
        console.log("[delay] Esperando antes de siguiente página...");
        await requestDelay();
      }
    }

    return cards;
  } finally {
    await scraper.close();
    console.log("[cleanup] Navegador cerrado");
  }
}

async function main() {
  const setSlug = process.argv[2] || "two-legends-pre-release-cards";
  const maxPages = parseInt(process.argv[3]) || 1;

  console.log(`\n🎴 Scraping TCGPlayer: ${setSlug}`);
  console.log(`📄 Páginas: ${maxPages}\n`);

  const cards = await scrapeOnePieceCards(setSlug, maxPages);

  console.log(`\n✅ Total cartas: ${cards.length}\n`);

  cards.forEach((card) => {
    console.log(`  ${card.code} - ${card.title} ${card.price || ""}`);
  });
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
