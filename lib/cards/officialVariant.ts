/**
 * Identidad de "variante oficial" (p1/p2/p3...) tal como la numeran los
 * sitios oficiales (en/asia-en/jp/fr.onepiece-cardgame.com). Separado a
 * propósito de `Card.alias` (nombre libre para mostrar al usuario) y de
 * `Card.order` (sort key / posición de UI) — ver `Card.officialVariantCode`.
 */

// Token ya-correcto tipo "p1", "r23"... (como lo escriben los scrapers
// oficiales). Los sitios oficiales usan DOS prefijos de variante, no solo
// "p": "p" (parallel) y "r" — este último aparece incluso con más frecuencia
// que "p" en JP/EN/FR/ASIA-EN, no es un caso raro.
export const OFFICIAL_VARIANT_RE = /^[pr](\d{1,3})$/i;

// Patrón dentro del nombre de archivo de la imagen (ej. "op06-101_p2.webp").
// Requiere que el "_pN"/"_rN" esté seguido de un separador o el fin del
// string, para no matchear falsos positivos dentro de un código de carta.
export const SRC_VARIANT_RE = /_([pr])(\d{1,3})(?=[._-]|$)/i;

export const isOfficialVariantToken = (value?: string | null): boolean =>
  !!value && OFFICIAL_VARIANT_RE.test(value.trim());

/**
 * Normaliza un input de admin ("p6"/"r6" o "6" suelto) al formato canónico
 * ("p6"/"r6"). Un número suelto sin prefijo se asume "p" (convención previa
 * de entrada manual). Cualquier otra cosa se rechaza (null) en vez de adivinar.
 */
export const normalizeOfficialVariantToken = (
  raw?: string | null
): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const explicit = trimmed.match(/^([pr])(\d{1,3})$/i);
  if (explicit) return `${explicit[1].toLowerCase()}${explicit[2]}`;
  const bare = trimmed.match(/^(\d{1,3})$/);
  return bare ? `p${bare[1]}` : null;
};

/**
 * Infiere el código de variante oficial de una carta existente, en orden de
 * confiabilidad: (a) alias ya tiene el formato correcto, (b) el nombre de
 * archivo del src trae el patrón "_pN"/"_rN", (c) sin señal confiable -> null.
 */
export const inferOfficialVariantCode = (card: {
  alias?: string | null;
  src?: string | null;
}): string | null => {
  const alias = (card.alias ?? "").trim();
  if (OFFICIAL_VARIANT_RE.test(alias)) return alias.toLowerCase();

  const src = card.src ?? "";
  const filename = src.split("/").pop() ?? src;
  const match = filename.match(SRC_VARIANT_RE);
  return match ? `${match[1].toLowerCase()}${match[2]}` : null;
};

/**
 * Set de tokens de variante oficial ya conocidos para un `code` (unión
 * cross-región): un solo token por carta, o vacío si no se conoce.
 */
export const officialVariantTokens = (
  officialVariantCode?: string | null
): Set<string> => {
  const toks = new Set<string>();
  if (officialVariantCode) toks.add(officialVariantCode.toLowerCase());
  return toks;
};
