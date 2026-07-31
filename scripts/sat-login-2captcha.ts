#!/usr/bin/env npx tsx
/**
 * Login al portal CFDI del SAT resolviendo el CAPTCHA con 2Captcha.
 *
 * Flujo:
 *   1. Abre el portal (redirige a la página de login del SAT).
 *   2. Extrae la imagen del captcha (base64 embebido en #divCaptcha img).
 *   3. La manda a 2Captcha (image-to-text) y espera la solución.
 *   4. Rellena RFC + Contraseña (CIEC) + texto del captcha.
 *   5. Por seguridad NO envía el formulario salvo que pases --submit.
 *
 * Variables de entorno (.env):
 *   CAPTCHA_API_KEY=<tu api key de 2captcha>
 *   SAT_RFC=<tu RFC>
 *   SAT_CIEC=<tu contraseña CIEC>
 *
 * Uso:
 *   npx tsx scripts/sat-login-2captcha.ts            # demo: resuelve y rellena, NO envía
 *   npx tsx scripts/sat-login-2captcha.ts --submit   # además hace clic en "Enviar"
 *   npx tsx scripts/sat-login-2captcha.ts --headless  # sin interfaz
 */

import "dotenv/config";
import { chromium } from "playwright";

const PORTAL_CFDI = "https://portalcfdi.facturaelectronica.sat.gob.mx/";

const HEADLESS = process.argv.includes("--headless");
const DO_SUBMIT = process.argv.includes("--submit");

const API_KEY = process.env.CAPTCHA_API_KEY ?? "";
const RFC = process.env.SAT_RFC ?? "";
const CIEC = process.env.SAT_CIEC ?? "";

// Selectores conocidos del login CIEC del SAT
const SEL = {
  captchaImg: "#divCaptcha img",
  captchaInput: "#userCaptcha",
  rfc: "#Ecom_User_ID",
  password: "#Ecom_Password",
  submit: "#submit",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Resuelve un captcha de imagen-texto con la API JSON de 2Captcha
 * (createTask / getTaskResult, tipo ImageToTextTask).
 * @param base64 imagen en base64 SIN el prefijo "data:image/...;base64,"
 */
async function solveWith2Captcha(base64: string): Promise<string> {
  // 1) Crear la tarea
  const createRes = (await fetch("https://api.2captcha.com/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: API_KEY,
      task: {
        type: "ImageToTextTask",
        body: base64,
        case: true, // respeta mayúsculas/minúsculas (el SAT las distingue)
      },
      languagePool: "en",
    }),
  }).then((r) => r.json())) as {
    errorId: number;
    errorCode?: string;
    errorDescription?: string;
    taskId?: number;
  };

  if (createRes.errorId !== 0 || !createRes.taskId) {
    throw new Error(
      `2Captcha createTask error: ${createRes.errorCode} ${createRes.errorDescription}`
    );
  }

  const taskId = createRes.taskId;
  console.log(`📨 Tarea creada en 2Captcha (taskId=${taskId}). Esperando solución...`);

  // 2) Polling del resultado (suele tardar 5-30s)
  const maxIntentos = 24; // ~120s
  for (let i = 0; i < maxIntentos; i++) {
    await sleep(5000);
    const res = (await fetch("https://api.2captcha.com/getTaskResult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: API_KEY, taskId }),
    }).then((r) => r.json())) as {
      errorId: number;
      errorCode?: string;
      errorDescription?: string;
      status?: "processing" | "ready";
      solution?: { text: string };
    };

    if (res.errorId !== 0) {
      throw new Error(
        `2Captcha getTaskResult error: ${res.errorCode} ${res.errorDescription}`
      );
    }
    if (res.status === "ready" && res.solution) {
      console.log(`✅ Captcha resuelto: ${res.solution.text}`);
      return res.solution.text;
    }
    process.stdout.write(".");
  }
  throw new Error("2Captcha: tiempo de espera agotado");
}

async function main() {
  if (!API_KEY) throw new Error("Falta CAPTCHA_API_KEY en .env");

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ["--start-maximized"],
  });
  const context = await browser.newContext({
    viewport: null,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log("🌐 Abriendo portal CFDI del SAT...");
  await page.goto(PORTAL_CFDI, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // Esperar la imagen del captcha
  const img = page.locator(SEL.captchaImg).first();
  await img.waitFor({ state: "visible", timeout: 30_000 });

  // Extraer el base64 del atributo src (quitando el prefijo data:)
  const src = await img.getAttribute("src");
  if (!src) throw new Error("No se encontró el src del captcha");
  const base64 = src.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
  console.log(`🖼️  Captcha extraído (${base64.length} chars base64).`);

  // Resolver con 2Captcha
  const solucion = await solveWith2Captcha(base64);

  // Rellenar el formulario
  await page.fill(SEL.captchaInput, solucion);
  if (RFC) await page.fill(SEL.rfc, RFC);
  if (CIEC) await page.fill(SEL.password, CIEC);
  console.log(
    `📝 Formulario rellenado (captcha=${solucion}${RFC ? ", RFC ✔" : ""}${CIEC ? ", CIEC ✔" : ""}).`
  );

  if (DO_SUBMIT) {
    if (!RFC || !CIEC) {
      console.warn("⚠️  --submit pedido pero falta SAT_RFC o SAT_CIEC. No se envía.");
    } else {
      console.log("🚀 Enviando login...");
      await Promise.all([
        page.waitForLoadState("networkidle").catch(() => {}),
        page.click(SEL.submit),
      ]);
      console.log(`✅ Tras login, URL actual: ${page.url()}`);
    }
  } else {
    console.log("🧪 Modo demo: NO se envió el formulario. Usa --submit para iniciar sesión.");
  }

  // Captura del estado actual para que veas el resultado
  await page.screenshot({ path: "/tmp/sat-resultado.png", fullPage: true });
  console.log("📸 Captura guardada en /tmp/sat-resultado.png");

  if (!HEADLESS) {
    console.log("👀 Navegador abierto. Ctrl+C para cerrar.");
    await new Promise<void>((resolve) => {
      browser.on("disconnected", () => resolve());
      process.on("SIGINT", () => resolve());
    });
  }
  await browser.close().catch(() => {});
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exitCode = 1;
});
