const SET_TOKEN_JOINERS: Array<[RegExp, string]> = [
  [/\bvol\.\s+(\d+)/gi, "vol.$1"],
  [/\bver\.\s+(\d+)/gi, "ver.$1"],
  [/\bversion\s+(\d+)/gi, "version$1"],
  [/\bseason\s+(\d+)/gi, "season$1"],
  [/\bround\s+(\d+)/gi, "round$1"],
];

export const normalizeSetTitle = (value: string | null | undefined): string => {
  if (!value) return "";

  let normalized = value.trim();
  if (!normalized) return "";

  normalized = normalized.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  normalized = normalized.replace(/[–—−]/g, "-");
  normalized = normalized.replace(/\s+/g, " ");

  for (const [pattern, replacement] of SET_TOKEN_JOINERS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized
    .replace(/\s*-\s*/g, "-")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+\./g, ".")
    .replace(/\.\s+/g, ".")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.toLowerCase();
};

export const mergeSetAliases = (
  aliasesJson: unknown,
  candidates: Array<string | null | undefined>
): string[] => {
  const existing = Array.isArray(aliasesJson)
    ? aliasesJson.filter((entry): entry is string => typeof entry === "string")
    : [];

  const byNormalized = new Map<string, string>();

  for (const alias of existing) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    byNormalized.set(normalizeSetTitle(trimmed), trimmed);
  }

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    const normalized = normalizeSetTitle(trimmed);
    if (!normalized || byNormalized.has(normalized)) continue;
    byNormalized.set(normalized, trimmed);
  }

  return Array.from(byNormalized.values());
};
