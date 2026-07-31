#!/usr/bin/env npx tsx
/**
 * Test de la API interna de TCGPlayer para Latest Sales
 *
 * Prueba el endpoint no documentado:
 * https://mpapi.tcgplayer.com/v2/product/{productId}/latestsales
 *
 * Uso:
 *   npx tsx scripts/tcgplayer-api-test.ts
 *   npx tsx scripts/tcgplayer-api-test.ts --productId=593300
 */

// Producto de prueba (Tsuru Full Art)
const DEFAULT_PRODUCT_ID = 593300;

interface LatestSale {
  condition: string;
  variant: string;
  quantity: number;
  purchasePrice: number;
  orderDate: string;
}

interface LatestSalesResponse {
  productId?: number;
  data?: LatestSale[];
  // Campos alternativos que podría tener
  results?: LatestSale[];
  sales?: LatestSale[];
  latestSales?: LatestSale[];
}

async function testLatestSalesAPI(productId: number) {
  const endpoints = [
    // Variantes del endpoint que podrían existir
    `https://mpapi.tcgplayer.com/v2/product/${productId}/latestsales`,
    `https://mpapi.tcgplayer.com/v2/product/${productId}/latest-sales`,
    `https://mpapi.tcgplayer.com/v2/products/${productId}/latestsales`,
    `https://mp-search-api.tcgplayer.com/v1/product/${productId}/latestsales`,
    `https://mp-search-api.tcgplayer.com/v1/product/${productId}/pricehistory`,
  ];

  // Headers que simularían un navegador real
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Origin: "https://www.tcgplayer.com",
    Referer: `https://www.tcgplayer.com/product/${productId}`,
    "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
  };

  console.log(`\n🧪 Testing TCGPlayer Internal API`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Product ID: ${productId}`);
  console.log(`Product URL: https://www.tcgplayer.com/product/${productId}\n`);

  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing: ${endpoint}`);
    console.log("-".repeat(60));

    try {
      // Test GET request
      console.log("  [GET] Trying...");
      const getResponse = await fetch(endpoint, {
        method: "GET",
        headers,
      });

      console.log(`  Status: ${getResponse.status} ${getResponse.statusText}`);
      console.log(`  Content-Type: ${getResponse.headers.get("content-type")}`);

      if (getResponse.ok) {
        const data = await getResponse.json();
        console.log(`  ✅ SUCCESS!`);
        console.log(`  Response keys: ${Object.keys(data).join(", ")}`);
        console.log(`  Full response:`);
        console.log(JSON.stringify(data, null, 2).substring(0, 1000));
        return { success: true, endpoint, method: "GET", data };
      } else {
        const text = await getResponse.text();
        console.log(`  ❌ Failed: ${text.substring(0, 200)}`);
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }

    try {
      // Test POST request (algunos endpoints requieren POST)
      console.log("  [POST] Trying...");

      const postBody = {
        productId,
        // Parámetros comunes que podrían necesitarse
        limit: 25,
        offset: 0,
      };

      const postResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postBody),
      });

      console.log(`  Status: ${postResponse.status} ${postResponse.statusText}`);

      if (postResponse.ok) {
        const data = await postResponse.json();
        console.log(`  ✅ SUCCESS!`);
        console.log(`  Response keys: ${Object.keys(data).join(", ")}`);
        console.log(`  Full response:`);
        console.log(JSON.stringify(data, null, 2).substring(0, 1000));
        return { success: true, endpoint, method: "POST", data };
      } else {
        const text = await postResponse.text();
        console.log(`  ❌ Failed: ${text.substring(0, 200)}`);
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  return { success: false };
}

// También probar la API oficial con nuestras credenciales
async function testOfficialAPI(productId: number) {
  console.log(`\n\n📡 Testing Official TCGPlayer API (if credentials exist)`);
  console.log("=".repeat(60));

  const publicKey = process.env.TCGPLAYER_PUBLIC_KEY;
  const privateKey = process.env.TCGPLAYER_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.log("  ⚠️  No TCGPLAYER_PUBLIC_KEY or TCGPLAYER_PRIVATE_KEY found in env");
    console.log("  Skipping official API test");
    return null;
  }

  try {
    // Get token
    console.log("  [1/2] Getting access token...");
    const tokenResponse = await fetch("https://api.tcgplayer.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: publicKey,
        client_secret: privateKey,
      }),
    });

    if (!tokenResponse.ok) {
      console.log(`  ❌ Token request failed: ${tokenResponse.status}`);
      return null;
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;
    console.log(`  ✅ Got token`);

    // Check if there's a latestsales endpoint in official API
    console.log("  [2/2] Checking for latestsales in official API...");

    // Try official pricing endpoint
    const pricingResponse = await fetch(
      `https://api.tcgplayer.com/pricing/product/${productId}`,
      {
        headers: {
          Authorization: `bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (pricingResponse.ok) {
      const pricingData = await pricingResponse.json();
      console.log(`  ✅ Official pricing API works`);
      console.log(`  Response:`);
      console.log(JSON.stringify(pricingData, null, 2).substring(0, 500));
    }

    // Try to find any latestsales endpoint
    const possibleEndpoints = [
      `https://api.tcgplayer.com/v1.39.0/pricing/product/${productId}/latestsales`,
      `https://api.tcgplayer.com/pricing/product/${productId}/history`,
      `https://api.tcgplayer.com/catalog/products/${productId}/sales`,
    ];

    for (const endpoint of possibleEndpoints) {
      console.log(`  Trying: ${endpoint}`);
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `bearer ${token}`,
          Accept: "application/json",
        },
      });
      console.log(`    Status: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`    ✅ Found! Response: ${JSON.stringify(data).substring(0, 300)}`);
      }
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
  }
}

// Probar interceptando la llamada real del sitio web
async function discoverAPIFromWebsite(productId: number) {
  console.log(`\n\n🔍 Discovering API by intercepting website requests`);
  console.log("=".repeat(60));
  console.log("  This requires Playwright to capture network requests...\n");

  try {
    const { chromium } = await import("playwright");

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // Capturar requests de red
    const apiRequests: Array<{ url: string; method: string; headers: Record<string, string> }> = [];

    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("latestsales") ||
        url.includes("latest-sales") ||
        url.includes("pricehistory") ||
        url.includes("price-history") ||
        (url.includes("mpapi") && url.includes(String(productId)))
      ) {
        apiRequests.push({
          url,
          method: request.method(),
          headers: request.headers(),
        });
        console.log(`  📡 Captured: ${request.method()} ${url}`);
      }
    });

    page.on("response", async (response) => {
      const url = response.url();
      if (
        url.includes("latestsales") ||
        url.includes("latest-sales") ||
        url.includes("pricehistory")
      ) {
        try {
          const data = await response.json();
          console.log(`  📥 Response from ${url}:`);
          console.log(JSON.stringify(data, null, 2).substring(0, 500));
        } catch {
          // Not JSON
        }
      }
    });

    console.log(`  Navigating to product page...`);
    await page.goto(`https://www.tcgplayer.com/product/${productId}`, {
      waitUntil: "networkidle",
    });

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);

    // Click "View More Data" if exists
    try {
      const viewMoreBtn = page.locator('text="View More Data"').first();
      if (await viewMoreBtn.isVisible()) {
        console.log(`  Clicking "View More Data"...`);
        await viewMoreBtn.click();
        await page.waitForTimeout(3000);
      }
    } catch {
      // Button might not exist
    }

    await browser.close();

    if (apiRequests.length > 0) {
      console.log(`\n  ✅ Discovered ${apiRequests.length} API calls:`);
      apiRequests.forEach((req, i) => {
        console.log(`\n  [${i + 1}] ${req.method} ${req.url}`);
        console.log(`      Headers: ${JSON.stringify(req.headers).substring(0, 200)}...`);
      });
      return apiRequests;
    } else {
      console.log(`  ⚠️  No API calls captured for latestsales`);
      console.log(`  The data might be embedded in the page HTML or loaded differently`);
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
  }

  return [];
}

async function main() {
  // Parse product ID from args
  let productId = DEFAULT_PRODUCT_ID;
  const productIdArg = process.argv.find((arg) => arg.startsWith("--productId="));
  if (productIdArg) {
    productId = parseInt(productIdArg.split("=")[1], 10) || DEFAULT_PRODUCT_ID;
  }

  console.log("\n" + "🔬 TCGPlayer Latest Sales API Discovery Tool".padStart(50));
  console.log("=".repeat(60));

  // 1. Test known endpoints directly
  const directResult = await testLatestSalesAPI(productId);

  // 2. Test official API
  await testOfficialAPI(productId);

  // 3. Discover by intercepting website
  const discoveredAPIs = await discoverAPIFromWebsite(productId);

  // Summary
  console.log("\n\n" + "=".repeat(60));
  console.log("📋 SUMMARY");
  console.log("=".repeat(60));

  if (directResult.success) {
    console.log(`\n✅ Found working endpoint!`);
    console.log(`   Method: ${directResult.method}`);
    console.log(`   URL: ${directResult.endpoint}`);
    console.log(`\n   You can use this in your code:`);
    console.log(`   fetch("${directResult.endpoint}", { method: "${directResult.method}" })`);
  } else if (discoveredAPIs.length > 0) {
    console.log(`\n✅ Discovered API endpoints by intercepting website:`);
    discoveredAPIs.forEach((api) => {
      console.log(`   ${api.method} ${api.url}`);
    });
  } else {
    console.log(`\n❌ No direct API found for Latest Sales`);
    console.log(`   The data might only be available via scraping the HTML`);
    console.log(`   Use the tcgplayer-sales-scraper.ts script instead`);
  }
}

main().catch(console.error);
