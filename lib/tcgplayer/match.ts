import type { Card } from "@prisma/client";
import { searchProducts, TcgplayerProduct } from "./client";

const DEFAULT_CATEGORY_ID = Number(process.env.TCGPLAYER_CATEGORY_ID ?? 53);

const normalize = (value?: string | null) =>
  value ? value.toString().trim().toLowerCase() : "";

export type MatchResult = {
  bestMatch: TcgplayerProduct | null;
  candidates: TcgplayerProduct[];
};

export async function findBestProductMatch(card: Card): Promise<MatchResult> {
  const categoryId = DEFAULT_CATEGORY_ID;
  const normalizedCode = normalize(card.code).toUpperCase();
  const normalizedName = normalize(card.name);

  const products = await searchProducts({
    categoryId,
    productNumber: normalizedCode || undefined,
    productName: card.name,
    limit: 50,
  });

  if (!products.length) {
    return { bestMatch: null, candidates: [] };
  }

  const exactNumberMatches = products.filter(
    (product) => normalize(product.number).toUpperCase() === normalizedCode
  );

  if (exactNumberMatches.length === 1) {
    return { bestMatch: exactNumberMatches[0], candidates: products };
  }

  const nameMatches = products.filter((product) => {
    const clean = normalize(product.cleanName || product.name);
    return clean.includes(normalizedName);
  });

  if (nameMatches.length === 1) {
    return { bestMatch: nameMatches[0], candidates: products };
  }

  return {
    bestMatch: exactNumberMatches[0] ?? nameMatches[0] ?? null,
    candidates: products,
  };
}
