import { prisma } from "@/lib/prisma";
import {
  deriveSetTitles,
  normalizeSetCode,
} from "@/lib/services/tcgplayerCardData";

export type SetMatchResult = {
  setId: number | null;
  title: string;
  code: string | null;
  matchedBy: "code" | "title" | null;
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

export async function findBestSetMatch(
  title: string,
  code: string | null
): Promise<SetMatchResult> {
  const trimmed = title.trim();
  const normalizedCode = normalizeSetCode(code) ?? extractEmbeddedSetCode(trimmed);
  const titleVariants = Array.from(
    new Set([trimmed, stripTrailingSetCode(trimmed)].filter(Boolean))
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
