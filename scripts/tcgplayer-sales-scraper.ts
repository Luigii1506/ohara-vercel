#!/usr/bin/env npx tsx
/**
 * TCGPlayer Latest Sales Scraper
 *
 * Scrapea las últimas ventas de cartas desde TCGPlayer para calcular
 * el valor real basado en ventas recientes (no market price).
 *
 * Uso:
 *   npx tsx scripts/tcgplayer-sales-scraper.ts --listId=123
 *   npx tsx scripts/tcgplayer-sales-scraper.ts --url=https://tcgplayer.com/product/...
 *   npx tsx scripts/tcgplayer-sales-scraper.ts --productId=593300
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// ============================================================================
// Stealth Browser Utilities (inline to avoid module resolution issues)
// ============================================================================

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function humanDelay(baseMs: number, variancePercent = 0.3): Promise<void> {
  const variance = baseMs * variancePercent;
  const actualDelay = baseMs + (Math.random() * variance * 2 - variance);
  return new Promise((resolve) => setTimeout(resolve, Math.max(100, actualDelay)));
}

function requestDelay(): Promise<void> {
  const delay = randomInt(2000, 5000);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function createStealthBrowser(headless = true): Promise<Browser> {
  return chromium.launch({
    headless,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });
}

async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const userAgent = randomElement(USER_AGENTS);
  const viewport = randomElement(VIEWPORTS);

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale: "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Upgrade-Insecure-Requests": "1",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    (window as any).chrome = { runtime: {} };
  });

  return context;
}

class StealthScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(private options: { headless?: boolean } = {}) {}

  async init(): Promise<void> {
    this.browser = await createStealthBrowser(this.options.headless ?? true);
    this.context = await createStealthContext(this.browser);
  }

  async newPage(): Promise<Page> {
    if (!this.context) throw new Error("Scraper not initialized");
    return this.context.newPage();
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }
}

// ============================================================================
// Types
// ============================================================================

interface SaleEntry {
  date: string;
  condition: string;
  quantity: number;
  price: number;
}

interface CardSalesData {
  cardCode: string;
  cardName: string;
  tcgplayerUrl: string;
  tcgplayerProductId: number | null;
  latestSales: SaleEntry[];
  averagePrice: number | null;
  top3Average: number | null;
  marketPrice: number | null;
  error?: string;
}

interface ListCard {
  id: number;
  cardId: string;
  quantity: number;
  card: {
    id: string;
    code: string;
    name: string;
    tcgUrl?: string | null;
    tcgplayerProductId?: number | null;
    marketPrice?: number | null;
  };
}

interface ScrapeResult {
  listId?: number;
  listName?: string;
  scrapedAt: string;
  cards: CardSalesData[];
  summary: {
    totalCards: number;
    successfulScrapes: number;
    failedScrapes: number;
    totalValueByTop3Avg: number;
    totalValueByMarketPrice: number;
    breakdown: Array<{
      code: string;
      name: string;
      quantity: number;
      top3Avg: number | null;
      marketPrice: number | null;
      subtotalTop3: number;
      subtotalMarket: number;
    }>;
  };
}

// ============================================================================
// CLI Arguments
// ============================================================================

interface CliArgs {
  listId?: number;
  url?: string;
  productId?: number;
  limit?: number;
  headless: boolean;
  outputJson: boolean;
  salesToAverage: number;
  fast: boolean; // Modo rápido con delays reducidos
  minDelay: number; // Delay mínimo entre requests (ms)
  maxDelay: number; // Delay máximo entre requests (ms)
}

// Cache para evitar scrapear la misma URL múltiples veces
const salesCache = new Map<string, CardSalesData>();

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CliArgs> = {
    headless: true,
    outputJson: false,
    salesToAverage: 3,
    fast: false,
    minDelay: 2000,
    maxDelay: 5000,
  };

  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    const value = rest.join("=");

    switch (key) {
      case "listId":
        parsed.listId = parseInt(value, 10) || undefined;
        break;
      case "url":
        parsed.url = value;
        break;
      case "productId":
        parsed.productId = parseInt(value, 10) || undefined;
        break;
      case "limit":
        parsed.limit = parseInt(value, 10) || undefined;
        break;
      case "headless":
        parsed.headless = value !== "false";
        break;
      case "json":
        parsed.outputJson = true;
        break;
      case "salesToAverage":
        parsed.salesToAverage = parseInt(value, 10) || 3;
        break;
      case "fast":
        parsed.fast = true;
        parsed.minDelay = 800;
        parsed.maxDelay = 1500;
        break;
      case "minDelay":
        parsed.minDelay = parseInt(value, 10) || 2000;
        break;
      case "maxDelay":
        parsed.maxDelay = parseInt(value, 10) || 5000;
        break;
    }
  }

  return parsed as CliArgs;
}

// ============================================================================
// Price Parsing
// ============================================================================

function parsePrice(priceStr: string): number {
  // Remove currency symbols and parse
  const cleaned = priceStr.replace(/[^0-9.,]/g, "").replace(",", "");
  return parseFloat(cleaned) || 0;
}

function parseDate(dateStr: string): string {
  // TCGPlayer format: "1/24/26" -> "2026-01-24"
  const parts = dateStr.trim().split("/");
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const fullYear = parseInt(year, 10) < 50 ? `20${year}` : `19${year}`;
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return dateStr;
}

// ============================================================================
// Scraping Functions
// ============================================================================

async function scrapeLatestSales(
  page: Page,
  url: string
): Promise<{ sales: SaleEntry[]; marketPrice: number | null }> {
  console.log(`  [navigate] ${url}`);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await humanDelay(2000);

  // Scroll down to load lazy content
  await page.evaluate(() => {
    window.scrollBy(0, 500);
  });
  await humanDelay(1500);

  // Get market price from the page
  let marketPrice: number | null = null;
  try {
    const marketPriceEl = await page.$(".market-price .price");
    if (marketPriceEl) {
      const priceText = await marketPriceEl.textContent();
      if (priceText) {
        marketPrice = parsePrice(priceText);
      }
    }
  } catch (e) {
    console.log("  [info] Could not get market price from page");
  }

  // Look for "View More Data" button and click it
  const viewMoreButton = await page.$('div[role="button"]:has-text("View More Data")');

  if (!viewMoreButton) {
    console.log("  [warn] 'View More Data' button not found, trying alternate selectors...");

    // Try alternate selectors
    const alternates = [
      'button:has-text("View More Data")',
      '.price-history__view-more',
      '[data-testid="view-more-data"]',
      'text="View More Data"',
    ];

    for (const selector of alternates) {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        console.log(`  [click] Found button with selector: ${selector}`);
        break;
      }
    }
  } else {
    console.log("  [click] Opening 'View More Data' modal...");
    await viewMoreButton.click();
  }

  await humanDelay(2000);

  // Wait for modal and sales table
  try {
    await page.waitForSelector(".latest-sales-table", { timeout: 10000 });
  } catch {
    console.log("  [warn] Sales table not found in modal");
    return { sales: [], marketPrice };
  }

  // Extract sales data from table
  const sales = await page.$$eval(
    ".latest-sales-table__tbody tr",
    (rows): SaleEntry[] => {
      return rows.map((row) => {
        const dateEl = row.querySelector(".latest-sales-table__tbody__date");
        const conditionEl = row.querySelector(".latest-sales-table__tbody__condition");
        const qtyEl = row.querySelector(".latest-sales-table__tbody_quantity");
        const priceEl = row.querySelector(".latest-sales-table__tbody__price");

        const priceText = priceEl?.textContent?.trim() || "$0";
        const priceNum = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

        return {
          date: dateEl?.textContent?.trim() || "",
          condition: conditionEl?.textContent?.trim() || "",
          quantity: parseInt(qtyEl?.textContent?.trim() || "1", 10),
          price: priceNum,
        };
      });
    }
  );

  console.log(`  [scraped] Found ${sales.length} sales entries`);

  // Close modal if open
  try {
    const closeButton = await page.$('.modal__close, [aria-label="Close"]');
    if (closeButton) {
      await closeButton.click();
      await humanDelay(500);
    }
  } catch {
    // Modal might auto-close or not exist
  }

  return { sales, marketPrice };
}

async function scrapeCardSales(
  scraper: StealthScraper,
  card: {
    code: string;
    name: string;
    tcgUrl?: string | null;
    tcgplayerProductId?: number | null;
    marketPrice?: number | null;
  },
  salesToAverage: number
): Promise<CardSalesData> {
  const result: CardSalesData = {
    cardCode: card.code,
    cardName: card.name,
    tcgplayerUrl: "",
    tcgplayerProductId: card.tcgplayerProductId || null,
    latestSales: [],
    averagePrice: null,
    top3Average: null,
    marketPrice: card.marketPrice || null,
  };

  // Build URL
  if (card.tcgUrl && card.tcgUrl.trim()) {
    result.tcgplayerUrl = card.tcgUrl;
  } else if (card.tcgplayerProductId) {
    result.tcgplayerUrl = `https://www.tcgplayer.com/product/${card.tcgplayerProductId}`;
  } else {
    result.error = "No TCGPlayer URL or Product ID";
    return result;
  }

  const page = await scraper.newPage();

  try {
    const { sales, marketPrice } = await scrapeLatestSales(page, result.tcgplayerUrl);

    result.latestSales = sales;
    if (marketPrice) {
      result.marketPrice = marketPrice;
    }

    // Calculate averages
    if (sales.length > 0) {
      const allPrices = sales.map((s) => s.price);
      result.averagePrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;

      const topSales = sales.slice(0, salesToAverage);
      if (topSales.length > 0) {
        const topPrices = topSales.map((s) => s.price);
        result.top3Average = topPrices.reduce((a, b) => a + b, 0) / topPrices.length;
      }
    }
  } catch (error: any) {
    result.error = error.message || "Unknown error";
    console.log(`  [error] ${result.error}`);
  } finally {
    await page.close();
  }

  return result;
}

// ============================================================================
// List Fetching
// ============================================================================

async function fetchListCards(listId: number): Promise<{
  name: string;
  cards: ListCard[];
}> {
  // This assumes running locally with access to the API
  // Adjust the URL if needed
  const apiUrl = process.env.API_BASE_URL || "http://localhost:3000";

  console.log(`[fetch] Getting list ${listId} from API...`);

  const response = await fetch(`${apiUrl}/api/lists/${listId}?limit=0`);
  if (!response.ok) {
    throw new Error(`Failed to fetch list: ${response.status}`);
  }

  const data = await response.json();
  const list = data.list || data;

  return {
    name: list.name,
    cards: list.cards || [],
  };
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(result: ScrapeResult): void {
  console.log("\n" + "=".repeat(80));
  console.log("📊 REPORTE DE VALORACIÓN POR VENTAS RECIENTES");
  console.log("=".repeat(80));

  if (result.listName) {
    console.log(`\n📁 Lista: ${result.listName}`);
  }
  console.log(`📅 Fecha: ${result.scrapedAt}`);
  console.log(`🎴 Total cartas: ${result.summary.totalCards}`);
  console.log(`✅ Exitosos: ${result.summary.successfulScrapes}`);
  console.log(`❌ Fallidos: ${result.summary.failedScrapes}`);

  console.log("\n" + "-".repeat(80));
  console.log("DESGLOSE POR CARTA:");
  console.log("-".repeat(80));
  console.log(
    `${"Código".padEnd(15)} | ${"Nombre".padEnd(30)} | ${"Qty".padStart(3)} | ${"Top3 Avg".padStart(10)} | ${"Market".padStart(10)} | ${"Subtotal".padStart(12)}`
  );
  console.log("-".repeat(80));

  for (const item of result.summary.breakdown) {
    const top3Num = typeof item.top3Avg === "number" ? item.top3Avg : parseFloat(String(item.top3Avg));
    const marketNum = typeof item.marketPrice === "number" ? item.marketPrice : parseFloat(String(item.marketPrice));
    const subtotalNum = typeof item.subtotalTop3 === "number" ? item.subtotalTop3 : parseFloat(String(item.subtotalTop3));

    const top3Str = !isNaN(top3Num) && top3Num > 0 ? `$${top3Num.toFixed(2)}` : "N/A";
    const marketStr = !isNaN(marketNum) && marketNum > 0 ? `$${marketNum.toFixed(2)}` : "N/A";
    const subtotalStr = `$${(isNaN(subtotalNum) ? 0 : subtotalNum).toFixed(2)}`;

    console.log(
      `${item.code.padEnd(15)} | ${item.name.substring(0, 30).padEnd(30)} | ${String(item.quantity).padStart(3)} | ${top3Str.padStart(10)} | ${marketStr.padStart(10)} | ${subtotalStr.padStart(12)}`
    );
  }

  console.log("-".repeat(80));
  console.log("\n📈 RESUMEN DE VALORACIÓN:");
  console.log(`   💰 Valor Total (Top 3 Avg):    $${result.summary.totalValueByTop3Avg.toFixed(2)}`);
  console.log(`   📊 Valor Total (Market Price): $${result.summary.totalValueByMarketPrice.toFixed(2)}`);

  const diff = result.summary.totalValueByTop3Avg - result.summary.totalValueByMarketPrice;
  const diffPercent = result.summary.totalValueByMarketPrice > 0
    ? ((diff / result.summary.totalValueByMarketPrice) * 100).toFixed(1)
    : "0";

  console.log(`   📉 Diferencia:                 $${diff.toFixed(2)} (${diffPercent}%)`);
  console.log("\n" + "=".repeat(80));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs();

  if (!args.listId && !args.url && !args.productId) {
    console.log(`
TCGPlayer Latest Sales Scraper
==============================

Uso:
  npx tsx scripts/tcgplayer-sales-scraper.ts --listId=123
  npx tsx scripts/tcgplayer-sales-scraper.ts --url=https://tcgplayer.com/product/593300/...
  npx tsx scripts/tcgplayer-sales-scraper.ts --productId=593300

Opciones:
  --listId=N          ID de la lista a scrapear
  --url=URL           URL directa de un producto TCGPlayer
  --productId=N       ID de producto TCGPlayer
  --limit=N           Limitar cantidad de cartas a procesar
  --headless=false    Mostrar el navegador (para debug)
  --json              Salida en formato JSON
  --salesToAverage=N  Cantidad de ventas para promediar (default: 3)

Velocidad:
  --fast              Modo rápido (delays reducidos, mayor riesgo de bloqueo)
  --minDelay=N        Delay mínimo entre requests en ms (default: 2000)
  --maxDelay=N        Delay máximo entre requests en ms (default: 5000)

Nota: Las cartas duplicadas (misma URL) se cachean automáticamente.
`);
    process.exit(0);
  }

  const scraper = new StealthScraper({
    headless: args.headless,
  });

  try {
    console.log("\n🔄 Inicializando navegador sigiloso...\n");
    await scraper.init();

    const result: ScrapeResult = {
      scrapedAt: new Date().toISOString(),
      cards: [],
      summary: {
        totalCards: 0,
        successfulScrapes: 0,
        failedScrapes: 0,
        totalValueByTop3Avg: 0,
        totalValueByMarketPrice: 0,
        breakdown: [],
      },
    };

    // Determine what to scrape
    let cardsToScrape: Array<{
      code: string;
      name: string;
      quantity: number;
      tcgUrl?: string | null;
      tcgplayerProductId?: number | null;
      marketPrice?: number | null;
    }> = [];

    if (args.listId) {
      // Fetch from API
      const { name, cards } = await fetchListCards(args.listId);
      result.listId = args.listId;
      result.listName = name;

      cardsToScrape = cards
        .filter((c) => c.card.tcgUrl || c.card.tcgplayerProductId)
        .map((c) => ({
          code: c.card.code,
          name: c.card.name,
          quantity: c.quantity,
          tcgUrl: c.card.tcgUrl,
          tcgplayerProductId: c.card.tcgplayerProductId,
          marketPrice: c.card.marketPrice,
        }));
    } else if (args.url) {
      cardsToScrape = [
        {
          code: "MANUAL",
          name: "Manual URL",
          quantity: 1,
          tcgUrl: args.url,
        },
      ];
    } else if (args.productId) {
      cardsToScrape = [
        {
          code: "MANUAL",
          name: `Product ${args.productId}`,
          quantity: 1,
          tcgplayerProductId: args.productId,
        },
      ];
    }

    // Apply limit
    if (args.limit && args.limit > 0) {
      cardsToScrape = cardsToScrape.slice(0, args.limit);
    }

    // Contar cartas únicas por URL
    const uniqueUrls = new Set<string>();
    for (const card of cardsToScrape) {
      const url = card.tcgUrl || (card.tcgplayerProductId ? `https://www.tcgplayer.com/product/${card.tcgplayerProductId}` : "");
      if (url) uniqueUrls.add(url);
    }

    result.summary.totalCards = cardsToScrape.length;
    console.log(`📋 Cartas a procesar: ${cardsToScrape.length}`);
    console.log(`🔗 URLs únicas: ${uniqueUrls.size} (${cardsToScrape.length - uniqueUrls.size} duplicadas se cachearán)`);
    console.log(`⚡ Modo: ${args.fast ? "RÁPIDO (delays: " + args.minDelay + "-" + args.maxDelay + "ms)" : "SEGURO (delays: " + args.minDelay + "-" + args.maxDelay + "ms)"}\n`);

    let cachedCount = 0;
    let scrapedCount = 0;

    // Función de delay configurable
    const configuredDelay = () => {
      const delay = randomInt(args.minDelay, args.maxDelay);
      return new Promise<void>((resolve) => setTimeout(resolve, delay));
    };

    // Scrape each card
    for (let i = 0; i < cardsToScrape.length; i++) {
      const card = cardsToScrape[i];
      const cacheKey = card.tcgUrl || (card.tcgplayerProductId ? `https://www.tcgplayer.com/product/${card.tcgplayerProductId}` : "");

      console.log(`[${i + 1}/${cardsToScrape.length}] ${card.code} - ${card.name}`);

      let salesData: CardSalesData;

      // Verificar cache primero
      if (cacheKey && salesCache.has(cacheKey)) {
        console.log(`  [cache] ✓ Usando datos cacheados`);
        salesData = salesCache.get(cacheKey)!;
        cachedCount++;
      } else {
        // Scrapear y guardar en cache
        salesData = await scrapeCardSales(scraper, card, args.salesToAverage);
        if (cacheKey && !salesData.error) {
          salesCache.set(cacheKey, salesData);
        }
        scrapedCount++;
      }

      result.cards.push(salesData);

      // Build breakdown entry - ensure numbers
      const top3AvgNum = typeof salesData.top3Average === "number" ? salesData.top3Average : parseFloat(String(salesData.top3Average)) || 0;
      const marketPriceNum = typeof salesData.marketPrice === "number" ? salesData.marketPrice : parseFloat(String(salesData.marketPrice)) || 0;

      const breakdownEntry = {
        code: card.code,
        name: card.name,
        quantity: card.quantity,
        top3Avg: top3AvgNum || null,
        marketPrice: marketPriceNum || null,
        subtotalTop3: top3AvgNum * card.quantity,
        subtotalMarket: marketPriceNum * card.quantity,
      };

      result.summary.breakdown.push(breakdownEntry);
      result.summary.totalValueByTop3Avg += breakdownEntry.subtotalTop3;
      result.summary.totalValueByMarketPrice += breakdownEntry.subtotalMarket;

      if (salesData.error) {
        result.summary.failedScrapes++;
      } else {
        result.summary.successfulScrapes++;
      }

      // Log sales preview
      if (salesData.latestSales.length > 0) {
        const preview = salesData.latestSales
          .slice(0, 3)
          .map((s) => `$${s.price.toFixed(2)}`)
          .join(", ");
        console.log(`  [sales] Top ${args.salesToAverage}: ${preview}`);
        console.log(`  [avg] Top ${args.salesToAverage} Average: $${salesData.top3Average?.toFixed(2) || "N/A"}`);
      }

      // Delay solo si scrapeamos (no si fue cache) y hay más cartas
      if (i < cardsToScrape.length - 1) {
        // Si la SIGUIENTE carta también está en cache, no esperar
        const nextCard = cardsToScrape[i + 1];
        const nextCacheKey = nextCard.tcgUrl || (nextCard.tcgplayerProductId ? `https://www.tcgplayer.com/product/${nextCard.tcgplayerProductId}` : "");
        const nextIsFromCache = nextCacheKey && salesCache.has(nextCacheKey);

        if (!nextIsFromCache) {
          const delayMs = randomInt(args.minDelay, args.maxDelay);
          console.log(`  [delay] Esperando ${(delayMs / 1000).toFixed(1)}s...\n`);
          await configuredDelay();
        } else {
          console.log(""); // Solo salto de línea
        }
      }
    }

    console.log(`\n📊 Estadísticas de scraping:`);
    console.log(`   Scrapeadas: ${scrapedCount}`);
    console.log(`   Desde cache: ${cachedCount}`);
    console.log(`   Tiempo ahorrado: ~${((cachedCount * (args.minDelay + args.maxDelay) / 2) / 1000).toFixed(0)}s\n`);

    // Output
    if (args.outputJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      generateReport(result);
    }

  } finally {
    await scraper.close();
    console.log("\n✅ Navegador cerrado\n");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
