import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { GoogleGenAI } from "@google/genai";

import {
  CardLocalizationLanguage,
  getOnePieceGlossary,
  translateOnePieceTextWithGlossary,
} from "@/lib/cards/localization/glossary";

const DEFAULT_MODEL = "gemini-2.5-flash";

type TranslationMode = "glossary" | "ai";

type CacheEntry = {
  translatedText: string;
  sourceText: string;
  language: string;
  mode: TranslationMode;
  timestamp: number;
};

export class CardTextTranslationService {
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly cachePath: string;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private client: GoogleGenAI | null = null;
  private cacheLoaded = false;
  private cacheDirty = false;
  private cache = new Map<string, CacheEntry>();
  private lastRequestAt = 0;

  constructor(config?: {
    apiKey?: string | null;
    model?: string;
    cachePath?: string;
    minIntervalMs?: number;
    maxRetries?: number;
  }) {
    this.apiKey =
      config?.apiKey ??
      process.env.GOOGLE_GENAI_API_KEY ??
      process.env.GEMINI_API_KEY ??
      null;
    this.model = config?.model ?? DEFAULT_MODEL;
    this.cachePath =
      config?.cachePath ??
      path.join(process.cwd(), ".cache", "card-localization-translations.json");
    this.minIntervalMs = config?.minIntervalMs ?? 15_000;
    this.maxRetries = config?.maxRetries ?? 3;
  }

  async translateText(
    sourceText: string,
    language: CardLocalizationLanguage,
    mode: TranslationMode
  ): Promise<{ translatedText: string; translationSource: "GLOSSARY" | "AI" }> {
    const glossaryTranslation = translateOnePieceTextWithGlossary(sourceText, language);

    if (mode === "glossary" || language !== "es") {
      return {
        translatedText: glossaryTranslation,
        translationSource: "GLOSSARY",
      };
    }

    if (!this.apiKey) {
      return {
        translatedText: glossaryTranslation,
        translationSource: "GLOSSARY",
      };
    }

    const trimmed = sourceText.trim();
    if (!trimmed) {
      return {
        translatedText: trimmed,
        translationSource: "GLOSSARY",
      };
    }

    await this.ensureCache();
    const cacheKey = this.buildCacheKey(trimmed, language, mode);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        translatedText: cached.translatedText,
        translationSource: "AI",
      };
    }

    const translatedText = await this.performAiTranslation(trimmed, glossaryTranslation);
    this.cache.set(cacheKey, {
      translatedText,
      sourceText: trimmed,
      language,
      mode,
      timestamp: Date.now(),
    });
    this.cacheDirty = true;

    return {
      translatedText,
      translationSource: "AI",
    };
  }

  async flush(): Promise<void> {
    if (!this.cacheDirty) return;
    await fs.promises.mkdir(path.dirname(this.cachePath), { recursive: true });
    await fs.promises.writeFile(
      this.cachePath,
      JSON.stringify(Object.fromEntries(this.cache), null, 2),
      "utf-8"
    );
    this.cacheDirty = false;
  }

  private async ensureCache() {
    if (this.cacheLoaded) return;
    this.cacheLoaded = true;

    await fs.promises.mkdir(path.dirname(this.cachePath), { recursive: true });

    try {
      const raw = await fs.promises.readFile(this.cachePath, "utf-8");
      this.cache = new Map(Object.entries(JSON.parse(raw) as Record<string, CacheEntry>));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("[card-localization] failed to read translation cache", error);
      }
      this.cache = new Map();
    }
  }

  private buildCacheKey(
    sourceText: string,
    language: CardLocalizationLanguage,
    mode: TranslationMode
  ) {
    return crypto
      .createHash("sha256")
      .update(`${language}::${mode}::${sourceText}`)
      .digest("hex");
  }

  private async performAiTranslation(sourceText: string, glossaryTranslation: string) {
    const glossary = getOnePieceGlossary("es");
    const glossaryLines = Object.entries(glossary?.keywords ?? {})
      .map(([source, translated]) => `- ${source} => ${translated}`)
      .join("\n");

    const prompt = [
      "Translate the following One Piece Card Game card text into neutral Latin American Spanish.",
      "Use the glossary strictly whenever one of these exact gameplay terms appears.",
      "Keep bracket formatting like [On Play], [Blocker], [DON!! x1], //2, {Straw Hat Crew}, numbers, punctuation, and line structure intact whenever possible.",
      "Do not explain anything. Return only the translated card text.",
      "If a card name or proper noun should remain unchanged, keep it unchanged.",
      "Glossary:",
      glossaryLines,
      "",
      "Reference draft with glossary replacements applied:",
      glossaryTranslation,
      "",
      "Original card text:",
      sourceText,
    ].join("\n");

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        await this.waitForRateLimitWindow();
        const client = await this.ensureClient();
        const response = await client.models.generateContent({
          model: this.model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        this.lastRequestAt = Date.now();

        const translated = response.text?.trim();
        if (!translated) {
          return glossaryTranslation;
        }

        return translated;
      } catch (error) {
        if (!this.isRetryableQuotaError(error) || attempt >= this.maxRetries) {
          throw error;
        }

        const retryDelayMs = this.getRetryDelayMs(error, attempt);
        console.warn(
          `[card-localization] Gemini quota hit. Retrying in ${retryDelayMs}ms (attempt ${attempt + 1}/${this.maxRetries}).`
        );
        await this.sleep(retryDelayMs);
      }
    }

    return glossaryTranslation;
  }

  private async ensureClient() {
    if (!this.apiKey) {
      throw new Error("GOOGLE_GENAI_API_KEY or GEMINI_API_KEY is not configured.");
    }

    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }

    return this.client;
  }

  private async waitForRateLimitWindow() {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed >= this.minIntervalMs) return;
    await this.sleep(this.minIntervalMs - elapsed);
  }

  private isRetryableQuotaError(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 429
    );
  }

  private getRetryDelayMs(error: unknown, attempt: number) {
    const retryDelay = this.extractRetryDelayMs(error);
    if (retryDelay) return retryDelay;
    return this.minIntervalMs * Math.max(1, attempt + 1);
  }

  private extractRetryDelayMs(error: unknown): number | null {
    if (
      typeof error !== "object" ||
      error === null ||
      !("message" in error) ||
      typeof (error as { message?: string }).message !== "string"
    ) {
      return null;
    }

    const message = (error as { message: string }).message;
    const secondsMatch = message.match(/retry in\s+([0-9.]+)s/i);
    if (secondsMatch) {
      return Math.ceil(Number(secondsMatch[1]) * 1000) + 500;
    }

    return null;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
