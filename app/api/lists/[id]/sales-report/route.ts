export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import type {
  TCGSaleRecord,
  CardSalesReportItem,
  CollectionReportData,
  ReportConditionFilter,
} from "@/types";

// ============================================================================
// TCGPlayer API Configuration
// ============================================================================

const TCGPLAYER_API_BASE = "https://mpapi.tcgplayer.com/v2/product";

const TCGPLAYER_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Origin: "https://www.tcgplayer.com",
  Referer: "https://www.tcgplayer.com/",
  "Sec-Ch-Ua":
    '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
};

// Indicators for filtering out Japanese versions
const JAPANESE_INDICATORS = [
  "japanese",
  "japanere",
  "jp ver",
  "jpn ver",
  "japan ver",
];

// Indicators for filtering out Chinese versions (simplified or traditional)
const CHINESE_INDICATORS = [
  "chinese",
  "china ver",
  "chn ver",
  "cn ver",
  "tc ver",
  "traditional chinese",
  "simplified chinese",
];

const NON_ENGLISH_INDICATORS = [...JAPANESE_INDICATORS, ...CHINESE_INDICATORS];

// Indicators for filtering out graded cards
const GRADED_INDICATORS = [
  "psa ",
  "psa-",
  "cgc ",
  "cgc-",
  "bgs ",
  "bgs-",
  "sgc ",
  "sgc-",
  "graded",
  "gem mint",
];

// ============================================================================
// TCGPlayer API Functions
// ============================================================================

interface TCGPlayerSale {
  condition: string;
  variant: string;
  language: string;
  quantity: number;
  title: string;
  listingType: string;
  purchasePrice: number;
  shippingPrice: number;
  orderDate: string;
}

interface TCGPlayerLatestSalesResponse {
  previousPage: string;
  nextPage: string;
  resultCount: number;
  totalResults: number;
  data: TCGPlayerSale[];
}

async function fetchLatestSales(
  productId: number
): Promise<TCGPlayerLatestSalesResponse | null> {
  try {
    const url = `${TCGPLAYER_API_BASE}/${productId}/latestsales`;

    const response = await fetch(url, {
      method: "POST",
      headers: TCGPLAYER_HEADERS,
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      console.error(
        `TCGPlayer API error for product ${productId}: ${response.status}`
      );
      return null;
    }

    return response.json();
  } catch (error) {
    console.error(`Error fetching sales for product ${productId}:`, error);
    return null;
  }
}

// ============================================================================
// TCGPlayer Active Listings (para "Low Listed" filtrado por condición +
// Gold Star Seller — https://mp-search-api.tcgplayer.com, la misma API
// interna que usa la propia página de producto para su grid de listados)
// ============================================================================

const TCGPLAYER_LISTINGS_API_BASE =
  "https://mp-search-api.tcgplayer.com/v1/product";

interface TCGPlayerListing {
  price: number;
  shippingPrice: number;
  condition: string;
  language: string;
  sellerName: string;
  sellerRating: number;
  /** Insignia "Gold Star Seller" de TCGplayer (feedback >= 99.5%) — ya viene calculada por ellos. */
  goldSeller: boolean;
  quantity: number;
  listingType: string;
  /**
   * Nota libre del vendedor en listados "custom" — aquí es donde se cuela
   * "Japanese"/"Chinese" cuando el vendedor vende una versión no-inglesa
   * bajo la página del producto en inglés: el campo estructurado `language`
   * de ese listado puede seguir diciendo "English" (dato mal cargado por el
   * vendedor), así que no basta con filtrar por `language` en la request.
   */
  customData?: { title?: string; description?: string };
}

interface TCGPlayerListingsResponse {
  errors: unknown[];
  results: Array<{ totalResults: number; results: TCGPlayerListing[] }>;
}

/**
 * Precio más bajo actualmente listado, restringido a vendedores Gold Star
 * (feedback TCGplayer >= 99.5%, el mismo criterio que la insignia dorada de
 * su sitio) y a la condición seleccionada. Pide más resultados de los
 * necesarios (size=50) ordenados por precio ascendente porque los primeros
 * N listados más baratos no siempre son de un Gold Seller — se filtra
 * localmente y se toma el primero que sí lo sea.
 */
async function fetchGoldSellerLowPrice(
  productId: number,
  condition: ReportConditionFilter
): Promise<number | null> {
  try {
    const body = {
      filters: {
        term: {
          sellerStatus: "Live",
          channelId: 0,
          language: ["English"],
          ...(condition !== "Combined" ? { condition: [condition] } : {}),
        },
        range: { quantity: { gte: 1 } },
        exclude: { channelExclusion: 0 },
      },
      from: 0,
      size: 50,
      sort: { field: "price+shipping", order: "asc" },
      context: { shippingCountry: "US", cart: {} },
    };

    const response = await fetch(
      `${TCGPLAYER_LISTINGS_API_BASE}/${productId}/listings?mpfev=5496`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
          "User-Agent": TCGPLAYER_HEADERS["User-Agent"],
          Origin: "https://www.tcgplayer.com",
          Referer: `https://www.tcgplayer.com/product/${productId}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) return null;

    const data: TCGPlayerListingsResponse = await response.json();
    const listings = data.results?.[0]?.results ?? [];
    const englishListings = listings.filter((l) => !isNonEnglishListing(l));
    const goldListing = englishListings.find((l) => l.goldSeller);
    return goldListing ? goldListing.price : null;
  } catch (error) {
    console.error(`Error fetching gold-seller listings for product ${productId}:`, error);
    return null;
  }
}

// El filtro `language: ["English"]` de la request no alcanza: un listado
// "custom" puede traer el campo estructurado `language` en "English" (mal
// cargado por el vendedor) mientras la nota libre del propio vendedor
// (`customData.title`/`description`) dice "Japanese Version" o similar —
// visto en producción con listados Gold Seller reales. Se revisa ese texto
// libre además del campo estructurado antes de aceptar un listado.
function isNonEnglishListing(listing: TCGPlayerListing): boolean {
  if (listing.language && listing.language !== "English") return true;
  const freeText = `${listing.customData?.title ?? ""} ${listing.customData?.description ?? ""}`.toLowerCase();
  return NON_ENGLISH_INDICATORS.some((indicator) => freeText.includes(indicator));
}

// TCGPlayer devuelve la condición como texto libre ("Near Mint", "NM",
// "Lightly Played", "LP"...) según el endpoint/momento — se normaliza a un
// puñado de alias conocidos en vez de comparar el string tal cual, para no
// perder ventas reales solo por una abreviatura distinta.
const CONDITION_ALIASES: Record<ReportConditionFilter, string[]> = {
  "Near Mint": ["near mint", "nm", "mint"],
  "Lightly Played": ["lightly played", "lp", "light play", "light played"],
  Combined: [],
};

function matchesCondition(
  saleCondition: string | undefined,
  filter: ReportConditionFilter
): boolean {
  if (filter === "Combined") return true;
  const normalized = (saleCondition || "").trim().toLowerCase();
  return CONDITION_ALIASES[filter].some((alias) => normalized === alias);
}

function filterSales(
  sales: TCGPlayerSale[],
  language: string = "English",
  condition: ReportConditionFilter = "Combined"
): TCGPlayerSale[] {
  return sales.filter((sale) => {
    const titleLower = (sale.title || "").toLowerCase();

    // Always exclude graded cards
    const isGraded = GRADED_INDICATORS.some((indicator) =>
      titleLower.includes(indicator)
    );
    if (isGraded) return false;

    if (!matchesCondition(sale.condition, condition)) return false;

    // For English, exclude Japanese version indicators in title
    if (language === "English") {
      const hasJapaneseInTitle = JAPANESE_INDICATORS.some((indicator) =>
        titleLower.includes(indicator)
      );
      return sale.language === language && !hasJapaneseInTitle;
    }

    // For Japanese, include if language=Japanese OR has Japanese indicators
    if (language === "Japanese") {
      const hasJapaneseInTitle = JAPANESE_INDICATORS.some((indicator) =>
        titleLower.includes(indicator)
      );
      return sale.language === language || hasJapaneseInTitle;
    }

    // For other languages, just filter by language field
    return sale.language === language;
  });
}

function calculateTop3Average(sales: TCGPlayerSale[]): number | null {
  if (sales.length === 0) return null;

  const topSales = sales.slice(0, 3);
  const total = topSales.reduce((sum, sale) => sum + sale.purchasePrice, 0);
  return total / topSales.length;
}

// Promedio de los valores no nulos que vengan; si ambos faltan, null. Evita
// que "(A + null) / 2" castigue el valor cuando solo tenemos uno de los dos.
function blendValues(...values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

const PERCENTILES = Array.from({ length: 15 }, (_, i) => 120 - i * 5); // 120..50

// ============================================================================
// API Route Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verify admin authentication
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 2. Parse and validate list ID
    const listId = parseInt(params.id);
    if (isNaN(listId) || listId <= 0) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    // 3. Get query parameters
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language") || "English";
    const salesToAverage = Math.min(
      10,
      Math.max(1, parseInt(searchParams.get("salesToAverage") || "3"))
    );
    const conditionParam = searchParams.get("condition");
    const condition: ReportConditionFilter =
      conditionParam === "Near Mint" || conditionParam === "Lightly Played"
        ? conditionParam
        : "Combined";

    // 4. Fetch the list with all cards
    const list = await prisma.userList.findUnique({
      where: { id: listId },
      include: {
        cards: {
          include: {
            card: {
              include: {
                colors: true,
                types: true,
              },
            },
          },
        },
      },
    });

    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // 5. Group cards by cardId - if same card appears multiple times, sum quantities
    // Also track unique productIds for API calls
    const uniqueCards = new Map<
      number,
      {
        cardId: number;
        code: string;
        name: string;
        src: string;
        quantity: number;
        productId: string | null;
        customPrice: number | null;
        marketPrice: number | null;
        lowPrice: number | null;
        midPrice: number | null;
      }
    >();

    const productIdsToFetch = new Set<string>();

    for (const listCard of list.cards) {
      const card = listCard.card;
      if (!card) continue;

      const existingCard = uniqueCards.get(card.id);
      const listCardQty = listCard.quantity || 1;

      if (existingCard) {
        // Same card already exists, sum the quantities
        existingCard.quantity += listCardQty;
        // Keep customPrice from first occurrence if exists
        if (listCard.customPrice && !existingCard.customPrice) {
          existingCard.customPrice = Number(listCard.customPrice);
        }
      } else {
        // New card, add it to the map
        uniqueCards.set(card.id, {
          cardId: card.id,
          code: card.code,
          name: card.name,
          src: card.src,
          quantity: listCardQty,
          productId: card.tcgplayerProductId || null,
          customPrice: listCard.customPrice
            ? Number(listCard.customPrice)
            : null,
          marketPrice: card.marketPrice ? Number(card.marketPrice) : null,
          lowPrice: card.lowPrice ? Number(card.lowPrice) : null,
          midPrice: card.midPrice ? Number(card.midPrice) : null,
        });
      }

      if (card.tcgplayerProductId) {
        productIdsToFetch.add(card.tcgplayerProductId);
      }
    }

    // 6. Fetch sales data + gold-seller low listing for each unique productId
    const salesCache = new Map<
      string,
      { sales: TCGSaleRecord[]; average: number | null }
    >();
    const goldLowCache = new Map<string, number | null>();

    for (const productId of Array.from(productIdsToFetch)) {
      // Fetch sales from TCGPlayer
      const salesResponse = await fetchLatestSales(parseInt(productId));

      let filteredSales: TCGSaleRecord[] = [];
      let top3Average: number | null = null;

      if (salesResponse && salesResponse.data) {
        const filtered = filterSales(salesResponse.data, language, condition);
        filteredSales = filtered.slice(0, salesToAverage).map((sale) => ({
          condition: sale.condition,
          variant: sale.variant,
          language: sale.language,
          purchasePrice: sale.purchasePrice,
          orderDate: sale.orderDate,
          title: sale.title,
        }));
        top3Average = calculateTop3Average(filtered);
      }

      // Cache the results
      salesCache.set(productId, { sales: filteredSales, average: top3Average });

      // "Low Listed" real: precio más bajo de un vendedor Gold Star (feedback
      // TCGplayer >= 99.5%) en la condición elegida — no el low agregado de
      // Card.lowPrice, que mezcla cualquier vendedor sin importar reputación.
      const goldLow = await fetchGoldSellerLowPrice(parseInt(productId), condition);
      goldLowCache.set(productId, goldLow);

      // Small delay to be nice to the API (100ms)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 7. Build report items for each unique list card
    const reportCards: CardSalesReportItem[] = [];
    let successfulLookups = 0;
    let failedLookups = 0;
    let totalBlended = 0;
    let totalMidPrice = 0;
    let totalMarketPrice = 0;
    let totalQuantity = 0;

    for (const [, cardData] of Array.from(uniqueCards)) {
      const { productId, code, name, src, quantity, customPrice, marketPrice, lowPrice, midPrice } = cardData;

      let filteredSales: TCGSaleRecord[] = [];
      let top3Average: number | null = null;

      if (productId) {
        const cached = salesCache.get(productId);
        if (cached) {
          filteredSales = cached.sales;
          top3Average = cached.average;
        }
      }

      if (top3Average !== null) {
        successfulLookups++;
      } else {
        failedLookups++;
      }

      // "Low Listed" preferido: el más barato de un vendedor Gold Star en la
      // condición elegida. Si TCGplayer no devolvió ninguno (ej. producto sin
      // listados activos de un Gold Seller en esa condición específica), NO
      // se cae al agregado de Card.lowPrice cuando hay una condición
      // específica seleccionada — ese agregado mezcla todas las condiciones,
      // y meterlo al blend contaminaría un reporte que se pidió "solo Near
      // Mint" o "solo Lightly Played" con un número que no es de esa
      // condición. El fallback al agregado solo tiene sentido en "Combined",
      // donde "cualquier condición" es exactamente lo que se pidió.
      const goldSellerLow = productId ? (goldLowCache.get(productId) ?? null) : null;
      const effectiveLowPrice =
        goldSellerLow ?? (condition === "Combined" ? lowPrice : null);
      const lowPriceIsGoldSeller = goldSellerLow !== null;

      // "Average last sales" + "Low listed" — si falta uno de los dos se usa
      // el otro solo, en vez de castigar el promedio contra null.
      const blendedValue = blendValues(top3Average, effectiveLowPrice);

      const subtotalBlended = (blendedValue ?? 0) * quantity;
      const subtotalMidPrice = (midPrice ?? 0) * quantity;
      const subtotalMarketPrice = (marketPrice ?? 0) * quantity;

      totalBlended += subtotalBlended;
      totalMidPrice += subtotalMidPrice;
      totalMarketPrice += subtotalMarketPrice;
      totalQuantity += quantity;

      reportCards.push({
        cardCode: code,
        cardName: name,
        cardSrc: src,
        productId: productId ? parseInt(productId) : null,
        quantity,
        lastSales: filteredSales,
        top3Average,
        lowPrice: effectiveLowPrice,
        lowPriceIsGoldSeller,
        midPrice,
        marketPrice,
        blendedValue,
        subtotalBlended,
        subtotalMidPrice,
        subtotalMarketPrice,
        customPrice,
        error: productId ? undefined : "No TCGPlayer product ID",
      });
    }

    // 8. Sort cards by code for consistent output
    reportCards.sort((a, b) => a.cardCode.localeCompare(b.cardCode));

    // 9. Tabla de referencia: los 3 totales a cada nivel de 120% a 50%.
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const percentiles = PERCENTILES.map((percent) => ({
      percent,
      blended: round2((totalBlended * percent) / 100),
      midPrice: round2((totalMidPrice * percent) / 100),
      marketPrice: round2((totalMarketPrice * percent) / 100),
    }));

    // 10. Build the response
    const reportData: CollectionReportData = {
      listName: list.name,
      listId: list.id,
      generatedAt: new Date().toISOString(),
      condition,
      totalCards: reportCards.length,
      totalQuantity,
      successfulLookups,
      failedLookups,
      cards: reportCards,
      totalBlended: round2(totalBlended),
      totalMidPrice: round2(totalMidPrice),
      totalMarketPrice: round2(totalMarketPrice),
      percentiles,
    };

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("Error generating sales report:", error);
    return handleAuthError(error);
  }
}
