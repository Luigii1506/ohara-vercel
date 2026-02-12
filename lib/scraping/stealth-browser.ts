import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// Realistic user agents - actualizados 2024/2025
const USER_AGENTS = [
  // Chrome Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  // Chrome Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  // Firefox Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  // Firefox Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
  // Safari Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  // Edge
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
];

// Viewport sizes comunes
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 },
];

// Locales realistas
const LOCALES = ["en-US", "en-GB", "es-ES", "es-MX"];

// Timezones
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Denver",
  "Europe/London",
];

export interface StealthBrowserOptions {
  headless?: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  slowMo?: number;
}

export interface StealthContextOptions {
  userAgent?: string;
  viewport?: { width: number; height: number };
  locale?: string;
  timezone?: string;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Delay con variación humana (no es perfectamente uniforme)
 */
export function humanDelay(baseMs: number, variancePercent = 0.3): Promise<void> {
  const variance = baseMs * variancePercent;
  const actualDelay = baseMs + (Math.random() * variance * 2 - variance);
  return new Promise((resolve) => setTimeout(resolve, Math.max(100, actualDelay)));
}

/**
 * Delay entre requests que simula comportamiento humano
 */
export function requestDelay(): Promise<void> {
  // Humanos típicamente esperan entre 1.5 y 4 segundos entre acciones
  const delay = randomInt(1500, 4000);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Delay largo para simular lectura de contenido
 */
export function readingDelay(): Promise<void> {
  const delay = randomInt(3000, 8000);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Crea un browser con configuración anti-detección
 */
export async function createStealthBrowser(
  options: StealthBrowserOptions = {}
): Promise<Browser> {
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: options.headless ?? true,
    slowMo: options.slowMo,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=CrossSiteDocumentBlockingIfIsolating",
      "--disable-site-isolation-trials",
      `--window-size=${randomElement(VIEWPORTS).width},${randomElement(VIEWPORTS).height}`,
    ],
  };

  if (options.proxy) {
    launchOptions.proxy = options.proxy;
  }

  return chromium.launch(launchOptions);
}

/**
 * Crea un contexto con fingerprint realista
 */
export async function createStealthContext(
  browser: Browser,
  options: StealthContextOptions = {}
): Promise<BrowserContext> {
  const userAgent = options.userAgent ?? randomElement(USER_AGENTS);
  const viewport = options.viewport ?? randomElement(VIEWPORTS);
  const locale = options.locale ?? randomElement(LOCALES);
  const timezone = options.timezone ?? randomElement(TIMEZONES);

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale,
    timezoneId: timezone,
    deviceScaleFactor: Math.random() > 0.5 ? 2 : 1,
    hasTouch: false,
    isMobile: false,
    javaScriptEnabled: true,
    bypassCSP: true,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Accept-Language": `${locale},en;q=0.9`,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": userAgent.includes("Windows") ? '"Windows"' : '"macOS"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  // Inyectar scripts anti-detección
  await context.addInitScript(() => {
    // Ocultar webdriver
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Chrome runtime
    (window as any).chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {},
    };

    // Plugins realistas
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
        { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
        { name: "Native Client", filename: "internal-nacl-plugin" },
      ],
    });

    // Languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en", "es"],
    });

    // Hardware concurrency realista
    Object.defineProperty(navigator, "hardwareConcurrency", {
      get: () => [2, 4, 8, 12, 16][Math.floor(Math.random() * 5)],
    });

    // Device memory realista
    Object.defineProperty(navigator, "deviceMemory", {
      get: () => [4, 8, 16, 32][Math.floor(Math.random() * 4)],
    });

    // Permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);

    // WebGL Vendor/Renderer
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
      if (parameter === 37445) {
        return "Intel Inc.";
      }
      if (parameter === 37446) {
        return "Intel Iris OpenGL Engine";
      }
      return getParameter.call(this, parameter);
    };
  });

  return context;
}

/**
 * Navega a una URL con comportamiento humano
 */
export async function stealthNavigate(
  page: Page,
  url: string,
  options: { waitForSelector?: string; timeout?: number } = {}
): Promise<void> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: options.timeout ?? 60000,
  });

  // Esperar un poco después de cargar
  await humanDelay(1500);

  // Scroll aleatorio para simular lectura
  await page.evaluate(() => {
    const scrollAmount = Math.floor(Math.random() * 300) + 100;
    window.scrollBy(0, scrollAmount);
  });

  await humanDelay(500);

  if (options.waitForSelector) {
    await page.waitForSelector(options.waitForSelector, {
      timeout: options.timeout ?? 30000,
    });
  }
}

/**
 * Mueve el mouse de forma natural
 */
export async function humanMouseMove(page: Page, x: number, y: number): Promise<void> {
  const steps = randomInt(10, 25);
  await page.mouse.move(x, y, { steps });
}

/**
 * Click con comportamiento humano
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  const box = await element.boundingBox();
  if (!box) {
    throw new Error(`Element has no bounding box: ${selector}`);
  }

  // Mover al elemento con variación
  const x = box.x + box.width / 2 + (Math.random() * 10 - 5);
  const y = box.y + box.height / 2 + (Math.random() * 10 - 5);

  await humanMouseMove(page, x, y);
  await humanDelay(100, 0.5);
  await page.mouse.click(x, y);
}

/**
 * Escribe texto como humano (con variación en velocidad)
 */
export async function humanType(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  await page.click(selector);
  await humanDelay(200);

  for (const char of text) {
    await page.keyboard.type(char, { delay: randomInt(50, 150) });
  }
}

/**
 * Rate limiter para requests
 */
export class RequestRateLimiter {
  private lastRequest = 0;
  private requestCount = 0;
  private readonly minInterval: number;
  private readonly maxRequestsPerMinute: number;

  constructor(minIntervalMs = 2000, maxRequestsPerMinute = 20) {
    this.minInterval = minIntervalMs;
    this.maxRequestsPerMinute = maxRequestsPerMinute;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequest;

    // Reset counter cada minuto
    if (timeSinceLast > 60000) {
      this.requestCount = 0;
    }

    // Si excedemos el límite por minuto, esperar
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = 60000 - timeSinceLast + randomInt(1000, 3000);
      console.log(`[RateLimiter] Waiting ${Math.round(waitTime / 1000)}s (rate limit)`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.requestCount = 0;
    }

    // Esperar el intervalo mínimo
    if (timeSinceLast < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLast + randomInt(500, 1500);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequest = Date.now();
    this.requestCount++;
  }
}

/**
 * Wrapper completo para scraping sigiloso
 */
export class StealthScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private rateLimiter: RequestRateLimiter;

  constructor(private options: StealthBrowserOptions = {}) {
    this.rateLimiter = new RequestRateLimiter(2000, 25);
  }

  async init(): Promise<void> {
    this.browser = await createStealthBrowser(this.options);
    this.context = await createStealthContext(this.browser);
  }

  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error("Scraper not initialized. Call init() first.");
    }
    return this.context.newPage();
  }

  async navigate(page: Page, url: string, waitForSelector?: string): Promise<void> {
    await this.rateLimiter.waitForSlot();
    await stealthNavigate(page, url, { waitForSelector });
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getContext(): BrowserContext | null {
    return this.context;
  }
}

export default StealthScraper;
