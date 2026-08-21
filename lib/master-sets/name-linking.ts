type CharacterNameMatcher = {
  id: number;
  slug: string;
  aliases: string[];
  normalizedAliases: string[];
};

function normalizeNameForMatch(value: string | null | undefined) {
  if (!value) return "";

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueAliases(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function expandAliasVariants(alias: string) {
  const variants = new Set<string>([alias.trim()]);
  const parentheticalMatches = Array.from(alias.matchAll(/\(([^)]+)\)/g))
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];

  if (parentheticalMatches.length > 0) {
    const withoutParentheses = alias.replace(/\s*\([^)]*\)\s*/g, " ").trim();
    if (withoutParentheses) {
      variants.add(withoutParentheses);
    }

    for (const parenthetical of parentheticalMatches) {
      variants.add(parenthetical);
    }
  }

  return Array.from(variants).filter(Boolean);
}

export function buildCharacterNameMatchers(
  characters: Array<{
    id: number;
    slug: string;
    name: string;
    aliases: string[];
  }>
): CharacterNameMatcher[] {
  return characters.map((character) => {
    const aliases = uniqueAliases(
      [character.name, ...(character.aliases ?? [])].flatMap((alias) =>
        expandAliasVariants(alias)
      )
    ).sort((left, right) => right.length - left.length);

    return {
      id: character.id,
      slug: character.slug,
      aliases,
      normalizedAliases: aliases
        .map((alias) => normalizeNameForMatch(alias))
        .filter(Boolean),
    };
  });
}

export function findCharacterNameMatch(
  cardName: string | null | undefined,
  matcher: CharacterNameMatcher
) {
  const normalizedCardName = normalizeNameForMatch(cardName);
  if (!normalizedCardName) {
    return null;
  }

  const haystack = ` ${normalizedCardName} `;

  for (let index = 0; index < matcher.normalizedAliases.length; index += 1) {
    const normalizedAlias = matcher.normalizedAliases[index];
    if (!normalizedAlias) continue;

    if (haystack.includes(` ${normalizedAlias} `)) {
      return {
        matchedAlias: matcher.aliases[index] ?? normalizedAlias,
        normalizedCardName,
      };
    }
  }

  return null;
}

export { normalizeNameForMatch };
