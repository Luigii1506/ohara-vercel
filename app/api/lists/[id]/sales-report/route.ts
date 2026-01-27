export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import type {
  TCGSaleRecord,
  CardSalesReportItem,
  CollectionReportData,
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

function filterSales(
  sales: TCGPlayerSale[],
  language: string = "English"
): TCGPlayerSale[] {
  return sales.filter((sale) => {
    const titleLower = (sale.title || "").toLowerCase();

    // Always exclude graded cards
    const isGraded = GRADED_INDICATORS.some((indicator) =>
      titleLower.includes(indicator)
    );
    if (isGraded) return false;

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

    // 5. Group cards by listCard.id (unique entry in list) to avoid duplicates
    // Also track unique productIds for API calls
    const uniqueListCards = new Map<
      number,
      {
        listCardId: number;
        cardId: number;
        code: string;
        name: string;
        src: string;
        quantity: number;
        productId: string | null;
        customPrice: number | null;
        marketPrice: number | null;
      }
    >();

    const productIdsToFetch = new Set<string>();

    for (const listCard of list.cards) {
      const card = listCard.card;
      if (!card) continue;

      // Use listCard.id as the unique key (each entry in the list)
      uniqueListCards.set(listCard.id, {
        listCardId: listCard.id,
        cardId: card.id,
        code: card.code,
        name: card.name,
        src: card.src,
        quantity: listCard.quantity || 1,
        productId: card.tcgplayerProductId || null,
        customPrice: listCard.customPrice
          ? Number(listCard.customPrice)
          : null,
        marketPrice: card.marketPrice ? Number(card.marketPrice) : null,
      });

      if (card.tcgplayerProductId) {
        productIdsToFetch.add(card.tcgplayerProductId);
      }
    }

    // 6. Fetch sales data for each unique productId
    const salesCache = new Map<
      string,
      { sales: TCGSaleRecord[]; average: number | null }
    >();

    for (const productId of Array.from(productIdsToFetch)) {
      // Fetch sales from TCGPlayer
      const salesResponse = await fetchLatestSales(parseInt(productId));

      let filteredSales: TCGSaleRecord[] = [];
      let top3Average: number | null = null;

      if (salesResponse && salesResponse.data) {
        const filtered = filterSales(salesResponse.data, language);
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

      // Small delay to be nice to the API (100ms)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 7. Build report items for each unique list card
    const reportCards: CardSalesReportItem[] = [];
    let successfulLookups = 0;
    let failedLookups = 0;
    let totalValue = 0;
    let totalQuantity = 0;

    for (const [, cardData] of Array.from(uniqueListCards)) {
      const { productId, code, name, src, quantity, customPrice, marketPrice } = cardData;

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

      const subtotal = (top3Average || 0) * quantity;
      totalValue += subtotal;
      totalQuantity += quantity;

      reportCards.push({
        cardCode: code,
        cardName: name,
        cardSrc: src,
        productId: productId ? parseInt(productId) : null,
        quantity,
        lastSales: filteredSales,
        top3Average,
        subtotal,
        customPrice,
        marketPrice,
        error: productId ? undefined : "No TCGPlayer product ID",
      });
    }

    // 8. Sort cards by code for consistent output
    reportCards.sort((a, b) => a.cardCode.localeCompare(b.cardCode));

    // 9. Build the response
    const reportData: CollectionReportData = {
      listName: list.name,
      listId: list.id,
      generatedAt: new Date().toISOString(),
      totalCards: reportCards.length,
      totalQuantity,
      successfulLookups,
      failedLookups,
      cards: reportCards,
      totalValue: Math.round(totalValue * 100) / 100,
      value70Percent: Math.round(totalValue * 0.7 * 100) / 100,
      value80Percent: Math.round(totalValue * 0.8 * 100) / 100,
    };

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("Error generating sales report:", error);
    return handleAuthError(error);
  }
}
