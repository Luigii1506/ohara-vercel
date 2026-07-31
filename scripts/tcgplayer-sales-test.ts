#!/usr/bin/env npx tsx
/**
 * Test rápido del scraper de ventas de TCGPlayer
 *
 * Uso:
 *   npx tsx scripts/tcgplayer-sales-test.ts
 *   npx tsx scripts/tcgplayer-sales-test.ts --headless=false
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// Inline stealth utilities
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function humanDelay(baseMs: number): Promise<void> {
  const variance = baseMs * 0.3;
  const actualDelay = baseMs + (Math.random() * variance * 2 - variance);
  return new Promise((resolve) => setTimeout(resolve, Math.max(100, actualDelay)));
}

async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: randomElement(USER_AGENTS),
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Ch-Ua": '"Chromium";v="122"',
      "Sec-Ch-Ua-Mobile": "?0",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  return context;
}

class StealthScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(private options: { headless?: boolean } = {}) {}

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.options.headless ?? true,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    this.context = await createStealthContext(this.browser);
  }

  async newPage(): Promise<Page> {
    if (!this.context) throw new Error("Not initialized");
    return this.context.newPage();
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }
}

const TEST_URL =
  "https://www.tcgplayer.com/product/593300/one-piece-card-game-premium-booster-the-best-tsuru-full-art";

async function main() {
  const headless = !process.argv.includes("--headless=false");

  console.log("\n🧪 TEST: TCGPlayer Sales Scraper");
  console.log("================================");
  console.log(`URL: ${TEST_URL}`);
  console.log(`Headless: ${headless}\n`);

  const scraper = new StealthScraper({ headless });

  try {
    console.log("[1/5] Inicializando navegador sigiloso...");
    await scraper.init();

    const page = await scraper.newPage();

    console.log("[2/5] Navegando a la página del producto...");
    await page.goto(TEST_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await humanDelay(3000);

    // Scroll para cargar contenido lazy
    console.log("[3/5] Scrolling para cargar contenido...");
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, 400);
        await new Promise((r) => setTimeout(r, 800));
      }
    });

    await humanDelay(2000);

    // Buscar el botón "View More Data"
    console.log('[4/5] Buscando botón "View More Data"...');

    // Intentar múltiples selectores
    const buttonSelectors = [
      'div[role="button"]:has-text("View More Data")',
      'button:has-text("View More Data")',
      'text="View More Data"',
      ".price-points__view-more",
      '[class*="view-more"]',
    ];

    let buttonFound = false;
    for (const selector of buttonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await button.isVisible();
          console.log(`  ✓ Encontrado con selector: ${selector} (visible: ${isVisible})`);

          if (isVisible) {
            await button.click();
            buttonFound = true;
            console.log("  → Click realizado");
            break;
          }
        }
      } catch (e) {
        // Continuar con siguiente selector
      }
    }

    if (!buttonFound) {
      // Buscar por texto directamente
      console.log("  Intentando locator por texto...");
      try {
        const textButton = page.locator('text="View More Data"').first();
        if (await textButton.isVisible()) {
          await textButton.click();
          buttonFound = true;
          console.log("  ✓ Click por locator de texto");
        }
      } catch (e) {
        console.log("  ✗ No se encontró por texto");
      }
    }

    if (!buttonFound) {
      console.log("\n⚠️  No se encontró el botón 'View More Data'");
      console.log("   Esto puede significar:");
      console.log("   - La carta no tiene historial de ventas");
      console.log("   - El selector ha cambiado");
      console.log("   - El contenido no cargó completamente");

      // Screenshot para debug
      const screenshotPath = "/tmp/tcgplayer-debug.png";
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`\n📸 Screenshot guardado en: ${screenshotPath}`);

      // Imprimir HTML de la sección de precios
      const priceSection = await page.$(".price-points, .product__price-points");
      if (priceSection) {
        const html = await priceSection.innerHTML();
        console.log("\n📝 HTML de la sección de precios:");
        console.log(html.substring(0, 1000) + "...");
      }

      await page.close();
      return;
    }

    await humanDelay(2500);

    // Extraer datos de la tabla de ventas
    console.log("[5/5] Extrayendo datos de ventas...\n");

    try {
      await page.waitForSelector(".latest-sales-table, .latest-sales", {
        timeout: 10000,
      });
    } catch {
      console.log("⚠️  Tabla de ventas no encontrada después del click");

      const screenshotPath = "/tmp/tcgplayer-modal-debug.png";
      await page.screenshot({ path: screenshotPath });
      console.log(`📸 Screenshot: ${screenshotPath}`);

      await page.close();
      return;
    }

    const sales = await page.$$eval(
      ".latest-sales-table__tbody tr, .latest-sales-table tbody tr",
      (rows) => {
        return rows.map((row) => {
          const cells = row.querySelectorAll("td");
          return {
            date: cells[0]?.textContent?.trim() || "",
            condition: cells[1]?.textContent?.trim() || "",
            quantity: cells[2]?.textContent?.trim() || "",
            price: cells[3]?.textContent?.trim() || "",
          };
        });
      }
    );

    console.log("📊 VENTAS RECIENTES:");
    console.log("-".repeat(60));
    console.log(
      `${"Fecha".padEnd(12)} | ${"Condición".padEnd(20)} | ${"Qty".padEnd(5)} | Precio`
    );
    console.log("-".repeat(60));

    let totalForAvg = 0;
    const pricesToAverage: number[] = [];

    sales.forEach((sale, idx) => {
      console.log(
        `${sale.date.padEnd(12)} | ${sale.condition.padEnd(20)} | ${sale.quantity.padEnd(5)} | ${sale.price}`
      );

      // Parse price for averaging
      const priceNum = parseFloat(sale.price.replace(/[^0-9.]/g, ""));
      if (!isNaN(priceNum) && idx < 3) {
        pricesToAverage.push(priceNum);
        totalForAvg += priceNum;
      }
    });

    console.log("-".repeat(60));
    console.log(`Total ventas mostradas: ${sales.length}`);

    if (pricesToAverage.length > 0) {
      const avg = totalForAvg / pricesToAverage.length;
      console.log(`\n💰 PROMEDIO TOP ${pricesToAverage.length}:`);
      console.log(`   Precios: ${pricesToAverage.map((p) => `$${p.toFixed(2)}`).join(" + ")}`);
      console.log(`   Promedio: $${avg.toFixed(2)}`);
    }

    await page.close();
    console.log("\n✅ Test completado exitosamente!");
  } catch (error) {
    console.error("\n❌ Error:", error);
  } finally {
    await scraper.close();
    console.log("\n🔒 Navegador cerrado\n");
  }
}

main();
