import "server-only";

const TOKEN_ENDPOINT = "https://api.tcgplayer.com/token";
const API_VERSION = process.env.TCGPLAYER_API_VERSION ?? "v1.39.0";
const API_BASE_URL = `https://api.tcgplayer.com/${API_VERSION}`;
const ONE_PIECE_CATEGORY_ID = 68;

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

export interface CategorySearchFilter {
  name: string;
  values: string[];
}

export interface CategorySearchOptions {
  categoryId: number;
  filters: CategorySearchFilter[];
  sort?: string;
  limit?: number;
  offset?: number;
  includeExtendedFields?: boolean;
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

const scorePricingEntry = (entry: PricingEntry | undefined) => {
  if (!entry) return -Infinity;
  const values = [
    entry.marketPrice,
    entry.midPrice,
    entry.lowPrice,
    entry.highPrice,
    entry.directLowPrice,
  ];
  const defined = values.filter(
    (value) => typeof value === "number" && Number.isFinite(value)
  ).length;
  const subtype = entry.subTypeName?.toLowerCase() ?? "";
  const normalBonus = subtype === "normal" ? 2 : 0;
  const foilPenalty = subtype.includes("foil") ? -1 : 0;
  return defined * 10 + normalBonus + foilPenalty;
};

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
  const headers: Record<string, string> = {
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

  const entries = data.results ?? [];
  if (!entries.length) {
    return [];
  }

  const bestEntries = new Map<number, PricingEntry>();
  for (const entry of entries) {
    const current = bestEntries.get(entry.productId);
    if (!current) {
      bestEntries.set(entry.productId, entry);
      continue;
    }
    if (scorePricingEntry(entry) >= scorePricingEntry(current)) {
      bestEntries.set(entry.productId, entry);
    }
  }

  return Array.from(bestEntries.values());
}

export { tcgplayerFetch };

export async function getTcgplayerProductsByIds(
  productIds: number[],
  getExtendedFields = true
): Promise<TcgplayerProduct[]> {
  if (!productIds.length) return [];

  const query = new URLSearchParams();
  if (getExtendedFields) {
    query.set("includeExtendedFields", "true");
  }
  const joinedIds = productIds.join(",");
  const path = `/catalog/products/${joinedIds}${
    query.toString() ? `?${query.toString()}` : ""
  }`;

  const data = await tcgplayerFetch<{
    success: boolean;
    results: TcgplayerProduct[];
    errors?: unknown[];
  }>(path);
  console.log("654321", data);

  if (!data.success) {
    throw new Error("TCGplayer product lookup failed");
  }

  return data.results ?? [];
}

export async function searchTcgplayerByName(
  params: ProductSearchParams
): Promise<ProductSearchResponse> {
  const categoryId =
    typeof params.categoryId === "number" && params.categoryId > 0
      ? params.categoryId
      : ONE_PIECE_CATEGORY_ID;

  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  // IMPORTANT: TCGplayer's ProductName filter has a known limitation
  // It only returns up to 50 total results regardless of actual matches
  // This is a TCGplayer API limitation, not our bug
  const filters: CategorySearchFilter[] = [];

  if (params.name) {
    filters.push({ name: "ProductName", values: [params.name] });
  }

  const requestBody = {
    sort: "ProductName ASC",
    limit,
    offset,
    filters,
  };

  console.log("[searchTcgplayerByName] Request:", {
    categoryId,
    body: requestBody,
  });

  const response = await tcgplayerFetch<{
    success: boolean;
    totalItems: number;
    results: number[];
    errors?: unknown[];
  }>(`/catalog/categories/${categoryId}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  console.log("[searchTcgplayerByName] API Response:", {
    success: response.success,
    totalItems: response.totalItems,
    resultsCount: response.results?.length,
  });

  if (!response.success) {
    console.error("[searchTcgplayerByName] Search failed:", response);
    throw new Error("TCGplayer text search failed");
  }

  const productIds = response.results ?? [];
  const products = await getTcgplayerProductsByIds(
    productIds,
    params.getExtendedFields ?? true
  );

  // Calculate nextOffset using totalItems (not totalResults!)
  const nextOffset =
    offset + productIds.length < (response.totalItems ?? 0)
      ? offset + productIds.length
      : null;

  console.log("[searchTcgplayerByName] Pagination:", {
    offset,
    productIdsLength: productIds.length,
    totalItems: response.totalItems,
    calculatedNextOffset: nextOffset,
  });

  return {
    results: products,
    totalResults: response.totalItems ?? products.length,
    nextOffset,
  };
}

export async function searchTcgplayerCategoryProducts(
  options: CategorySearchOptions
): Promise<ProductSearchResponse> {
  const categoryId =
    typeof options.categoryId === "number" && options.categoryId > 0
      ? options.categoryId
      : ONE_PIECE_CATEGORY_ID;

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const response = await tcgplayerFetch<{
    success: boolean;
    totalResults: number;
    results: number[];
    errors?: unknown[];
  }>(`/catalog/categories/${categoryId}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sort: options.sort ?? "ProductName ASC",
      limit,
      offset,
      filters: options.filters ?? [],
    }),
  });

  console.log("123", response);

  if (!response.success) {
    throw new Error("TCGplayer category search failed");
  }

  const productIds = response.results ?? [];
  const products = await getTcgplayerProductsByIds(
    productIds,
    options.includeExtendedFields ?? true
  );

  const nextOffset =
    offset + productIds.length < (response.totalResults ?? 0)
      ? offset + productIds.length
      : null;

  return {
    results: products,
    totalResults: response.totalResults ?? products.length,
    nextOffset,
  };
}
