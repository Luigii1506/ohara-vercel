export type SearchTokens = {
  textTokens: string[];
  exactPhrases: string[];
  colors: string[];
  rarities: string[];
  categories: string[];
  altArts: string[];
  triggers: string[];
  costs: string[];
  powers: string[];
  codeTokens: string[];
  exactCodeTokens: string[];
  codeSuffixTokens: string[];
  illustratorTokens: string[];
};

// True when every word in the search was classified into a structured
// signal (color, trigger, rarity, etc.) rather than left as free text —
// e.g. "trigger amarillo" has none of these words in textTokens because
// both were recognized (trigger + color), even though textTokens is empty.
// Callers must not fall back to a naive literal/English-text match in that
// case, since the recognized value (e.g. "amarillo" -> color "yellow") may
// never appear literally in the underlying (English) card data.
export const hasStructuredSearchSignals = (parsed: SearchTokens) =>
  parsed.colors.length > 0 ||
  parsed.rarities.length > 0 ||
  parsed.categories.length > 0 ||
  parsed.altArts.length > 0 ||
  parsed.triggers.length > 0 ||
  parsed.costs.length > 0 ||
  parsed.powers.length > 0 ||
  parsed.codeTokens.length > 0 ||
  parsed.exactCodeTokens.length > 0 ||
  parsed.codeSuffixTokens.length > 0 ||
  parsed.illustratorTokens.length > 0;

const SEARCH_COLOR_MAP: Record<string, string> = {
  red: "red",
  rojo: "red",
  roja: "red",
  blue: "blue",
  azul: "blue",
  green: "green",
  verde: "green",
  yellow: "yellow",
  amarillo: "yellow",
  amarilla: "yellow",
  amrilla: "yellow",
  black: "black",
  negro: "black",
  negra: "black",
  purple: "purple",
  morado: "purple",
  morada: "purple",
  purpura: "purple",
};

const SEARCH_RARITY_MAP: Record<string, string> = {
  l: "Leader",
  leader: "Leader",
  lider: "Leader",
  r: "Rare",
  rr: "Rare",
  rare: "Rare",
  raro: "Rare",
  rara: "Rare",
  uc: "Uncommon",
  us: "Uncommon",
  unco: "Uncommon",
  uncommon: "Uncommon",
  pococomun: "Uncommon",
  c: "Common",
  com: "Common",
  common: "Common",
  comun: "Common",
  sr: "Super Rare",
  superr: "Super Rare",
  superrare: "Super Rare",
  superrara: "Super Rare",
  sec: "Secret Rare",
  secr: "Secret Rare",
  secret: "Secret Rare",
  secretrare: "Secret Rare",
  secreta: "Secret Rare",
  secreto: "Secret Rare",
};

// "Promo" is not reliably stored in the `rarity` column (many promo cards
// have it null/empty, or even "Alternate Art" bled in from bad scrapes) —
// the actual, consistent signal for "this is a promo card" is the "P-"
// code prefix (same one the Codes filter and a literal "p-" search use).
// So these words feed codeTokens (a "P-" contains match) instead of rarity.
const SEARCH_PROMO_WORDS = new Set([
  "p",
  "pr",
  "promo",
  "promos",
  "promocional",
  "promocionales",
  "promotional",
]);

const SEARCH_RARITY_PHRASE_MAP: Record<string, string> = {
  "super rare": "Super Rare",
  "super rara": "Super Rare",
  "secret rare": "Secret Rare",
  "rara secreta": "Secret Rare",
  "rare secreta": "Secret Rare",
};

const SEARCH_CATEGORY_MAP: Record<string, string> = {
  don: "DON",
  leader: "Leader",
  lider: "Leader",
  character: "Character",
  personaje: "Character",
  event: "Event",
  evento: "Event",
  stage: "Stage",
  escenario: "Stage",
};

const SEARCH_ALT_ART_MAP: Record<string, string> = {
  aa: "Alternate Art",
  alt: "Alternate Art",
  alternate: "Alternate Art",
  alternateart: "Alternate Art",
  alterna: "Alternate Art",
  manga: "Manga Art",
  mangaart: "Manga Art",
  fullart: "Full Art",
  full: "Full Art",
  artecompleto: "Full Art",
  completo: "Full Art",
  treasurecup: "Treasure Cup",
  tr: "Treasure Rare",
  treasurerare: "Treasure Rare",
  treasure: "Treasure Cup",
  sp: "Special Card",
  special: "Special Card",
  specialcard: "Special Card",
  judge: "Judge",
  jues: "Judge",
  textured: "Textured Foil",
  texturedfoil: "Textured Foil",
  texturizada: "Textured Foil",
  textura: "Textured Foil",
  texturisada: "Textured Foil",
  piratefoil: "Jolly Roger Foil",
  jollyroger: "Jolly Roger Foil",
  jollyrogerfoil: "Jolly Roger Foil",
  prerelease: "Pre-Release",
  pre: "Pre-Release",
  releaseevent: "Release event",
  "1stanniversary": "1st Anniversary",
  "2ndanniversary": "2nd Anniversary",
  "3rdanniversary": "3rd Anniversary",
  "1st": "1st Anniversary",
  "2n": "2nd Anniversary",
  "2nd": "2nd Anniversary",
  "3r": "3rd Anniversary",
  "3rd": "3rd Anniversary",
  serial: "Serial",
  seriada: "Serial",
  reimpresion: "Reprint",
  copia: "reprint",
  reprint: "Reprint",
  winner: "Winner Version",
  ganador: "Winner Version",
  ganadora: "Winner Version",
  winnerversion: "Winner Version",
  finalist: "Finalist Version",
  finalista: "Finalist Version",
  finalistversion: "Finalist Version",
  topplayer: "Top Player Version",
  top: "Top Player Version",
  jugadortop: "Top Player Version",
  topplayerversion: "Top Player Version",
  participation: "Participation Version",
  participacion: "Participation Version",
  participasion: "Participation Version",
  participationversion: "Participation Version",
  preerrata: "Pre-Errata",
  errata: "Pre-Errata",
  demo: "Demo Version",
  demoversion: "Demo Version",
  notforsale: "Not for sale",
  nfs: "Not for sale",
};

const SEARCH_ALT_ART_PHRASE_MAP: Record<string, string> = {
  "1st anniversary": "1st Anniversary",
  "2nd anniversary": "2nd Anniversary",
  "3rd anniversary": "3rd Anniversary",
};

const SEARCH_TRIGGER_MAP: Record<string, string> = {
  trigger: "Trigger",
  gatillo: "Trigger",
  notrigger: "No trigger",
  sintrigger: "No trigger",
  singatillo: "No trigger",
};

const normalizeSearchToken = (token: string) =>
  token.toLowerCase().replace(/[^a-z0-9-]/g, "");

export const parseSearchTokens = (search: string): SearchTokens => {
  const illustratorMarkers = new Set([
    "ill",
    "illustrator",
    "ilustrador",
    "artist",
  ]);
  const setContextMarkers = new Set([
    "vol",
    "volume",
    "pack",
    "deck",
    "starter",
    "event",
    "tournament",
    "welcome",
    "regional",
    "participation",
    "collection",
    "set",
    "dash",
    "promotion",
    "promo",
    "anniversary",
    "premium",
    "battle",
    "kit",
    "celebration",
    "championship",
    "binder",
    "gift",
    "store",
    "campaign",
  ]);
  const exactPhrases: string[] = [];
  const searchWithoutQuotedPhrases = search.replace(
    /["“”]([^"“”]+)["“”]/g,
    (_match, phrase: string) => {
      const normalizedPhrase = phrase.trim().replace(/\s+/g, " ");
      if (normalizedPhrase.length > 0) {
        exactPhrases.push(normalizedPhrase);
      }
      return " ";
    }
  );
  const normalizedSearch = searchWithoutQuotedPhrases
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");
  const compactSearch = normalizedSearch.replace(/\s+/g, "");
  const rawTokens = normalizedSearch.match(/[a-z0-9-]+/gi) ?? [];
  const colors = new Set<string>();
  const rarities = new Set<string>();
  const categories = new Set<string>();
  const altArts = new Set<string>();
  const triggers = new Set<string>();
  const costs = new Set<string>();
  const powers = new Set<string>();
  const codeTokens = new Set<string>();
  const exactCodeTokens = new Set<string>();
  const codeSuffixTokens = new Set<string>();
  const illustratorTokens = new Set<string>();
  const textTokens: string[] = [];
  const illustratorMode = rawTokens.some((token) =>
    illustratorMarkers.has(token)
  );

  if (compactSearch.includes("notforsale")) {
    altArts.add("Not for sale");
  }
  if (compactSearch.includes("prerelease")) {
    altArts.add("Pre-Release");
  }
  if (compactSearch.includes("releaseevent")) {
    altArts.add("Release event");
  }
  if (compactSearch.includes("preerrata")) {
    altArts.add("Pre-Errata");
  }
  if (compactSearch.includes("1stanniversary")) {
    altArts.add("1st Anniversary");
  }
  if (compactSearch.includes("2ndanniversary")) {
    altArts.add("2nd Anniversary");
  }
  if (compactSearch.includes("3rdanniversary")) {
    altArts.add("3rd Anniversary");
  }
  if (
    compactSearch.includes("notrigger") ||
    compactSearch.includes("sintrigger") ||
    compactSearch.includes("singatillo")
  ) {
    triggers.add("No trigger");
  }

  for (let index = 0; index < rawTokens.length; index += 1) {
    const raw = rawTokens[index];
    const token = normalizeSearchToken(raw);
    if (!token) continue;
    const previousToken = normalizeSearchToken(rawTokens[index - 1] ?? "");
    const nextToken = normalizeSearchToken(rawTokens[index + 1] ?? "");
    const rarityPhrase = SEARCH_RARITY_PHRASE_MAP[
      `${token} ${nextToken}`.trim()
    ];
    const altArtPhrase = SEARCH_ALT_ART_PHRASE_MAP[
      `${token} ${nextToken}`.trim()
    ];
    const isSetPhraseToken =
      setContextMarkers.has(token) &&
      (setContextMarkers.has(previousToken) ||
        setContextMarkers.has(nextToken) ||
        /^\d+$/.test(previousToken) ||
        /^\d+$/.test(nextToken));

    if (rarityPhrase) {
      rarities.add(rarityPhrase);
      index += 1;
      continue;
    }

    if (altArtPhrase) {
      altArts.add(altArtPhrase);
      index += 1;
      continue;
    }

    const mappedRarity = SEARCH_RARITY_MAP[token];
    if (mappedRarity && !isSetPhraseToken) {
      rarities.add(mappedRarity);
      continue;
    }

    if (SEARCH_PROMO_WORDS.has(token) && !isSetPhraseToken) {
      codeTokens.add("P-");
      continue;
    }

    const mappedCategory = SEARCH_CATEGORY_MAP[token];
    if (mappedCategory && !isSetPhraseToken) {
      categories.add(mappedCategory);
      continue;
    }

    const mappedAltArt = SEARCH_ALT_ART_MAP[token];
    if (mappedAltArt) {
      altArts.add(mappedAltArt);
      continue;
    }

    const mappedTrigger = SEARCH_TRIGGER_MAP[token];
    if (mappedTrigger) {
      triggers.add(mappedTrigger);
      continue;
    }

    const mappedColor = SEARCH_COLOR_MAP[token];
    if (mappedColor) {
      colors.add(mappedColor);
      continue;
    }

    if (illustratorMode && illustratorMarkers.has(token)) {
      continue;
    }

    if (/^\d+$/.test(token)) {
      const isSetContextNumber =
        setContextMarkers.has(previousToken) || setContextMarkers.has(nextToken);
      if (isSetContextNumber) {
        textTokens.push(token);
        continue;
      }
      if (token.length <= 2) {
        costs.add(String(parseInt(token, 10)));
        continue;
      }
      if (token.length === 3) {
        codeSuffixTokens.add(token);
        continue;
      }
      if (token.length >= 4 && token.length <= 5) {
        powers.add(String(parseInt(token, 10)));
        continue;
      }
    }

    const normalizedCodeToken = token.replace(/-/g, "");
    const fullCodeMatch = normalizedCodeToken.match(
      /^(op|st|eb|prb|p)(\d{2,3})(\d{3})$/i
    );
    if (fullCodeMatch) {
      const [, prefix, setNum, cardNum] = fullCodeMatch;
      const formattedCode = `${prefix.toUpperCase()}${setNum}-${cardNum}`;
      codeTokens.add(formattedCode);
      exactCodeTokens.add(formattedCode);
      continue;
    }

    if (/^(op|st|eb|prb|p)\d{1,3}$/i.test(normalizedCodeToken)) {
      codeTokens.add(token.toUpperCase());
      continue;
    }

    if (illustratorMode) {
      illustratorTokens.add(token);
      continue;
    }

    textTokens.push(token);
  }

  return {
    textTokens,
    exactPhrases,
    colors: Array.from(colors),
    rarities: Array.from(rarities),
    categories: Array.from(categories),
    altArts: Array.from(altArts),
    triggers: Array.from(triggers),
    costs: Array.from(costs),
    powers: Array.from(powers),
    codeTokens: Array.from(codeTokens),
    exactCodeTokens: Array.from(exactCodeTokens),
    codeSuffixTokens: Array.from(codeSuffixTokens),
    illustratorTokens: Array.from(illustratorTokens),
  };
};
