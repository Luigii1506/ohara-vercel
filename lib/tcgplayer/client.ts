import { cache } from "react";

const TOKEN_URL = "https://api.tcgplayer.com/token";
const API_BASE_URL = "https://api.tcgplayer.com";

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable ${key}`);
  }
  return value;
};

const TOKEN_SKEW_SECONDS = 60;

export const getTcgplayerAccessToken = cache(async () => {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - TOKEN_SKEW_SECONDS > now) {
    return tokenCache.token;
  }

  const clientId = getEnv("TCGPLAYER_PUBLIC_KEY");
  const clientSecret = getEnv("TCGPLAYER_PRIVATE_KEY");

  const params = new URLSearchParams();
  params.set("grant_type", "client_credentials");
  params.set("client_id", clientId);
  params.set("client_secret", clientSecret);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TCGplayer auth failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as TokenResponse;
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in,
  };

  return data.access_token;
});

type TcgRequestOptions = RequestInit & {
  auth?: boolean;
};

export async function tcgplayerRequest<T>(
  path: string,
  { auth = true, headers, ...init }: TcgRequestOptions = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const resolvedHeaders = new Headers(headers);

  if (auth) {
    const token = await getTcgplayerAccessToken();
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  if (!resolvedHeaders.has("Accept")) {
    resolvedHeaders.set("Accept", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers: resolvedHeaders,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      typeof payload === "string"
        ? payload
        : JSON.stringify(payload, null, 2)
    );
  }

  return payload as T;
}

export type ProductSearchParams = {
  categoryId?: number;
  productName?: string;
  productNumber?: string;
  groupId?: number;
  offset?: number;
  limit?: number;
};

export type TcgplayerProduct = {
  productId: number;
  name: string;
  groupId: number;
  url: string;
  imageUrl?: string;
  cleanName?: string;
  number?: string;
  setName?: string;
};

type SearchResponse = {
  results: number[];
  resultsTotal: number;
};

type ProductDetailsResponse = {
  results: TcgplayerProduct[];
};

export async function searchProducts(options: ProductSearchParams) {
  const query = new URLSearchParams();
  if (options.categoryId) query.set("categoryId", String(options.categoryId));
  if (options.productName) query.set("productName", options.productName);
  if (options.productNumber) query.set("productNumber", options.productNumber);
  if (options.groupId) query.set("groupId", String(options.groupId));
  if (typeof options.offset === "number") {
    query.set("offset", String(options.offset));
  }
  if (typeof options.limit === "number") {
    query.set("limit", String(options.limit));
  }

  const search = await tcgplayerRequest<SearchResponse>(
    `/catalog/products?${query.toString()}`
  );

  if (!search.results?.length) {
    return [] as TcgplayerProduct[];
  }

  const detailsQuery = new URLSearchParams();
  detailsQuery.set("productIds", search.results.join(","));
  const details = await tcgplayerRequest<ProductDetailsResponse>(
    `/catalog/products/${search.results.join(",")}`
  );

  return details.results ?? [];
}

type PricingResponse = {
  results: {
    productId: number;
    marketPrice?: number;
    midPrice?: number;
    lowPrice?: number;
    directLowPrice?: number;
    subTypeName?: string;
  }[];
};

export async function fetchProductPricing(productIds: number[]) {
  if (!productIds.length) return [] as PricingResponse["results"];
  const uniqueIds = Array.from(new Set(productIds));
  const query = new URLSearchParams();
  query.set("productIds", uniqueIds.join(","));
  const response = await tcgplayerRequest<PricingResponse>(
    `/pricing/product/${uniqueIds.join(",")}`
  );
  return response.results ?? [];
}
