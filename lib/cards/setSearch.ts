import prisma from "@/lib/prisma";

export type SearchableSet = {
  id: number;
  title: string;
  code: string | null;
  cardsCount: number;
};

export type SetSearchSuggestion = {
  id: number;
  title: string;
  code: string | null;
  score: number;
  normalizedTitle: string;
};

export type SetSearchResolution = {
  ids: number[];
  exclusive: boolean;
};

export const SET_SEARCH_MARKERS = new Set([
  "pack",
  "welcome",
  "tournament",
  "event",
  "regional",
  "participation",
  "promotion",
  "promo",
  "collection",
  "dash",
  "starter",
  "deck",
  "anniversary",
  "premium",
  "battle",
  "kit",
  "judge",
  "release",
  "store",
  "championship",
  "flagship",
  "treasure",
  "cup",
  "prize",
  "bonus",
  "gift",
  "box",
]);

const SET_SEARCH_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "for",
  "edition",
  "ver",
  "version",
]);

let searchableSetsCache:
  | { at: number; data: SearchableSet[] }
  | null = null;

const SEARCHABLE_SETS_TTL_MS = 60 * 60 * 1000;

export const normalizeSetSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bvol(?:ume)?\.?(?=\s|$)/g, " vol ")
    .replace(/\bver(?:sion)?\.?(?=\s|$)/g, " version ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const tokenizeSetSearchText = (value: string) =>
  normalizeSetSearchText(value).split(/\s+/).filter(Boolean);

export const isOneEditAway = (a: string, b: string) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  let edits = 0;
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (a.length > b.length) {
      i += 1;
    } else if (b.length > a.length) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }

  if (i < a.length || j < b.length) {
    edits += 1;
  }

  return edits <= 1;
};

export const setTokensMatch = (queryToken: string, titleToken: string) => {
  if (queryToken === titleToken) return true;
  if (/^\d+$/.test(queryToken) || /^\d+$/.test(titleToken)) {
    return queryToken === titleToken;
  }
  if (queryToken.length >= 4 && titleToken.length >= 4) {
    return isOneEditAway(queryToken, titleToken);
  }
  return false;
};

export async function getSearchableSets(): Promise<SearchableSet[]> {
  if (
    searchableSetsCache &&
    Date.now() - searchableSetsCache.at < SEARCHABLE_SETS_TTL_MS
  ) {
    return searchableSetsCache.data;
  }

  const data = await prisma.set.findMany({
    where: {
      cards: {
        some: {
          card: {
            region: "US",
          },
        },
      },
    },
    select: {
      id: true,
      title: true,
      code: true,
      cards: {
        where: {
          card: {
            region: "US",
          },
        },
        select: {
          cardId: true,
        },
      },
    },
  });

  const normalizedData = data.map((set) => ({
    id: set.id,
    title: set.title,
    code: set.code,
    cardsCount: set.cards.length,
  }));

  searchableSetsCache = { at: Date.now(), data: normalizedData };
  return normalizedData;
}

export async function rankSetSearchSuggestions(
  search?: string,
  limit: number = 8
): Promise<SetSearchSuggestion[]> {
  const rawSearch = search?.trim();
  if (!rawSearch) return [];

  const normalizedQuery = normalizeSetSearchText(rawSearch);
  if (!normalizedQuery) return [];

  const queryTokens = tokenizeSetSearchText(normalizedQuery);
  if (!queryTokens.length) return [];

  const significantTokens = queryTokens.filter(
    (token) => !SET_SEARCH_STOPWORDS.has(token)
  );
  const numericTokens = significantTokens.filter((token) => /^\d+$/.test(token));
  const wordTokens = significantTokens.filter((token) => !/^\d+$/.test(token));
  const hasSetIntent = queryTokens.some((token) => SET_SEARCH_MARKERS.has(token));

  const sets = await getSearchableSets();
  const ranked = sets
    .map((set) => {
      const normalizedTitle = normalizeSetSearchText(set.title);
      const titleTokens = tokenizeSetSearchText(set.title);
      const normalizedCode = normalizeSetSearchText(set.code ?? "");

      const matchesCode =
        normalizedCode.length > 0 &&
        (normalizedCode === normalizedQuery ||
          normalizedCode.startsWith(normalizedQuery) ||
          normalizedQuery.startsWith(normalizedCode));

      const matchedWordCount = wordTokens.filter((token) =>
        titleTokens.some((titleToken) => setTokensMatch(token, titleToken))
      ).length;
      const matchedNumericCount = numericTokens.filter((token) =>
        titleTokens.some((titleToken) => setTokensMatch(token, titleToken))
      ).length;

      const allWordsMatch = wordTokens.length === 0 || matchedWordCount === wordTokens.length;
      const allNumericMatch =
        numericTokens.length === 0 || matchedNumericCount === numericTokens.length;

      const relaxedMatch =
        normalizedTitle.includes(normalizedQuery) ||
        queryTokens.every((token) =>
          titleTokens.some((titleToken) => setTokensMatch(token, titleToken))
        ) ||
        matchesCode;

      if (!relaxedMatch && (!allWordsMatch || !allNumericMatch)) {
        return null;
      }

      let score = 0;

      if (normalizedTitle === normalizedQuery) score += 140;
      if (normalizedTitle.startsWith(normalizedQuery)) score += 60;
      if (normalizedTitle.includes(normalizedQuery)) score += 35;
      if (matchesCode) score += 50;
      score += matchedWordCount * 12;
      score += matchedNumericCount * 20;
      score += Math.min(set.cardsCount, 25);

      if (hasSetIntent) score += 10;
      if (titleTokens.length === significantTokens.length) score += 5;
      if (
        normalizedQuery.includes("vol") &&
        normalizedTitle.includes("vol")
      ) {
        score += 10;
      }

      return {
        id: set.id,
        title: set.title,
        code: set.code,
        normalizedTitle,
        score,
      };
    })
    .filter((item): item is SetSearchSuggestion => Boolean(item))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.normalizedTitle.localeCompare(b.normalizedTitle)
    )
    .slice(0, Math.min(Math.max(limit, 1), 12));

  return ranked;
}

export async function resolveSearchSetMatch(
  search?: string
): Promise<SetSearchResolution | null> {
  const rawSearch = (search ?? "").trim();
  const normalizedCardCodeSearch = rawSearch.replace(/[^a-z0-9]/gi, "");
  if (/^(op|st|eb|prb|p)\d{2,3}\d{3}[a-z]?$/i.test(normalizedCardCodeSearch)) {
    return null;
  }

  const suggestions = await rankSetSearchSuggestions(search, 5);
  if (!suggestions.length) return null;

  const normalizedQuery = normalizeSetSearchText(search ?? "");
  const queryTokens = tokenizeSetSearchText(normalizedQuery);
  if (queryTokens.length < 2) return null;

  const hasSetIntent = queryTokens.some((token) => SET_SEARCH_MARKERS.has(token));
  const topScore = suggestions[0].score;
  const top = suggestions.filter((candidate) => candidate.score === topScore);
  if (top.length !== 1) return null;

  const topCandidate = top[0];
  const topNormalizedTitle = topCandidate.normalizedTitle;
  const hasCodeLikeToken = queryTokens.some((token) =>
    /^(op|st|eb|prb|p)\d{1,3}$/i.test(token)
  );
  const hasStrongSetMatch =
    topNormalizedTitle === normalizedQuery ||
    topNormalizedTitle.includes(normalizedQuery) ||
    normalizedQuery.includes(topNormalizedTitle);

  if (!hasSetIntent && !hasCodeLikeToken && !hasStrongSetMatch) {
    return null;
  }

  return {
    ids: [topCandidate.id],
    exclusive: hasStrongSetMatch || hasCodeLikeToken,
  };
}

export async function resolveSearchSetIds(search?: string): Promise<number[] | null> {
  const resolution = await resolveSearchSetMatch(search);
  return resolution?.ids ?? null;
}
