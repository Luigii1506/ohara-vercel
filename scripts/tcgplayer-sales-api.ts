#!/usr/bin/env npx tsx
/**
 * TCGPlayer Latest Sales - Versión API (RÁPIDA)
 *
 * Usa la API interna de TCGPlayer (sin Playwright)
 * ~100x más rápido que la versión con scraping
 *
 * Uso:
 *   npx tsx scripts/tcgplayer-sales-api.ts --listId=33
 *   npx tsx scripts/tcgplayer-sales-api.ts --productId=593300
 */

// ============================================================================
// Types
// ============================================================================

interface TCGSale {
  condition: string;
  variant: string;
  language: string;
  quantity: number;
  title: string;
  listingType: string;
  purchasePrice: number;
  shippingPrice: number;
  orderDate: string;
}

interface TCGLatestSalesResponse {
  previousPage: string;
  nextPage: string;
  resultCount: number;
  totalResults: number;
  data: TCGSale[];
}

interface CardSalesData {
  cardCode: string;
  cardName: string;
  productId: number;
  sales: TCGSale[];
  top3Average: number | null;
  allTimeAverage: number | null;
  error?: string;
}

interface ListCard {
  id: number;
  cardId: string;
  quantity: number;
  card: {
    code: string;
    name: string;
    tcgplayerProductId?: number | null;
    marketPrice?: number | null;
  };
}

// ============================================================================
// API Client
// ============================================================================

const API_BASE = "https://mpapi.tcgplayer.com/v2/product";

const HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Origin: "https://www.tcgplayer.com",
  Referer: "https://www.tcgplayer.com/",
  "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
};

async function fetchLatestSales(productId: number): Promise<TCGLatestSalesResponse> {
  const url = `${API_BASE}/${productId}/latestsales`;

  const response = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({}), // Body vacío pero requerido para POST
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// CLI Args
// ============================================================================

interface CliArgs {
  listId?: number;
  productId?: number;
  limit?: number;
  salesToAverage: number;
  outputJson: boolean;
  minDelay: number;
  language: string; // Filtrar ventas por idioma (English, Japanese, etc.)
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    salesToAverage: 3,
    outputJson: false,
    minDelay: 100, // Muy poco delay necesario con API
    language: "English", // Por defecto solo ventas en inglés
  };

  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [key, value] = arg.slice(2).split("=");

    switch (key) {
      case "listId":
        parsed.listId = parseInt(value, 10) || undefined;
        break;
      case "productId":
        parsed.productId = parseInt(value, 10) || undefined;
        break;
      case "limit":
        parsed.limit = parseInt(value, 10) || undefined;
        break;
      case "salesToAverage":
        parsed.salesToAverage = parseInt(value, 10) || 3;
        break;
      case "json":
        parsed.outputJson = true;
        break;
      case "minDelay":
        parsed.minDelay = parseInt(value, 10) || 100;
        break;
      case "language":
        parsed.language = value || "English";
        break;
    }
  }

  return parsed;
}

// ============================================================================
// List Fetching
// ============================================================================

async function fetchListCards(listId: number): Promise<{ name: string; cards: ListCard[] }> {
  const apiUrl = process.env.API_BASE_URL || "http://localhost:3000";

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
// Processing
// ============================================================================

async function processCard(
  productId: number,
  code: string,
  name: string,
  salesToAverage: number,
  language: string = "English"
): Promise<CardSalesData> {
  const result: CardSalesData = {
    cardCode: code,
    cardName: name,
    productId,
    sales: [],
    top3Average: null,
    allTimeAverage: null,
  };

  try {
    const response = await fetchLatestSales(productId);
    const allSales = response.data || [];

    // Filtrar ventas por idioma (la API devuelve todas las versiones mezcladas)
    // El campo language puede ser "English", "Japanese", etc.
    // PERO: algunas ventas japonesas tienen language="English" pero el título dice "Japanese Ver." o "Japanere Ver."
    // Así que también filtramos por título
    const japaneseIndicators = ["japanese", "japanere", "jp ver", "jpn ver", "japan ver"];

    // Excluir cartas gradeadas (PSA, CGC, BGS, etc.) - tienen precios muy diferentes
    const gradedIndicators = ["psa ", "psa-", "cgc ", "cgc-", "bgs ", "bgs-", "sgc ", "sgc-", "graded", "gem mint"];

    result.sales = allSales.filter((s) => {
      const titleLower = (s.title || "").toLowerCase();

      // Siempre excluir cartas gradeadas
      const isGraded = gradedIndicators.some(indicator => titleLower.includes(indicator));
      if (isGraded) return false;

      // Si queremos English, excluir las que tienen indicadores de japonés en el título
      if (language === "English") {
        const hasJapaneseInTitle = japaneseIndicators.some(indicator => titleLower.includes(indicator));
        return s.language === language && !hasJapaneseInTitle;
      }
      // Si queremos Japanese, incluir las que tienen language=Japanese O indicadores en el título
      if (language === "Japanese") {
        const hasJapaneseInTitle = japaneseIndicators.some(indicator => titleLower.includes(indicator));
        return s.language === language || hasJapaneseInTitle;
      }
      // Para otros idiomas, solo filtrar por el campo language
      return s.language === language;
    });

    if (result.sales.length > 0) {
      // Calcular promedio de todas las ventas (filtradas por idioma)
      const allPrices = result.sales.map((s) => s.purchasePrice);
      result.allTimeAverage = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;

      // Calcular promedio de las primeras N ventas
      const topPrices = result.sales.slice(0, salesToAverage).map((s) => s.purchasePrice);
      result.top3Average = topPrices.reduce((a, b) => a + b, 0) / topPrices.length;
    }
  } catch (error: any) {
    result.error = error.message;
  }

  return result;
}

// ============================================================================
// Report
// ============================================================================

interface ReportData {
  listName?: string;
  totalCards: number;
  successful: number;
  failed: number;
  breakdown: Array<{
    code: string;
    name: string;
    qty: number;
    top3Avg: number | null;
    subtotal: number;
  }>;
  totalValue: number;
}

function generateReport(data: ReportData) {
  console.log("\n" + "=".repeat(80));
  console.log("📊 REPORTE DE VALORACIÓN (API RÁPIDA)");
  console.log("=".repeat(80));

  if (data.listName) {
    console.log(`\n📁 Lista: ${data.listName}`);
  }
  console.log(`🎴 Total cartas: ${data.totalCards}`);
  console.log(`✅ Exitosos: ${data.successful}`);
  console.log(`❌ Fallidos: ${data.failed}`);

  console.log("\n" + "-".repeat(80));
  console.log("DESGLOSE:");
  console.log("-".repeat(80));
  console.log(
    `${"Código".padEnd(15)} | ${"Nombre".padEnd(30)} | ${"Qty".padStart(3)} | ${"Top3 Avg".padStart(10)} | ${"Subtotal".padStart(12)}`
  );
  console.log("-".repeat(80));

  for (const item of data.breakdown) {
    const avgStr = item.top3Avg !== null ? `$${item.top3Avg.toFixed(2)}` : "N/A";
    const subtotalStr = `$${item.subtotal.toFixed(2)}`;

    console.log(
      `${item.code.padEnd(15)} | ${item.name.substring(0, 30).padEnd(30)} | ${String(item.qty).padStart(3)} | ${avgStr.padStart(10)} | ${subtotalStr.padStart(12)}`
    );
  }

  console.log("-".repeat(80));
  console.log(`\n💰 VALOR TOTAL: $${data.totalValue.toFixed(2)}`);
  console.log("=".repeat(80) + "\n");
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs();

  if (!args.listId && !args.productId) {
    console.log(`
TCGPlayer Latest Sales - API Version (FAST)
============================================

Uso:
  npx tsx scripts/tcgplayer-sales-api.ts --listId=33
  npx tsx scripts/tcgplayer-sales-api.ts --productId=593300

Opciones:
  --listId=N          ID de la lista
  --productId=N       ID de producto individual
  --limit=N           Limitar cartas a procesar
  --salesToAverage=N  Ventas para promediar (default: 3)
  --language=LANG     Filtrar ventas por idioma (default: English)
                      Valores: English, Japanese, German, French, etc.
  --json              Salida JSON
  --minDelay=N        Delay entre requests en ms (default: 100)

⚠️  IMPORTANTE: La API devuelve ventas de TODOS los idiomas mezcladas.
   Por defecto solo se cuentan ventas "English" para evitar mezclar
   precios de versiones japonesas (que suelen ser más baratas).

⚡ Esta versión es ~100x más rápida que el scraper con Playwright
`);
    process.exit(0);
  }

  console.log("\n⚡ TCGPlayer Sales API (Versión Rápida)");
  console.log("=".repeat(50));

  const startTime = Date.now();

  // Single product test
  if (args.productId && !args.listId) {
    console.log(`\nProducto: ${args.productId}`);
    console.log(`Idioma: ${args.language}`);
    const result = await processCard(args.productId, "TEST", "Test Product", args.salesToAverage, args.language);

    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    } else {
      console.log(`✅ Ventas encontradas (${args.language}): ${result.sales.length}`);
      console.log(`\n📊 Últimas ventas (${args.language}):`);
      result.sales.slice(0, 5).forEach((sale, i) => {
        const date = new Date(sale.orderDate).toLocaleDateString();
        console.log(`   ${i + 1}. ${date} - ${sale.condition} ${sale.variant} - $${sale.purchasePrice.toFixed(2)}`);
      });
      console.log(`\n💰 Promedio Top ${args.salesToAverage}: $${result.top3Average?.toFixed(2) || "N/A"}`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`\n⏱️  Tiempo: ${elapsed}ms`);
    return;
  }

  // List processing
  if (args.listId) {
    console.log(`\n📋 Cargando lista ${args.listId}...`);

    const { name, cards } = await fetchListCards(args.listId);
    console.log(`   Lista: ${name}`);
    console.log(`   Cartas: ${cards.length}`);

    // Filter cards with productId
    let cardsToProcess = cards.filter((c) => c.card.tcgplayerProductId);

    if (args.limit) {
      cardsToProcess = cardsToProcess.slice(0, args.limit);
    }

    // Deduplicate by productId
    const uniqueProducts = new Map<number, { code: string; name: string; totalQty: number }>();
    for (const card of cardsToProcess) {
      const pid = card.card.tcgplayerProductId!;
      const existing = uniqueProducts.get(pid);
      if (existing) {
        existing.totalQty += card.quantity;
      } else {
        uniqueProducts.set(pid, {
          code: card.card.code,
          name: card.card.name,
          totalQty: card.quantity,
        });
      }
    }

    console.log(`   Productos únicos: ${uniqueProducts.size}`);
    console.log(`   Idioma filtro: ${args.language}`);
    console.log(`\n🚀 Obteniendo ventas (solo ${args.language})...\n`);

    const reportData: ReportData = {
      listName: name,
      totalCards: cardsToProcess.length,
      successful: 0,
      failed: 0,
      breakdown: [],
      totalValue: 0,
    };

    // Cache for results
    const resultsCache = new Map<number, CardSalesData>();

    let processed = 0;
    for (const [productId, info] of uniqueProducts) {
      processed++;
      process.stdout.write(`\r   [${processed}/${uniqueProducts.size}] ${info.code}...`);

      const result = await processCard(productId, info.code, info.name, args.salesToAverage, args.language);
      resultsCache.set(productId, result);

      if (result.error) {
        reportData.failed++;
      } else {
        reportData.successful++;
      }

      // Small delay to be nice to the API
      if (args.minDelay > 0) {
        await new Promise((r) => setTimeout(r, args.minDelay));
      }
    }

    console.log("\r" + " ".repeat(60) + "\r"); // Clear line

    // Build breakdown using grouped cards (duplicates aggregated)
    for (const [productId, info] of uniqueProducts) {
      const result = resultsCache.get(productId);

      const top3Avg = result?.top3Average || 0;
      const subtotal = top3Avg * info.totalQty;

      reportData.breakdown.push({
        code: info.code,
        name: info.name,
        qty: info.totalQty,
        top3Avg: result?.top3Average || null,
        subtotal,
      });

      reportData.totalValue += subtotal;
    }

    const elapsed = Date.now() - startTime;

    if (args.outputJson) {
      console.log(JSON.stringify(reportData, null, 2));
    } else {
      generateReport(reportData);
      console.log(`⏱️  Tiempo total: ${(elapsed / 1000).toFixed(2)}s`);
      console.log(`📈 Velocidad: ${(uniqueProducts.size / (elapsed / 1000)).toFixed(1)} productos/segundo\n`);
    }
  }
}

main().catch(console.error);
