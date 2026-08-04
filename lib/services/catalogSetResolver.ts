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

export async function findBestSetMatch(
  title: string,
  code: string | null
): Promise<SetMatchResult> {
  const trimmed = title.trim();

  if (code) {
    const coded = await prisma.set.findMany({
      where: { code: { not: null } },
      select: { id: true, code: true, title: true, _count: { select: { cards: true } } },
      orderBy: { cards: { _count: "desc" } },
    });
    const match = coded.find((set) => normalizeSetCode(set.code) === code);
    if (match) {
      return { setId: match.id, title: match.title, code: match.code, matchedBy: "code" };
    }
  }

  const candidates = await prisma.set.findMany({
    where: { title: { contains: trimmed, mode: "insensitive" } },
    select: { id: true, title: true, code: true },
  });
  const match = candidates.find(
    (set) => set.title.trim().toLowerCase() === trimmed.toLowerCase()
  );

  return {
    setId: match?.id ?? null,
    title: match?.title ?? trimmed,
    code: match?.code ?? code,
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
