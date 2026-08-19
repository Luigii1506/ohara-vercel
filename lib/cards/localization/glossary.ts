const GLOSSARY_VERSION = "2026-08-19-es-v1";

export type CardLocalizationLanguage = "es" | (string & {});

export type GlossaryOption = {
  value: string;
  label: string;
};

type GlossaryDictionary = {
  language: CardLocalizationLanguage;
  version: string;
  keywords: Record<string, string>;
};

const SPANISH_KEYWORDS: Record<string, string> = {
  Counter: "Contraataque",
  Trigger: "Activador",
  "On Play": "Al jugar",
  "When Attacking": "Al atacar",
  Main: "Principal",
  "Activate: Main": "Activar: Principal",
  "Your Turn": "Tu turno",
  "End of Your Turn": "Al final de tu turno",
  "Opponent's Turn": "Turno de tu oponente",
  "On Your Opponent's Attack": "Cuando tu oponente ataque",
  "On K.O.": "Al ser K.O.",
  "On Block": "Al bloquear",
  Blocker: "Bloqueador",
  Banish: "Desterrar",
  Rush: "Prisa",
  "Double Attack": "Ataque doble",
  "DON!! x1": "DON!! ×1",
  "DON!! x2": "DON!! ×2",
  "Once Per Turn": "Una vez por turno",
};

const GLOSSARIES: Record<string, GlossaryDictionary> = {
  es: {
    language: "es",
    version: GLOSSARY_VERSION,
    keywords: SPANISH_KEYWORDS,
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceBracketTokens(text: string, dictionary: Record<string, string>) {
  return text.replace(/\[([^\]]+)\]/g, (fullMatch, token: string) => {
    const replacement = dictionary[token.trim()];
    return replacement ? `[${replacement}]` : fullMatch;
  });
}

function replaceInlineKeywords(text: string, dictionary: Record<string, string>) {
  const entries = Object.entries(dictionary).sort(
    (left, right) => right[0].length - left[0].length
  );

  return entries.reduce((currentText, [source, translated]) => {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${escapeRegExp(source)})(?=[^\\p{L}\\p{N}]|$)`,
      "giu"
    );

    return currentText.replace(
      pattern,
      (_match, prefix: string) => `${prefix}${translated}`
    );
  }, text);
}

export function getOnePieceGlossary(language: CardLocalizationLanguage) {
  return GLOSSARIES[language] ?? null;
}

export function getLocalizedEffectOptions(
  language: CardLocalizationLanguage
): GlossaryOption[] {
  const glossary = getOnePieceGlossary(language);
  const baseEntries = Object.keys(SPANISH_KEYWORDS);

  return baseEntries.map((value) => ({
    value,
    label: glossary?.keywords[value] ?? value,
  }));
}

export function translateOnePieceTextWithGlossary(
  sourceText: string,
  language: CardLocalizationLanguage
): string {
  const glossary = getOnePieceGlossary(language);
  if (!glossary) return sourceText;

  const trimmed = sourceText.trim();
  if (!trimmed) return trimmed;

  const withBracketedTokens = replaceBracketTokens(trimmed, glossary.keywords);
  return replaceInlineKeywords(withBracketedTokens, glossary.keywords);
}

export function getGlossaryVersion(language: CardLocalizationLanguage): string | null {
  return getOnePieceGlossary(language)?.version ?? null;
}
