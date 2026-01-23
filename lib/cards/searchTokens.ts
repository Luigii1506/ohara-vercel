export type SearchTokens = {
  textTokens: string[];
  colors: string[];
  rarities: string[];
  categories: string[];
  altArts: string[];
  triggers: string[];
  costs: string[];
  powers: string[];
  codeTokens: string[];
  codeSuffixTokens: string[];
  illustratorTokens: string[];
};

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
  rare: "Rare",
  raro: "Rare",
  rara: "Rare",
  uc: "Uncommon",
  uncommon: "Uncommon",
  pococomun: "Uncommon",
  c: "Common",
  common: "Common",
  comun: "Common",
  sr: "Super Rare",
  superrare: "Super Rare",
  superrara: "Super Rare",
  sec: "Secret Rare",
  secret: "Secret Rare",
  secreta: "Secret Rare",
  secreto: "Secret Rare",
  p: "Promo",
  promo: "Promo",
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
  "1stanniversary": "1st Anniversary",
  "2ndanniversary": "2nd Anniversary",
  "3rdanniversary": "3rd Anniversary",
  "1st": "1st Anniversary",
  "2n": "2nd Anniversary",
  "3r": "3rd Anniversary",
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
  const normalizedSearch = search.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
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

  rawTokens.forEach((raw) => {
    const token = normalizeSearchToken(raw);
    if (!token) return;

    const mappedRarity = SEARCH_RARITY_MAP[token];
    if (mappedRarity) {
      rarities.add(mappedRarity);
      return;
    }

    const mappedCategory = SEARCH_CATEGORY_MAP[token];
    if (mappedCategory) {
      categories.add(mappedCategory);
      return;
    }

    const mappedAltArt = SEARCH_ALT_ART_MAP[token];
    if (mappedAltArt) {
      altArts.add(mappedAltArt);
      return;
    }

    const mappedTrigger = SEARCH_TRIGGER_MAP[token];
    if (mappedTrigger) {
      triggers.add(mappedTrigger);
      return;
    }

    const mappedColor = SEARCH_COLOR_MAP[token];
    if (mappedColor) {
      colors.add(mappedColor);
      return;
    }

    if (illustratorMode && illustratorMarkers.has(token)) {
      return;
    }

    if (/^\d+$/.test(token)) {
      if (token.length <= 2) {
        costs.add(String(parseInt(token, 10)));
        return;
      }
      if (token.length === 3) {
        codeSuffixTokens.add(token);
        return;
      }
      if (token.length >= 4 && token.length <= 5) {
        powers.add(String(parseInt(token, 10)));
        return;
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
      return;
    }

    if (/^(op|st|eb|prb|p)\d{1,3}$/i.test(normalizedCodeToken)) {
      codeTokens.add(token.toUpperCase());
      return;
    }

    if (illustratorMode) {
      illustratorTokens.add(token);
      return;
    }

    textTokens.push(token);
  });

  return {
    textTokens,
    colors: Array.from(colors),
    rarities: Array.from(rarities),
    categories: Array.from(categories),
    altArts: Array.from(altArts),
    triggers: Array.from(triggers),
    costs: Array.from(costs),
    powers: Array.from(powers),
    codeTokens: Array.from(codeTokens),
    codeSuffixTokens: Array.from(codeSuffixTokens),
    illustratorTokens: Array.from(illustratorTokens),
  };
};
