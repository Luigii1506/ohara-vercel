import { prisma } from "@/lib/prisma";
import {
  deriveSetTitles,
  normalizeSetCode,
} from "@/lib/services/tcgplayerCardData";

export type SetMatchResult = {
  setId: number | null;
  title: string;
  code: string | null;
  matchedBy: "code" | "title" | "sourceLink" | null;
};

function extractEmbeddedSetCode(title: string): string | null {
  const matches = Array.from(title.matchAll(/[\[(]([A-Z]{2,5}[-\s]?\d{1,3})[\])]/gi));
  for (const match of matches.reverse()) {
    const normalized = normalizeSetCode(match[1] ?? null);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function stripTrailingSetCode(title: string): string {
  return title
    .replace(/\s*[\[(][A-Z]{2,5}[-\s]?\d{1,3}[\])]\s*$/i, "")
    .trim();
}

/**
 * TCGplayer nombra sus packs de evento de Championship con el prefijo "CS"
 * ("CS 2023 Event Pack"), pero nuestro catálogo pre-existente los tenía
 * importados con el nombre completo ("Championship 2023 Event Pack") — sin
 * este swap, el match por título nunca encontraba el Set ya existente y
 * terminaba creando un duplicado completo (mismas cartas, dos Sets
 * distintos). Genera la variante equivalente en ambos sentidos para que el
 * match por título la considere.
 */
function csChampionshipVariant(title: string): string | null {
  if (/^CS\b/i.test(title)) return title.replace(/^CS\b/i, "Championship");
  if (/^Championship\b/i.test(title)) return title.replace(/^Championship\b/i, "CS");
  return null;
}

export async function findBestSetMatch(
  title: string,
  code: string | null
): Promise<SetMatchResult> {
  const trimmed = title.trim();
  const normalizedCode = normalizeSetCode(code) ?? extractEmbeddedSetCode(trimmed);
  const baseVariants = [trimmed, stripTrailingSetCode(trimmed)];
  const titleVariants = Array.from(
    new Set(
      baseVariants
        .flatMap((v) => [v, csChampionshipVariant(v)])
        .filter((v): v is string => Boolean(v))
    )
  );

  if (normalizedCode) {
    const coded = await prisma.set.findMany({
      where: { code: { not: null } },
      select: { id: true, code: true, title: true, _count: { select: { cards: true } } },
      orderBy: { cards: { _count: "desc" } },
    });
    const match = coded.find((set) => normalizeSetCode(set.code) === normalizedCode);
    if (match) {
      return {
        setId: match.id,
        title: match.title,
        code: match.code,
        matchedBy: "code",
      };
    }
  }

  const candidates = await prisma.set.findMany({
    where: {
      OR: titleVariants.map((variant) => ({
        title: { contains: variant, mode: "insensitive" },
      })),
    },
    select: { id: true, title: true, code: true },
  });
  const exactVariantMatch = candidates.find((set) =>
    titleVariants.some((variant) => set.title.trim().toLowerCase() === variant.toLowerCase())
  );
  const normalizedVariantMatch = candidates.find((set) =>
    titleVariants.some(
      (variant) =>
        stripTrailingSetCode(set.title).toLowerCase() === stripTrailingSetCode(variant).toLowerCase()
    )
  );
  const match = exactVariantMatch ?? normalizedVariantMatch;

  return {
    setId: match?.id ?? null,
    title: match?.title ?? trimmed,
    code: match?.code ?? normalizedCode,
    matchedBy: match ? "title" : null,
  };
}

export async function resolveTcgSetTargets(
  groupName: string | null,
  groupAbbreviation: string | null,
  productName: string | null
): Promise<SetMatchResult[]> {
  const targets = deriveSetTitles(groupName, groupAbbreviation, productName);
  return Promise.all(targets.map((target) => findBestSetMatch(target.title, target.code)));
}
