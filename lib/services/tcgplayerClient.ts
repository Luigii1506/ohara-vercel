import "server-only";

const TOKEN_ENDPOINT = "https://api.tcgplayer.com/token";
const API_VERSION = process.env.TCGPLAYER_API_VERSION ?? "v1.39.0";
const API_BASE_URL = `https://api.tcgplayer.com/${API_VERSION}`;

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface TcgplayerTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  userName: string;
}

export interface TcgplayerProduct {
  productId: number;
  name: string;
  cleanName?: string | null;
  imageUrl?: string | null;
  groupName?: string | null;
  url?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  extendedData?: Array<{ name: string; value: string }>;
  groupId?: number | null;
  shippingCategoryId?: number | null;
  sku?: string | null;
}

export interface ProductSearchParams {
  name?: string;
  productLineName?: string;
  categoryId?: number;
  groupId?: number;
  offset?: number;
  limit?: number;
  getExtendedFields?: boolean;
}

export interface ProductSearchResponse {
  results: TcgplayerProduct[];
  totalResults: number;
  nextOffset: number | null;
}

interface PricingEntry {
  productId: number;
  marketPrice?: number | null;
  midPrice?: number | null;
  lowPrice?: number | null;
  highPrice?: number | null;
  directLowPrice?: number | null;
  subTypeName?: string | null;
}

let tokenCache: TokenCache | null = null;

const getEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

async function requestAccessToken(): Promise<TokenCache> {
  const clientId = getEnv("TCGPLAYER_PUBLIC_KEY");
  const clientSecret = getEnv("TCGPLAYER_PRIVATE_KEY");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to fetch TCGplayer token: ${response.status} ${text}`
    );
  }

  const data = (await response.json()) as TcgplayerTokenResponse;
  const expiresAt = Date.now() + data.expires_in * 1000 - 60 * 1000; // refresh 1 min early

  const cacheEntry: TokenCache = {
    accessToken: data.access_token,
    expiresAt,
  };

  tokenCache = cacheEntry;
  return cacheEntry;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }
  const newToken = await requestAccessToken();
  return newToken.accessToken;
}

async function tcgplayerFetch<T>(
  path: string,
  init?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(init?.headers || {}),
  };

  if (!init?.skipAuth) {
    const token = await getAccessToken();
    headers["Authorization"] = `bearer ${token}`;
  }

  const response = await fetch(
    path.startsWith("http") ? path : `${API_BASE_URL}${path}`,
    {
      ...init,
      headers,
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `TCGplayer request failed (${response.status}): ${errorBody}`
    );
  }

  return (await response.json()) as T;
}

export async function searchTcgplayerProducts(
  params: ProductSearchParams
): Promise<ProductSearchResponse> {
  const searchParams = new URLSearchParams();
  if (params.name) searchParams.set("productName", params.name);
  if (params.productLineName)
    searchParams.set("productLineName", params.productLineName);
  if (typeof params.categoryId === "number")
    searchParams.set("categoryId", String(params.categoryId));
  if (typeof params.groupId === "number")
    searchParams.set("groupId", String(params.groupId));
  if (typeof params.offset === "number")
    searchParams.set("offset", String(params.offset));
  if (typeof params.limit === "number")
    searchParams.set("limit", String(params.limit));
  if (params.getExtendedFields)
    searchParams.set("getExtendedFields", "true");

  const data = await tcgplayerFetch<{
    success: boolean;
    results: TcgplayerProduct[];
    totalResults: number;
    resultsCount: number;
    offset: number;
    errors?: unknown[];
  }>(`/catalog/products?${searchParams.toString()}`);

  if (!data.success) {
    throw new Error("TCGplayer product search returned an unsuccessful status");
  }

  const nextOffset =
    data.results?.length && data.results.length > 0
      ? data.offset + data.results.length
      : null;

  return {
    results: data.results ?? [],
    totalResults: data.totalResults ?? data.results?.length ?? 0,
    nextOffset,
  };
}

export async function getTcgplayerProductPricing(productIds: number[]) {
  if (!productIds.length) {
    return [];
  }
  const joined = productIds.join(",");
  const data = await tcgplayerFetch<{
    success: boolean;
    results: PricingEntry[];
    errors?: unknown[];
  }>(`/pricing/product/${joined}`);

  if (!data.success) {
    throw new Error("TCGplayer pricing request failed");
  }

  return data.results ?? [];
}

export { tcgplayerFetch };

export async function getTcgplayerProductsByIds(
  productIds: number[],
  getExtendedFields = true
): Promise<TcgplayerProduct[]> {
  if (!productIds.length) return [];

  const payload = {
    productIds,
    getExtendedFields,
  };

  const data = await tcgplayerFetch<{
    success: boolean;
    results: TcgplayerProduct[];
    errors?: unknown[];
  }>("/catalog/products/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!data.success) {
    throw new Error("TCGplayer product lookup failed");
  }

  return data.results ?? [];
}
