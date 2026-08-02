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

  const descriptionText = cleanDescription(ext(extendedData, "Description"));
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
  };
}
