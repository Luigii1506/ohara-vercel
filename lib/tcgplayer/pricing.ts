import { fetchProductPricing } from "./client";

type CachedEntry = {
  expiresAt: number;
  data: {
    productId: number;
    marketPrice?: number;
    midPrice?: number;
    lowPrice?: number;
    directLowPrice?: number;
    subTypeName?: string;
  };
};

const cacheStore = new Map<number, CachedEntry>();
const DEFAULT_TTL_SECONDS = Number(process.env.TCGPLAYER_PRICING_TTL ?? 900);

export async function getPricingForProducts(productIds: number[]) {
  const now = Date.now();
  const result: CachedEntry["data"][] = [];
  const missing: number[] = [];

  for (const id of productIds) {
    if (!id) continue;
    const cached = cacheStore.get(id);
    if (cached && cached.expiresAt > now) {
      result.push(cached.data);
    } else {
      missing.push(id);
    }
  }

  if (missing.length) {
    const fresh = await fetchProductPricing(missing);
    for (const entry of fresh) {
      const expiresAt = now + DEFAULT_TTL_SECONDS * 1000;
      cacheStore.set(entry.productId, { expiresAt, data: entry });
      result.push(entry);
    }
  }

  return result;
}
