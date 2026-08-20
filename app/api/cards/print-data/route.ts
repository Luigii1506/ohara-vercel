import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_LANGUAGES = new Set(["en", "es"]);

type LocalizationEntry = {
  sourceKey: string;
  translatedText: string;
};

type CardTextEntry = {
  id: number;
  text: string;
};

type CardConditionEntry = {
  condition: string;
};

type TranslationCandidate = {
  name: string;
  triggerCard: string | null;
  texts: CardTextEntry[];
  conditions: CardConditionEntry[];
  localizations?: LocalizationEntry[] | false;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ids = Array.isArray(body?.ids)
      ? body.ids
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
      : [];
    const language =
      typeof body?.language === "string" && ALLOWED_LANGUAGES.has(body.language)
        ? body.language
        : "en";

    if (ids.length === 0) {
      return NextResponse.json({ cards: [] });
    }

    const cards = await prisma.card.findMany({
      where: {
        id: { in: ids },
      },
      select: {
        id: true,
        name: true,
        triggerCard: true,
        texts: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            text: true,
          },
        },
        conditions: {
          orderBy: { id: "asc" },
          select: {
            condition: true,
          },
        },
        localizations:
          language === "en"
            ? false
            : {
                where: { language },
                select: {
                  sourceKey: true,
                  translatedText: true,
                },
              },
        baseCard: {
          select: {
            id: true,
            name: true,
            triggerCard: true,
            texts: {
              orderBy: { id: "asc" },
              select: {
                id: true,
                text: true,
              },
            },
            conditions: {
              orderBy: { id: "asc" },
              select: {
                condition: true,
              },
            },
            localizations:
              language === "en"
                ? false
                : {
                    where: { language },
                    select: {
                      sourceKey: true,
                      translatedText: true,
                    },
                  },
          },
        },
      },
    });

    const payload = cards.map((card) => {
      const currentCandidate: TranslationCandidate = {
        name: card.name,
        triggerCard: card.triggerCard,
        texts: card.texts,
        conditions: card.conditions,
        localizations:
          language === "en"
            ? false
            : ((card.localizations as LocalizationEntry[]) ?? []),
      };
      const baseCandidate: TranslationCandidate | null = card.baseCard
        ? {
            name: card.baseCard.name,
            triggerCard: card.baseCard.triggerCard,
            texts: card.baseCard.texts,
            conditions: card.baseCard.conditions,
            localizations:
              language === "en"
                ? false
                : ((card.baseCard.localizations as LocalizationEntry[]) ?? []),
          }
        : null;
      const translationSource = pickTranslationCandidate(
        language,
        currentCandidate,
        baseCandidate
      );
      const translationLocalizations = Array.isArray(
        translationSource?.localizations
      )
        ? translationSource.localizations
        : [];

      const localizationMap = new Map(
        translationLocalizations.map((entry) => [
          entry.sourceKey,
          entry.translatedText,
        ])
      );

      const sourceTexts = (translationSource?.texts ?? card.texts)
        .map((entry) => entry.text.trim())
        .filter(Boolean)
        .join("\n\n");
      const localizedTexts = (translationSource?.texts ?? card.texts)
        .map((entry) => {
          const translatedText = localizationMap.get(`text:${entry.id}`);
          return typeof translatedText === "string" ? translatedText.trim() : "";
        })
        .filter(Boolean)
        .join("\n\n");
      const sourceConditions = (translationSource?.conditions ?? card.conditions)
        .map((entry) => entry.condition.trim())
        .filter(Boolean);
      const localizedConditions = sourceConditions
        .map((condition) =>
          deriveLocalizedCondition({
            sourceText: sourceTexts,
            localizedText: localizedTexts,
            sourceCondition: condition,
          })
        )
        .filter((condition): condition is string => Boolean(condition));

      return {
        cardId: card.id,
        sourceName: translationSource?.name ?? card.name,
        localizedName: localizationMap.get("name") ?? null,
        sourceTrigger: translationSource?.triggerCard ?? card.triggerCard ?? null,
        localizedTrigger: localizationMap.get("triggerCard") ?? null,
        sourceText: sourceTexts || null,
        localizedText: localizedTexts || null,
        sourceConditions,
        localizedConditions,
      };
    });

    return NextResponse.json({ cards: payload });
  } catch (error) {
    console.error("[cards/print-data] failed", error);
    return NextResponse.json(
      { error: "Could not load print data" },
      { status: 500 }
    );
  }
}

function pickTranslationCandidate(
  language: string,
  currentCandidate: TranslationCandidate,
  baseCandidate: TranslationCandidate | null
) {
  if (language === "en") {
    return null;
  }

  const currentScore = getTranslationQualityScore(currentCandidate);
  const baseScore = baseCandidate ? getTranslationQualityScore(baseCandidate) : -1;

  if (baseScore > currentScore && baseCandidate) {
    return baseCandidate;
  }

  if (currentScore >= 0) {
    return currentCandidate;
  }

  return baseCandidate;
}

function getTranslationQualityScore(candidate: TranslationCandidate | null) {
  if (!candidate || candidate.localizations === false) {
    return -1;
  }

  const localizationMap = new Map(
    (candidate.localizations ?? []).map((entry) => [entry.sourceKey, entry.translatedText])
  );

  let score = 0;

  for (const textEntry of candidate.texts) {
    const translated = localizationMap.get(`text:${textEntry.id}`);
    if (isMeaningfullyTranslated(translated, textEntry.text)) {
      score += 4;
    }
  }

  if (isMeaningfullyTranslated(localizationMap.get("triggerCard"), candidate.triggerCard)) {
    score += 2;
  }

  if (isMeaningfullyTranslated(localizationMap.get("name"), candidate.name)) {
    score += 1;
  }

  return score;
}

function isMeaningfullyTranslated(
  translatedText: string | null | undefined,
  sourceText: string | null | undefined
) {
  const translated = normalizeText(translatedText);
  if (!translated) return false;

  const source = normalizeText(sourceText);
  return translated !== source;
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function deriveLocalizedCondition({
  sourceText,
  localizedText,
  sourceCondition,
}: {
  sourceText: string;
  localizedText: string;
  sourceCondition: string;
}) {
  if (!localizedText || !sourceCondition) {
    return null;
  }

  const normalizedLocalized = normalizeText(localizedText);
  const normalizedSourceCondition = normalizeText(sourceCondition);
  if (!normalizedLocalized || normalizedLocalized.includes(normalizedSourceCondition)) {
    return null;
  }

  const sourceIndex = sourceText.indexOf(sourceCondition);
  if (sourceIndex < 0) {
    return null;
  }

  const prefixSource = sourceText.slice(0, sourceIndex);
  const conditionEndChar = sourceCondition.at(-1) ?? "";

  const localizedPrefix = localizeStaticPrefix(prefixSource);
  let localizedStart = localizedPrefix
    ? localizedText.indexOf(localizedPrefix) + localizedPrefix.length
    : 0;

  if (localizedPrefix && localizedText.indexOf(localizedPrefix) < 0) {
    localizedStart = 0;
  }

  if (conditionEndChar) {
    const localizedEnd = localizedText.indexOf(conditionEndChar, localizedStart);
    if (localizedEnd >= localizedStart) {
      const extracted = localizedText
        .slice(localizedStart, localizedEnd + 1)
        .trim();
      return extracted || null;
    }
  }

  return null;
}

function localizeStaticPrefix(value: string) {
  return value
    .replace(/\[Counter\]/g, "[Contraataque]")
    .replace(/\[Trigger\]/g, "[Activador]")
    .replace(/\[On Play\]/g, "[Al jugar]")
    .replace(/\[When Attacking\]/g, "[Al atacar]")
    .replace(/\[Main\]/g, "[Principal]")
    .replace(/\[Activate: Main\]/g, "[Activar: Principal]")
    .replace(/\[Your Turn\]/g, "[Tu turno]")
    .replace(/\[End of Your Turn\]/g, "[Al final de tu turno]")
    .replace(/\[Opponent's Turn\]/g, "[Turno de tu oponente]")
    .replace(
      /\[On Your Opponent's Attack\]/g,
      "[Cuando tu oponente ataque]"
    )
    .replace(/\[On K\.O\.\]/g, "[Al ser K.O.]")
    .replace(/\[On Block\]/g, "[Al bloquear]")
    .replace(/\[Blocker\]/g, "[Bloqueador]")
    .replace(/\[Banish\]/g, "[Desterrar]")
    .replace(/\[Rush\]/g, "[Prisa]")
    .replace(/\[Double Attack\]/g, "[Ataque doble]")
    .replace(/\[DON!! x1\]/g, "[DON!! ×1]")
    .replace(/\[DON!! x2\]/g, "[DON!! ×2]")
    .replace(/\[Once Per Turn\]/g, "[Una vez por turno]");
}
