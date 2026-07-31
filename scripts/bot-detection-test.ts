#!/usr/bin/env npx tsx
/**
 * Test de detección de bots usando bot.sannysoft.com
 *
 * Compara cómo se ve nuestro script vs un navegador normal
 *
 * Uso:
 *   npx tsx scripts/bot-detection-test.ts
 *   npx tsx scripts/bot-detection-test.ts --headless=false   # Ver el navegador
 */

import { chromium, type Browser, type BrowserContext } from "playwright";
import fs from "fs";
import path from "path";

const TEST_URL = "https://bot.sannysoft.com/";

// ============================================================================
// Configuración Stealth (igual que nuestro scraper)
// ============================================================================

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: randomElement(USER_AGENTS),
    viewport: { width: 1920, height: 1080 },
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

  // Inyectar scripts anti-detección
  await context.addInitScript(() => {
    // Ocultar webdriver
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Simular Chrome
    (window as any).chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {},
    };

    // Plugins simulados
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
        { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
        { name: "Native Client", filename: "internal-nacl-plugin" },
      ],
    });

    // Languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });

  return context;
}

// ============================================================================
// Tests
// ============================================================================

async function testWithStealth(headless: boolean) {
  console.log("\n🔒 Test CON configuración stealth");
  console.log("=".repeat(50));

  const browser = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await createStealthContext(browser);
  const page = await context.newPage();

  await page.goto(TEST_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Extraer resultados
  const results = await page.evaluate(() => {
    const rows = document.querySelectorAll("table tr");
    const data: Array<{ test: string; result: string; passed: boolean }> = [];

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 2) {
        const test = cells[0]?.textContent?.trim() || "";
        const resultCell = cells[1];
        const result = resultCell?.textContent?.trim() || "";
        const passed = resultCell?.classList.contains("passed") ||
                      resultCell?.style.backgroundColor === "green" ||
                      result.toLowerCase().includes("ok") ||
                      !resultCell?.classList.contains("failed");

        if (test) {
          data.push({ test, result: result.substring(0, 50), passed });
        }
      }
    });

    return data;
  });

  // Screenshot
  const screenshotPath = path.join(process.cwd(), "bot-test-stealth.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot guardado: ${screenshotPath}`);

  // Mostrar resultados
  console.log("\n📊 Resultados:");
  let passed = 0;
  let failed = 0;

  results.forEach((r) => {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.test.padEnd(25)} ${r.result}`);
    if (r.passed) passed++;
    else failed++;
  });

  console.log(`\n📈 Resumen: ${passed} pasaron, ${failed} fallaron`);

  await browser.close();
  return { passed, failed, results };
}

async function testWithoutStealth(headless: boolean) {
  console.log("\n🔓 Test SIN configuración stealth (Playwright básico)");
  console.log("=".repeat(50));

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(TEST_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Extraer resultados
  const results = await page.evaluate(() => {
    const rows = document.querySelectorAll("table tr");
    const data: Array<{ test: string; result: string; passed: boolean }> = [];

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 2) {
        const test = cells[0]?.textContent?.trim() || "";
        const resultCell = cells[1];
        const result = resultCell?.textContent?.trim() || "";
        const passed = resultCell?.classList.contains("passed") ||
                      resultCell?.style.backgroundColor === "green" ||
                      result.toLowerCase().includes("ok") ||
                      !resultCell?.classList.contains("failed");

        if (test) {
          data.push({ test, result: result.substring(0, 50), passed });
        }
      }
    });

    return data;
  });

  // Screenshot
  const screenshotPath = path.join(process.cwd(), "bot-test-no-stealth.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot guardado: ${screenshotPath}`);

  // Mostrar resultados
  console.log("\n📊 Resultados:");
  let passed = 0;
  let failed = 0;

  results.forEach((r) => {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.test.padEnd(25)} ${r.result}`);
    if (r.passed) passed++;
    else failed++;
  });

  console.log(`\n📈 Resumen: ${passed} pasaron, ${failed} fallaron`);

  await browser.close();
  return { passed, failed, results };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const headless = !process.argv.includes("--headless=false");

  console.log("\n🤖 BOT DETECTION TEST");
  console.log("=====================");
  console.log(`Modo: ${headless ? "Headless" : "Con ventana visible"}`);
  console.log(`URL: ${TEST_URL}`);

  // Test sin stealth
  const noStealth = await testWithoutStealth(headless);

  // Test con stealth
  const withStealth = await testWithStealth(headless);

  // Comparación
  console.log("\n" + "=".repeat(60));
  console.log("📊 COMPARACIÓN FINAL");
  console.log("=".repeat(60));
  console.log(`\nSIN stealth: ${noStealth.passed} ✅ / ${noStealth.failed} ❌`);
  console.log(`CON stealth: ${withStealth.passed} ✅ / ${withStealth.failed} ❌`);

  const improvement = withStealth.passed - noStealth.passed;
  if (improvement > 0) {
    console.log(`\n🎉 La configuración stealth mejora ${improvement} tests!`);
  } else if (improvement === 0) {
    console.log(`\n🤷 Ambos tienen el mismo resultado`);
  } else {
    console.log(`\n⚠️ La configuración stealth empeoró ${-improvement} tests`);
  }

  console.log("\n📸 Screenshots guardados:");
  console.log("   - bot-test-no-stealth.png (sin protección)");
  console.log("   - bot-test-stealth.png (con protección)");
  console.log("\nAbre las imágenes para ver los resultados visualmente.\n");
}

main().catch(console.error);
