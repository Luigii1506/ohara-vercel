import { CardWithCollectionData } from "@/types";
import { parseSearchTokens, hasStructuredSearchSignals } from "@/lib/cards/searchTokens";

const normalizeSearchWords = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter(Boolean);

const matchesWordToken = (value: string, token: string) => {
  const normalizedToken = token.toLowerCase().trim();
  if (!normalizedToken) return false;

  return normalizeSearchWords(value).some(
    (word) => word === normalizedToken || word.startsWith(normalizedToken)
  );
};

const matchesPhraseToken = (value: string, phrase: string) => {
  const normalizedPhrase = phrase.toLowerCase().trim();
  if (!normalizedPhrase) return false;

  const normalizedValue = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalizedValue.includes(normalizedPhrase);
};

export const matchesCardCode = (code: string, search: string): boolean => {
  const query = search.toLowerCase().trim();
  const fullCode = code.toLowerCase();

  // Tratamiento especial: el filtro "P-000" representa todos los códigos promocionales
  if (query === "p-000") {
    return /^p-\d+$/i.test(code);
  }

  if (query.includes("-")) {
    return fullCode.includes(query);
  }

  const parts = code.split("-");

  if (/^\d+$/.test(query)) {
    if (query[0] === "0") {
      return parts.some((part) => {
        const matchDigits = part.match(/\d+/);
        return matchDigits ? matchDigits[0] === query : false;
      });
    } else {
      const queryNumber = parseInt(query, 10);
      return parts.some((part) => {
        const matchDigits = part.match(/\d+/);
        return matchDigits ? parseInt(matchDigits[0], 10) === queryNumber : false;
      });
    }
  }

  return parts.some((part) => part.toLowerCase().includes(query));
};

export const baseCardMatches = (
  card: CardWithCollectionData | undefined,
  selectedSets: string[] = [],
  selectedAltArts: string[] = []
): boolean => {
  if (!card) return false;

  if (selectedSets?.length) {
    const normalizedSets = selectedSets.map((value) => value.toLowerCase());
    const baseSetCodes = (card.sets ?? [])
      .map((entry) => entry.set.code?.trim().toLowerCase())
      .filter((code): code is string => Boolean(code));
    if (!baseSetCodes.some((code) => normalizedSets.includes(code))) {
      return false;
    }
  }

  if (selectedAltArts?.length) {
    return selectedAltArts.includes(card.alternateArt ?? "");
  }

  return true;
};

export const getFilteredAlternates = (
  card: CardWithCollectionData | undefined,
  selectedSets: string[] = [],
  selectedAltArts: string[] = []
): CardWithCollectionData[] => {
  if (!card?.alternates) return [];
  return card.alternates.filter((alt) => {
    if (selectedSets?.length) {
      const normalizedSets = selectedSets.map((value) => value.toLowerCase());
      const altSetCodes = (alt.sets ?? [])
        .map((entry) => entry.set.code?.trim().toLowerCase())
        .filter((code): code is string => Boolean(code));
      if (!altSetCodes.some((code) => normalizedSets.includes(code))) {
        return false;
      }
    }

    if (selectedAltArts?.length) {
      return selectedAltArts.includes(alt.alternateArt ?? "");
    }

    return true;
  });
};

export const cardMatchesActiveFilters = (
  card: CardWithCollectionData | undefined,
  options: {
    search?: string;
    selectedSets?: string[];
    selectedCodes?: string[];
    selectedAltArts?: string[];
  } = {}
): boolean => {
  if (!card) return false;

  const {
    search = "",
    selectedSets = [],
    selectedCodes = [],
    selectedAltArts = [],
  } = options;

  if (selectedSets.length > 0) {
    const normalizedSets = selectedSets.map((value) => value.toLowerCase());
    const cardSetCodes = (card.sets ?? [])
      .map((entry) => entry.set.code?.trim().toLowerCase())
      .filter((code): code is string => Boolean(code));
    const cardSetTitles = (card.sets ?? [])
      .map((entry) => entry.set.title?.trim().toLowerCase())
      .filter((title): title is string => Boolean(title));
    const matchesSet =
      cardSetCodes.some((code) => normalizedSets.includes(code)) ||
      cardSetTitles.some((title) => normalizedSets.includes(title));
    if (!matchesSet) return false;
  }

  if (selectedCodes.length > 0) {
    // "PROMO" es un valor pseudo-código de la UI: las cartas promo reales
    // tienen código impreso "P-XXX" (nunca contienen literalmente "promo"),
    // igual que la normalización del lado del servidor en lib/cards/query.ts.
    const normalizedCodes = selectedCodes.map((value) =>
      (value.toUpperCase() === "PROMO" ? "P-" : value).toLowerCase()
    );
    const cardCode = card.code?.toLowerCase() ?? "";
    const matchesCode = normalizedCodes.some((value) => cardCode.includes(value));
    if (!matchesCode) return false;
  }

  if (selectedAltArts.length > 0) {
    const matchesAltArt = selectedAltArts.includes(card.alternateArt ?? "");
    if (!matchesAltArt) return false;
  }

  const rawSearch = search.trim();
  if (!rawSearch) return true;

  const normalizedSearch = rawSearch.toLowerCase();
  const parsed = parseSearchTokens(rawSearch);
  const searchableValues = [
    card.name,
    card.code,
    card.rarity,
    card.alternateArt,
    card.attribute,
    card.cost,
    card.power,
    card.triggerCard,
    ...(card.effects ?? []).map((effect) => effect.effect),
    ...(card.texts ?? []).map((text) => text.text),
    ...(card.types ?? []).map((type) => type.type),
    ...(card.colors ?? []).map((color) => color.color),
    ...(card.sets ?? []).flatMap((entry) => [entry.set.title, entry.set.code ?? ""]),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  const includesToken = (token: string) =>
    searchableValues.some((value) => matchesWordToken(value, token));

  if (parsed.exactPhrases.length > 0) {
    const matchesExactPhrases = parsed.exactPhrases.every((phrase) =>
      searchableValues.some((value) => matchesPhraseToken(value, phrase))
    );
    if (!matchesExactPhrases) return false;
  }

  if (parsed.textTokens.length > 0) {
    const matchesTextTokens = parsed.textTokens.every((token) => includesToken(token));
    if (!matchesTextTokens) return false;
  } else if (!hasStructuredSearchSignals(parsed)) {
    // Only fall back to a naive literal match when nothing was recognized
    // at all. If every word was classified as a structured signal (color,
    // trigger, rarity...), the server already filtered on that correctly —
    // re-checking the raw (possibly non-English) words against English card
    // text here would wrongly reject valid matches (e.g. "azul"/"amarillo"
    // never appear literally on an English card, even though its color
    // field is correctly "blue"/"yellow").
    const compact = normalizedSearch.replace(/[^a-z0-9]+/g, " ").trim();
    if (compact && !searchableValues.some((value) => matchesPhraseToken(value, compact))) {
      const words = compact.split(/\s+/).filter(Boolean);
      if (words.length && !words.every((word) => includesToken(word))) {
        return false;
      }
    }
  }

  if (parsed.codeTokens.length > 0) {
    const matchesParsedCode = parsed.codeTokens.some((token) =>
      parsed.exactCodeTokens.includes(token)
        ? (card.code ?? "").toLowerCase() === token.toLowerCase()
        : (card.code ?? "").toLowerCase().includes(token.toLowerCase())
    );
    if (!matchesParsedCode) return false;
  }

  if (parsed.codeSuffixTokens.length > 0) {
    const matchesSuffix = parsed.codeSuffixTokens.some((token) =>
      (card.code ?? "").toLowerCase().endsWith(token.toLowerCase())
    );
    if (!matchesSuffix) return false;
  }

  if (parsed.illustratorTokens.length > 0) {
    const illustratorValue = (card.illustrator ?? "").toLowerCase();
    const matchesIllustrator = parsed.illustratorTokens.every((token) =>
      illustratorValue.includes(token.toLowerCase())
    );
    if (!matchesIllustrator) return false;
  }

  return true;
};
