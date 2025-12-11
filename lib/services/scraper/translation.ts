import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { GoogleGenAI } from "@google/genai";

export type TranslationMode = "off" | "auto";

export interface TranslationConfig {
  enabled?: boolean;
  cachePath?: string;
  resetCache?: boolean;
  model?: string;
  apiKey?: string;
  mode?: TranslationMode;
}

interface TranslationCacheEntry {
  text: string;
  locale: string;
  translated: string;
  timestamp: number;
}

export interface TranslationStats {
  enabled: boolean;
  cachePath?: string;
  cacheEntries: number;
  cacheHits: number;
  cacheMisses: number;
  apiCalls: number;
  skipped: number;
  errors: number;
  model?: string;
  disabledReason?: string;
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_CACHE_PATH = path.join(
  process.cwd(),
  ".cache",
  "event-scraper-translations.json"
);

export class HeadingTranslationService {
  private enabled: boolean;
  private apiKey?: string;
  private cachePath: string;
  private resetCache: boolean;
  private modelId: string;
  private genAiClient: GoogleGenAI | null = null;
  private cacheLoaded = false;
  private cacheDirty = false;
  private cache = new Map<string, TranslationCacheEntry>();
  private stats: TranslationStats;
  private disabledReason?: string;

  constructor(config: TranslationConfig = {}) {
    this.enabled = Boolean(config.enabled);
    this.apiKey = config.apiKey ?? process.env.GOOGLE_GENAI_API_KEY;
    this.cachePath = config.cachePath || DEFAULT_CACHE_PATH;
    this.resetCache = Boolean(config.resetCache);
    this.modelId = config.model || DEFAULT_MODEL;

    if (this.enabled && !this.apiKey) {
      this.enabled = false;
      this.disabledReason =
        "GOOGLE_GENAI_API_KEY is not defined. Skipping translations.";
    }

    this.stats = {
      enabled: this.enabled,
      cachePath: this.cachePath,
      cacheEntries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      skipped: 0,
      errors: 0,
      model: this.modelId,
      disabledReason: this.disabledReason,
    };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async translateHeading(
    text: string,
    locale?: string
  ): Promise<string | null> {
    if (!this.enabled) {
      this.stats.skipped++;
      return null;
    }

    const normalizedLocale = (locale || "en").toLowerCase();
    if (normalizedLocale === "en") {
      this.stats.skipped++;
      return null;
    }

    const trimmed = text?.trim();
    if (!trimmed) {
      this.stats.skipped++;
      return null;
    }

    await this.ensureCache();

    const cacheKey = this.buildCacheKey(normalizedLocale, trimmed);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached.translated;
    }

    this.stats.cacheMisses++;

    try {
      const translated = await this.performTranslation(
        trimmed,
        normalizedLocale
      );
      if (translated) {
        this.cache.set(cacheKey, {
          text: trimmed,
          locale: normalizedLocale,
          translated,
          timestamp: Date.now(),
        });
        this.cacheDirty = true;
        return translated;
      }
    } catch (error) {
      this.stats.errors++;
      console.warn("⚠️  Translation error:", error);
    }

    return null;
  }

  getStats(): TranslationStats {
    return {
      ...this.stats,
      cacheEntries: this.cache.size,
    };
  }

  async flush(): Promise<void> {
    if (!this.cacheDirty) return;
    await this.ensureCacheDirectory();
    await fs.promises.writeFile(
      this.cachePath,
      JSON.stringify(Object.fromEntries(this.cache), null, 2),
      "utf-8"
    );
    this.cacheDirty = false;
  }

  private async ensureCache(): Promise<void> {
    if (this.cacheLoaded) return;
    this.cacheLoaded = true;

    await this.ensureCacheDirectory();

    if (this.resetCache) {
      await fs.promises.rm(this.cachePath, { force: true });
      this.resetCache = false;
      this.cache = new Map();
      return;
    }

    try {
      const raw = await fs.promises.readFile(this.cachePath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, TranslationCacheEntry>;
      this.cache = new Map(Object.entries(parsed));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("⚠️  Failed to read translation cache:", error);
      }
      this.cache = new Map();
    }
  }

  private async ensureCacheDirectory(): Promise<void> {
    const dir = path.dirname(this.cachePath);
    await fs.promises.mkdir(dir, { recursive: true });
  }

  private buildCacheKey(locale: string, text: string): string {
    return crypto
      .createHash("sha256")
      .update(`${locale}::${text}`)
      .digest("hex");
  }

  private async performTranslation(
    text: string,
    locale: string
  ): Promise<string | null> {
    if (!this.apiKey) return null;

    const client = await this.ensureClient();
    this.stats.apiCalls++;

    const prompt = [
      "Translate the following text to English.",
      "Return concise nouns suitable as card or prize names.",
      "If the input is already English, return it as-is.",
      `Source locale: ${locale}`,
      "Text:",
      text,
    ].join("\n");

    const response = await client.models.generateContent({
      model: this.modelId,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const translated = response.text
      ?.replace(/\s+/g, " ")
      .trim();

    return translated || null;
  }

  private async ensureClient(): Promise<GoogleGenAI> {
    if (!this.apiKey) {
      throw new Error("GOOGLE_GENAI_API_KEY is not configured.");
    }

    if (!this.genAiClient) {
      this.genAiClient = new GoogleGenAI({
        apiKey: this.apiKey,
      });
    }

    return this.genAiClient;
  }
}
