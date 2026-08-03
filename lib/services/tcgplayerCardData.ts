/**
 * Parser de datos de carta desde el `extendedData` de la API de TCGplayer
 * hacia el formato de nuestro modelo Card. TCGplayer da toda la info que
 * necesitamos (name, rarity, category, cost, power, counter, life, attribute,
 * colors, types, effect/description), así que NO hace falta webscraping.
 *
 * El formato de salida imita al de los scrapers oficiales (JP/FR/…):
 *   cost "5 Cost", power "5000 Power", counter "+1000 Counter", life "4 Life",
 *   rarity "Secret Rare", effects = tags [..] conocidos, texts = descripción.
 */

type Extended = { name: string; value: string }[];

const RARITY_MAP: Record<string, string> = {
  L: "Leader",
  C: "Common",
  UC: "Uncommon",
  R: "Rare",
  SR: "Super Rare",
  SEC: "Secret Rare",
  P: "Promo",
  PR: "Promo",
  SP: "Special Card",
  TR: "Treasure Rare",
};

const CATEGORY_MAP: Record<string, string> = {
  LEADER: "Leader",
  CHARACTER: "Character",
  EVENT: "Event",
  STAGE: "Stage",
  DON: "DON",
};

// Whitelist de tags [..] que son efectos reales (timings + keywords). Sacado
// de los efectos que ya existen en el catálogo US.
const EFFECT_WHITELIST = new Set(
  [
    "On Play",
    "Trigger",
    "Blocker",
    "Activate: Main",
    "Active: Main",
    "Once Per Turn",
    "Main",
    "When Attacking",
    "Counter",
    "Your Turn",
    "On K.O.",
    "Rush",
    "Opponent's Turn",
    "End of Your Turn",
    "On Your Opponent's Attack",
    "Double Attack",
    "Banish",
    "On Block",
    "Rush: Character",
    "Unblockable",
    "On Opponent's Attack",
    "When Blocking",
    "End of Your Opponent's Turn",
    "On Your Opponent's Turn",
  ].map((s) => s.toLowerCase())
);

function ext(data: Extended, key: string): string | null {
  const v = data.find((e) => e.name === key)?.value;
  return v == null || v === "" ? null : String(v);
}

/** Decodifica entidades HTML y limpia tags de la descripción. */
export function cleanDescription(raw: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Separa el aviso "Disclaimer:" (pre-errata / no legal / reprint) del efecto.
 *  TCGplayer lo pega al final del Description, en un span rojo. */
export function splitDisclaimer(rawDescription: string | null): {
  effect: string;
  disclaimer: string | null;
} {
  if (!rawDescription) return { effect: "", disclaimer: null };
  const idx = rawDescription.search(/Disclaimer\s*:/i);
  if (idx === -1) return { effect: rawDescription, disclaimer: null };
  const disclaimer = cleanDescription(rawDescription.slice(idx))
    .replace(/^Disclaimer\s*:\s*/i, "")
    .trim();
  return {
    effect: rawDescription.slice(0, idx),
    disclaimer: disclaimer || null,
  };
}

/**
 * Extrae el "pack" real de un producto promo de TCGplayer desde el paréntesis
 * del nombre. TCGplayer agrupa todo en "One Piece Promotion Cards", pero el set
 * real está en el nombre: "Chaka & Pell (Tournament Pack 2026 Vol. 3)" → el pack
 * es "Tournament Pack 2026 Vol. 3". Clasificarlo así (y no en el grupo genérico)
 * nos deja ligar la carta a su sobre → precios y EV por sobre.
 *
 * Devuelve null si el paréntesis es un descriptor de variante (Parallel, Full
 * Art…) o un código de carta, o si no hay paréntesis.
 */
export function extractPromoPack(productName: string | null): string | null {
  if (!productName) return null;
  const parens = Array.from(productName.matchAll(/\(([^)]+)\)/g)).map((m) =>
    m[1].trim()
  );
  if (parens.length === 0) return null;
  const pack = parens[parens.length - 1];
  if (!pack) return null;
  // Descriptores de variante, no son packs.
  if (
    /^(parallel|alternate art|alt art|full art|manga|reprint|foil|textured|box topper|jolly roger)$/i.test(
      pack
    )
  ) {
    return null;
  }
  // Un código de carta suelto tampoco es un pack.
  if (/^[A-Z]{1,4}-?\d{2,3}[A-Za-z]?$/i.test(pack)) return null;
  return pack;
}

/** Formatea el nombre de un set de deck a nuestro estándar: quita el prefijo
 *  secuencial "Starter Deck NN:" ("Starter Deck 31: RED Monkey.D.Luffy" →
 *  "RED Monkey.D.Luffy", como "YELLOW Charlotte Katakuri" del ST20). NO toca
 *  "Super Pre-Release Starter Deck N:" ni "Ultra Deck:". */
export function normalizeDeckSetName(groupName: string): string {
  return (
    groupName.replace(/^Starter Deck\s*\d+:\s*/i, "").trim() || groupName.trim()
  );
}

/** Prefijo de set/deck de un número de carta: "ST21-001" → "ST21", "P-135" → "P". */
export function setCodeFromNumber(cardNumber: string | null): string | null {
  const m = (cardNumber ?? "").toUpperCase().match(/^([A-Z]+\d*)/);
  return m ? m[1] : null;
}

/**
 * Sets a los que debe pertenecer una carta según el grupo/nombre de TCGplayer.
 * Devuelve ORDENADOS [principal, ...secundarios] con su code (los DECKS llevan
 * code — ST21, ST10… — a diferencia de la mayoría de sets, que no).
 *   - Promo  → [pack/playmat real, "One Piece Promotion Cards"] (umbrella 2°).
 *   - Deck   → [nombre del deck formateado] con code = prefijo del número.
 *   - Otro   → [nombre del grupo] (booster, etc.).
 */
export function deriveSetTitles(
  groupName: string | null,
  productName: string | null,
  cardNumber?: string | null
): { title: string; code: string | null }[] {
  const g = (groupName ?? "").trim();
  if (!g) return [];
  if (/promotion/i.test(g)) {
    const pack = extractPromoPack(productName);
    return pack
      ? [{ title: pack, code: null }, { title: g, code: null }]
      : [{ title: g, code: null }];
  }
  if (/^Starter Deck\s*\d+:/i.test(g)) {
    // Deck → nombre formateado + code del número (ST21).
    return [{ title: normalizeDeckSetName(g), code: setCodeFromNumber(cardNumber ?? null) }];
  }
  return [{ title: g, code: null }];
}

/** Clasifica el alternateArt a partir del nombre del producto + disclaimer.
 *  Devuelve un value de altArtOptions (o "Alternate Art" por defecto). */
export function classifyAlternateArt(
  productName: string | null,
  disclaimer: string | null,
  rarity?: string | null
): string {
  const n = (productName ?? "").toLowerCase();
  const d = (disclaimer ?? "").toLowerCase();
  const r = (rarity ?? "").toUpperCase().trim();

  // Pre-errata tiene prioridad (viene del disclaimer, no del nombre).
  if (/pre-?errata|original,? pre-?errata print/.test(d)) return "Pre-Errata";

  if (/demo deck|demo version/.test(n)) return "Demo Version";
  if (/\[winner\]|winner\b/.test(n)) return "Winner Version";
  if (/\[finalist\]|finalist\b/.test(n)) return "Finalist Version";
  if (/\[participant\]|participation/.test(n)) return "Participation Version";
  if (/top ?player/.test(n)) return "Top Player Version";
  if (/\bjudge\b/.test(n)) return "Judge";
  if (/treasure cup/.test(n)) return "Treasure Cup";
  if (/treasure rare/.test(n)) return "Treasure Rare";
  if (/serial/.test(n)) return "Serial";
  if (/pre-?release/.test(n)) return "Pre-Release";
  if (/release event/.test(n)) return "Release event";
  if (/1st anniversary/.test(n)) return "1st Anniversary";
  if (/2nd anniversary/.test(n)) return "2nd Anniversary";
  if (/3rd anniversary/.test(n)) return "3rd Anniversary";
  if (/jolly roger/.test(n)) return "Jolly Roger Foil";
  if (/textured/.test(n)) return "Textured Foil";
  if (/full art/.test(n)) return "Full Art";
  if (/manga/.test(n)) return "Manga Art";
  if (/reprint/.test(n)) return "Reprint";
  if (/special/.test(n)) return "Special Card";
  // Por rareza (cuando el nombre no marca variante): TR = Treasure Rare, etc.
  if (r === "TR" || /treasure rare/.test(n)) return "Treasure Rare";
  if (r === "SP" || r === "SPC") return "Special Card";
  if (/parallel|alternate art/.test(n)) return "Alternate Art";
  return "Alternate Art";
}

/** Extrae los efectos (tags [..] conocidos) del texto de la descripción. */
export function extractEffects(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const m of Array.from(text.matchAll(/\[([^\]]+)\]/g))) {
    const tag = m[1].trim();
    // DON!! xN es un efecto válido con número variable.
    if (/^DON!!\s*x\d+$/i.test(tag)) {
      const norm = tag.replace(/\s+/g, " ");
      if (!seen.has(norm.toLowerCase())) {
        seen.add(norm.toLowerCase());
        found.push(norm);
      }
      continue;
    }
    if (EFFECT_WHITELIST.has(tag.toLowerCase()) && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      found.push(tag);
    }
  }
  return found;
}

/** Nombre de la carta a partir del nombre del producto de TCGplayer. */
export function parseCardName(productName: string, code: string): string {
  const esc = code.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  let n = productName;
  // "Sanji - P-137 (…)" → "Sanji"
  n = n.replace(new RegExp(`\\s*[-–—]\\s*${esc}\\b.*$`, "i"), "");
  // "Yamato (OP01-121) (Reprint)" → "Yamato"
  n = n.replace(new RegExp(`\\s*\\(${esc}\\).*$`, "i"), "");
  // Quitar cualquier paréntesis final restante.
  n = n.replace(/\s*\([^)]*\)\s*$/g, "").trim();
  return n || productName;
}

export type ParsedTcgCard = {
  name: string;
  code: string;
  setCode: string;
  category: string;
  rarity: string | null;
  cost: string | null;
  power: string | null;
  counter: string | null;
  life: string | null;
  attribute: string | null;
  colors: string[];
  types: string[];
  effects: string[];
  texts: string[];
  disclaimer: string | null;
};

/**
 * Convierte el extendedData de un producto TCGplayer + su nombre en los datos
 * completos de una carta lista para crear.
 */
export function parseTcgCard(
  extendedData: Extended,
  productName: string
): ParsedTcgCard | null {
  const code = (ext(extendedData, "Number") ?? "").toUpperCase().trim();
  if (!code) return null;

  const categoryRaw = ext(extendedData, "CardType") ?? "Character";
  const category = CATEGORY_MAP[categoryRaw.toUpperCase()] ?? categoryRaw;

  const rarityRaw = ext(extendedData, "Rarity");
  const rarity = rarityRaw ? RARITY_MAP[rarityRaw.toUpperCase()] ?? rarityRaw : null;

  const costN = ext(extendedData, "Cost");
  const powerN = ext(extendedData, "Power");
  // Counter puede venir como "Counter" o "Counterplus".
  const counterN = ext(extendedData, "Counterplus") ?? ext(extendedData, "Counter");
  const lifeN = ext(extendedData, "Life");

  const cost = costN != null ? `${costN} Cost` : null;
  const power = powerN != null ? `${powerN} Power` : null;
  const counter =
    counterN != null && counterN !== "0" && counterN !== "-"
      ? `+${counterN} Counter`
      : null;
  const life = lifeN != null ? `${lifeN} Life` : null;

  const attribute = ext(extendedData, "Attribute");

  // Colores: "Red" o "Blue;Yellow".
  const colors = (ext(extendedData, "Color") ?? "")
    .split(/[;/]/)
    .map((c) => c.trim())
    .filter(Boolean);

  // Tipos/subtypes: "Straw Hat Crew" o "A;B".
  const types = (ext(extendedData, "Subtypes") ?? "")
    .split(/[;/]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const { effect: effectRaw, disclaimer } = splitDisclaimer(ext(extendedData, "Description"));
  const descriptionText = cleanDescription(effectRaw);
  const effects = extractEffects(descriptionText);
  const texts = descriptionText ? [descriptionText] : [];

  return {
    name: parseCardName(productName, code),
    code,
    setCode: code.split("-")[0] || code,
    category,
    rarity,
    cost,
    power,
    counter,
    life,
    attribute,
    colors,
    types,
    effects,
    texts,
    disclaimer,
  };
}

/**
 * === Identidad canónica de una carta de premio/alt-art de EVENTO ===
 *
 * El texto de un evento ("Treasure Cup August 2026 Top 16 Alt-Art Card
 * OP15-113 Roronoa Zoro") mezcla identidad (código+nombre), variante ("Alt-Art
 * Card"/"Serial") y RUIDO del evento ("Treasure Cup August 2026", "Top 16").
 * Para saber si dos apariciones en eventos distintos son la MISMA carta,
 * necesitamos una llave estable e independiente del evento.
 *
 * La llave = `CÓDIGO|variante-canónica`, donde la variante sale de
 * classifyAlternateArt (Treasure Cup, Serial, Winner, Alternate Art…). Se
 * descartan la colocación (Top 8/16/64) y el nombre/fecha del evento.
 */

/** Slug estable de una variante ("Treasure Cup" → "treasure-cup"). */
export function variantSlug(variant: string | null | undefined): string {
  return (variant ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Variante canónica de una carta de evento a partir del texto del evento
 * (título del evento + título de la carta detectada). Reusa la misma
 * clasificación que usamos para TCGplayer, así ambas fuentes hablan el mismo
 * idioma de variantes.
 */
export function eventCardVariant(eventText: string | null): string {
  return classifyAlternateArt(eventText, null, null);
}

/**
 * Llave canónica de identidad para una carta detectada (evento o TCGplayer),
 * independiente del evento concreto. Misma carta en dos eventos → misma llave.
 *   buildCardIdentityKey("OP15-113", "Treasure Cup Aug 2026 Top 16 Alt-Art…")
 *     → "OP15-113|treasure-cup"
 *
 * `cardText` es el texto propio de la carta y tiene PRIORIDAD: un descriptor
 * intrínseco (Serial, Winner, Judge…) gana sobre el nombre del evento. Solo si
 * el texto de la carta no revela variante se usa `eventContext` como respaldo
 * (útil para layouts viejos donde el <li> solo trae el nombre de la carta).
 */
export function buildCardIdentityKey(
  code: string,
  cardText: string | null,
  eventContext?: string | null
): string {
  const c = (code ?? "").toUpperCase().trim();
  let variant = variantSlug(eventCardVariant(cardText));
  if ((!variant || variant === "alternate-art") && eventContext) {
    const fallback = variantSlug(
      eventCardVariant(`${eventContext} ${cardText ?? ""}`)
    );
    if (fallback) variant = fallback;
  }
  return `${c}|${variant || "alternate-art"}`;
}
