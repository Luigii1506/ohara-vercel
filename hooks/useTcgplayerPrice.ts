import { useQuery } from "@tanstack/react-query";

type PriceEntry = {
  productId: number;
  marketPrice?: number;
  midPrice?: number;
  lowPrice?: number;
  directLowPrice?: number;
  subTypeName?: string;
};

const fetcher = async (productId: number) => {
  const response = await fetch(
    `/api/tcgplayer/pricing?productIds=${productId}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch price");
  }
  const data = (await response.json()) as { results: PriceEntry[] };
  return data.results?.[0] ?? null;
};

export const useTcgplayerPrice = (productId?: number | null) => {
  return useQuery({
    queryKey: ["tcgplayerPrice", productId],
    queryFn: () => fetcher(productId as number),
    enabled: Boolean(productId),
    staleTime: 5 * 60 * 1000,
  });
};
