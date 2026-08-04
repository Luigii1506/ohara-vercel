import * as cheerio from "cheerio";

const LIMITLESS_BASE_URL = "https://onepiece.limitlesstcg.com";

export type LimitlessPrintOption = {
  title: string;
  productId: number | null;
  tcgUrl: string | null;
  usdPrice: string | null;
  matchedProduct: boolean;
};

export type LimitlessCardComparison = {
  cardUrl: string;
  pageTitle: string | null;
  prints: LimitlessPrintOption[];
  matchedPrint: LimitlessPrintOption | null;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractTcgplayerUrl(partnerUrl?: string | null) {
  if (!partnerUrl) return null;

  try {
    const outer = new URL(partnerUrl, LIMITLESS_BASE_URL);
    const encoded = outer.searchParams.get("u");
    if (encoded) {
      return decodeURIComponent(encoded);
    }
    return outer.toString();
  } catch {
    return null;
  }
}

function extractTcgplayerProductId(url?: string | null) {
  if (!url) return null;
  const match = url.match(/\/product\/(\d+)(?:\/|$)/i);
  return match ? Number(match[1]) : null;
}

export async function fetchLimitlessCardComparison(
  code: string,
  productId?: number | null
): Promise<LimitlessCardComparison> {
  const normalizedCode = code.trim().toUpperCase();
  const cardUrl = `${LIMITLESS_BASE_URL}/cards/${encodeURIComponent(normalizedCode)}`;
  const response = await fetch(cardUrl);
  if (!response.ok) {
    throw new Error(`Limitless HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const pageTitle = normalizeWhitespace($("title").first().text()) || null;
  const prints: LimitlessPrintOption[] = [];
  const seen = new Set<string>();

  $("a.card-price.usd").each((_, element) => {
    const priceLink = $(element);
    const row = priceLink.closest("tr");
    const cells = row.find("td");
    if (cells.length < 2) return;
    const titleCell = $(cells[0]);
    const titleAnchor = titleCell.find("a").first();
    const titleClone = titleAnchor.clone();
    titleClone.find(".prints-table-card-number").remove();
    const title = normalizeWhitespace(titleClone.text());
    const usdPrice = normalizeWhitespace($(cells[1]).text()) || null;
    const tcgUrl = extractTcgplayerUrl(priceLink.attr("href"));
    const resolvedProductId = extractTcgplayerProductId(tcgUrl);
    const key = `${title}::${resolvedProductId ?? "none"}`;
    if (!title || seen.has(key)) return;
    seen.add(key);

    prints.push({
      title,
      productId: resolvedProductId,
      tcgUrl,
      usdPrice,
      matchedProduct:
        Number.isFinite(Number(productId)) &&
        resolvedProductId === Number(productId),
    });
  });

  const matchedPrint =
    prints.find((print) => print.matchedProduct) ?? null;

  return {
    cardUrl,
    pageTitle,
    prints,
    matchedPrint,
  };
}
