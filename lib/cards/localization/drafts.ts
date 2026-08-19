import { createHash } from "crypto";

import {
  CardLocalizationLanguage,
  getGlossaryVersion,
} from "@/lib/cards/localization/glossary";
import { CardTextTranslationService } from "@/lib/cards/localization/translator";

export type CardLocalizationDraft = {
  cardId: number;
  language: CardLocalizationLanguage;
  contentType: "NAME" | "TRIGGER" | "EFFECT" | "TEXT";
  sourceKey: string;
  sourceRecordId: number | null;
  sourceOrder: number;
  sourceText: string;
  translatedText: string;
  sourceHash: string;
  glossaryVersion: string | null;
  translationSource: "GLOSSARY" | "AI";
  status: "DRAFT";
};

type TextRow = { id: number; text: string };
type EffectRow = { id: number; effect: string };

export type CardLocalizationSourceCard = {
  id: number;
  name: string;
  triggerCard: string | null;
  texts: TextRow[];
  effects: EffectRow[];
};

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildDraft(
  cardId: number,
  language: CardLocalizationLanguage,
  contentType: CardLocalizationDraft["contentType"],
  sourceKey: string,
  sourceRecordId: number | null,
  sourceOrder: number,
  sourceText: string
): CardLocalizationDraft {
  return {
    cardId,
    language,
    contentType,
    sourceKey,
    sourceRecordId,
    sourceOrder,
    sourceText,
    translatedText: sourceText,
    sourceHash: hashText(sourceText),
    glossaryVersion: getGlossaryVersion(language),
    translationSource: "GLOSSARY",
    status: "DRAFT",
  };
}

export function buildCardLocalizationDrafts(
  card: CardLocalizationSourceCard,
  language: CardLocalizationLanguage
): CardLocalizationDraft[] {
  const drafts: CardLocalizationDraft[] = [];

  if (card.name.trim()) {
    drafts.push(buildDraft(card.id, language, "NAME", "name", null, 0, card.name));
  }

  if (card.triggerCard?.trim()) {
    drafts.push(
      buildDraft(
        card.id,
        language,
        "TRIGGER",
        "triggerCard",
        null,
        0,
        card.triggerCard
      )
    );
  }

  card.effects.forEach((entry, index) => {
    if (!entry.effect.trim()) return;
    drafts.push(
      buildDraft(
        card.id,
        language,
        "EFFECT",
        `effect:${entry.id}`,
        entry.id,
        index,
        entry.effect
      )
    );
  });

  card.texts.forEach((entry, index) => {
    if (!entry.text.trim()) return;
    drafts.push(
      buildDraft(
        card.id,
        language,
        "TEXT",
        `text:${entry.id}`,
        entry.id,
        index,
        entry.text
      )
    );
  });

  return drafts;
}

export async function buildCardLocalizationDraftsWithTranslations(
  card: CardLocalizationSourceCard,
  language: CardLocalizationLanguage,
  translator: CardTextTranslationService,
  mode: "glossary" | "ai"
): Promise<CardLocalizationDraft[]> {
  const drafts = buildCardLocalizationDrafts(card, language);

  return Promise.all(
    drafts.map(async (draft) => {
      const prefersAi =
        mode === "ai" && (draft.contentType === "TEXT" || draft.contentType === "TRIGGER");
      const translation = await translator.translateText(
        draft.sourceText,
        language,
        prefersAi ? "ai" : "glossary"
      );

      return {
        ...draft,
        translatedText: translation.translatedText,
        translationSource: translation.translationSource,
      };
    })
  );
}
