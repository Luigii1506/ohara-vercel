/**
 * Lógica para crear una ALTERNA a partir de una carta de evento (prize/winner/
 * finalist/serial…). Dos problemas que resuelve:
 *   1) ¿QUÉ tipo de alterna es? — combinando el título de la carta, el del evento
 *      y el nombre del archivo de imagen (que suele traer `_3rd`, `_winner`…).
 *   2) ¿A QUÉ set pertenece? — matcheando la variante contra los sets ya
 *      linkeados al evento (los packs de premio reales: "Winner Card Set",
 *      "Finalist Card Set", "Top Player Pack", "Event Pack"…).
 */
import { classifyAlternateArt } from "../tcgplayerCardData";

/**
 * Clasifica la variante de una carta de premio de evento. Devuelve una etiqueta
 * legible (Winner Version, Finalist Version, 3rd Place, Top Player Version,
 * Treasure Cup, Serial, Champion, Event Exclusive…).
 */
export function classifyEventAlternate(
  cardTitle: string | null,
  eventTitle: string | null,
  imageUrl: string | null
): string {
  const fname = (imageUrl ?? "").split("/").pop()?.toLowerCase() ?? "";
  // Señal de la CARTA (título + filename). NO el título del evento, que trae
  // ruido ("Championship" haría que todo sea "Champion").
  const card = `${cardTitle ?? ""} ${fname}`.toLowerCase();
  const evt = (eventTitle ?? "").toLowerCase();

  // Colocación / tipo de premio, de la señal de la carta.
  if (/\bwinner\b|_winner|\[winner\]/.test(card)) return "Winner Version";
  if (/\bfinalist\b|_finalist|\[finalist\]/.test(card)) return "Finalist Version";
  if (/top ?player|_topplayer/.test(card)) return "Top Player Version";
  const topN = card.match(/top ?(4|8|16|32|64|128)\b/);
  if (topN) return `Top ${topN[1]}`;
  if (/1st ?place|_1st|first ?place/.test(card)) return "1st Place";
  if (/2nd ?place|_2nd|second ?place/.test(card)) return "2nd Place";
  if (/3rd ?place|_3rd|third ?place/.test(card)) return "3rd Place";
  if (/trophy/.test(card)) return "Trophy Card";
  if (/serial ?number|serial|_serial/.test(card)) return "Serial";
  if (/jumbo/.test(card)) return "Jumbo Card";
  if (/\bregional\b|_regional/.test(card)) return "Regional";
  if (/participation|participant/.test(card)) return "Participation Version";
  if (/\bjudge\b/.test(card)) return "Judge";
  if (/pre-?release/.test(card)) return "Pre-Release";

  // Series del EVENTO (aquí sí el título del evento es la señal correcta).
  if (/treasure cup/.test(evt) || /treasure cup/.test(card)) return "Treasure Cup";
  if (/anniversary/.test(evt)) {
    const nth = classifyAlternateArt(evt, null, null);
    if (nth !== "Alternate Art") return nth;
  }

  // Vocabulario general (por si el título trae algo reconocible).
  const base = classifyAlternateArt(cardTitle ?? "", null, null);
  if (base && base !== "Alternate Art") return base;

  // Mejor "Event Exclusive" que "Alternate Art" genérico para un prize.
  return "Event Exclusive";
}

/** Palabras clave del set que corresponden a cada variante, por prioridad. */
const SET_KEYWORDS_BY_VARIANT: { test: RegExp; keywords: RegExp[] }[] = [
  { test: /winner/i, keywords: [/winner/i] },
  { test: /finalist/i, keywords: [/finalist/i] },
  { test: /top ?player/i, keywords: [/top ?player/i] },
  { test: /top \d/i, keywords: [/top ?player/i, /finalist/i, /event pack/i] },
  {
    test: /1st place|2nd place|3rd place|trophy/i,
    keywords: [/top ?player/i, /winner/i, /event pack/i],
  },
  { test: /regional/i, keywords: [/regional/i, /event pack/i] },
  { test: /jumbo/i, keywords: [/jumbo/i, /event pack/i] },
  { test: /participation/i, keywords: [/participation|celebration|event pack/i] },
  { test: /treasure cup/i, keywords: [/treasure/i] },
];

/**
 * Elige el set correcto para una carta de premio entre los sets ya linkeados al
 * evento, matcheando por la variante. Devuelve el setId o null si no hay match.
 */
export function resolveEventCardSetId(
  variant: string,
  eventSets: { id: number; title: string }[]
): number | null {
  if (eventSets.length === 0) return null;

  // 1) Match por keywords de la variante.
  for (const rule of SET_KEYWORDS_BY_VARIANT) {
    if (!rule.test.test(variant)) continue;
    for (const kw of rule.keywords) {
      const hit = eventSets.find((s) => kw.test(s.title));
      if (hit) return hit.id;
    }
  }

  // 2) Un "Event Pack" genérico (donde suelen ir los prizes sin categoría).
  const generic = eventSets.find((s) => /event pack/i.test(s.title));
  if (generic) return generic.id;

  // 3) El primer set linkeado del evento.
  return eventSets[0].id;
}

/** Limpia el título de un evento para usarlo como nombre de set. */
export function cleanEventTitleForSet(title: string | null): string {
  return (title ?? "Event")
    .replace(/\|.*/, "") // quita "| ONE PIECE CARD GAME - ..."
    .replace(/\[(ended|finished|completed)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
