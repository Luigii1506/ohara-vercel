#!/usr/bin/env npx tsx
/**
 * Abre el portal de Consulta de CFDI del SAT.
 *
 * Navega a la página informativa del SAT, localiza el botón
 * "Ejecutar en línea" (que apunta a https://portalcfdi.facturaelectronica.sat.gob.mx/
 * y abre en pestaña nueva con target="__blank") y hace clic en él.
 *
 * El portal requiere autenticación manual (RFC + Contraseña/CIEC o e.firma),
 * por eso el navegador se abre en modo visible (headful) y se mantiene abierto.
 *
 * Uso:
 *   npx tsx scripts/sat-abrir-portal-cfdi.ts
 *   npx tsx scripts/sat-abrir-portal-cfdi.ts --headless   # sin interfaz (no recomendado: hay que loguearse)
 */

import { chromium, type Page } from "playwright";

const PAGINA_INFO =
  "https://wwwmat.sat.gob.mx/aplicacion/82471/consulta,-cancela-y-recupera-tus-facturas-electronicas";
const PORTAL_CFDI = "https://portalcfdi.facturaelectronica.sat.gob.mx/";

const HEADLESS = process.argv.includes("--headless");

async function main() {
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: null, // usa el tamaño real de la ventana
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  console.log(`🌐 Abriendo página informativa del SAT...`);
  await page.goto(PAGINA_INFO, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // El botón "Ejecutar en línea" abre una pestaña nueva (target="__blank").
  // Capturamos el evento 'popup' que dispara ese clic.
  const selectorBoton = 'a.actionButton:has-text("Ejecutar en línea")';

  let portal: Page | null = null;

  try {
    console.log(`🔎 Buscando el botón "Ejecutar en línea"...`);
    const boton = page.locator(selectorBoton).first();
    await boton.waitFor({ state: "visible", timeout: 20_000 });

    console.log(`🖱️  Haciendo clic (se abrirá una pestaña nueva)...`);
    const [popup] = await Promise.all([
      context.waitForEvent("page", { timeout: 30_000 }),
      boton.click(),
    ]);
    portal = popup;
  } catch (err) {
    // Fallback: si el botón no se encuentra (cambió el HTML, banner de cookies,
    // etc.), navegamos directo al portal en una pestaña nueva.
    console.warn(
      `⚠️  No se pudo usar el botón (${(err as Error).message}). Abriendo el portal directamente...`
    );
    portal = await context.newPage();
    await portal.goto(PORTAL_CFDI, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }

  await portal.bringToFront();
  await portal.waitForLoadState("domcontentloaded").catch(() => {});

  console.log(`✅ Portal abierto en: ${portal.url()}`);
  console.log(`👉 Inicia sesión manualmente (RFC + Contraseña/CIEC o e.firma).`);
  console.log(`   El navegador permanecerá abierto. Cierra la ventana o presiona Ctrl+C para salir.`);

  // Mantener el proceso vivo para que puedas usar el portal.
  await new Promise<void>((resolve) => {
    browser.on("disconnected", () => resolve());
    process.on("SIGINT", () => resolve());
  });

  await browser.close().catch(() => {});
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exitCode = 1;
});
