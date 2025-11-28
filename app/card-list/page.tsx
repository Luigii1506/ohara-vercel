import CardListClient from "./CardListClient";
import {
  buildFiltersFromSearchParams,
  fetchAllCardsFromDb,
} from "@/lib/cards/query";
import type { CardsFilters, CardsPage } from "@/lib/cards/types";
import { mergeFiltersWithSetCode } from "@/lib/cards/types";

const DEFAULT_LIMIT = 200;

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

const toURLSearchParams = (
  params: Record<string, string | string[] | undefined>
) => {
  const searchParams = new URLSearchParams();

  for (const key in params) {
    if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
    const value = params[key];
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined) {
          searchParams.append(key, entry);
        }
      });
    } else if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  return searchParams;
};

export default async function CardListPage({ searchParams }: PageProps) {
  const params = toURLSearchParams(searchParams);
  const setCode = params.get("setCode");

  const initialFilters = mergeFiltersWithSetCode(
    buildFiltersFromSearchParams(params),
    setCode
  );

  const allCards = await fetchAllCardsFromDb({
    filters: initialFilters,
    includeRelations: true,
    includeAlternates: true,
    includeCounts: true,
  });

  const initialItems = allCards.slice(0, DEFAULT_LIMIT);
  const nextCursor =
    allCards.length > DEFAULT_LIMIT
      ? (() => {
          const lastItem = initialItems[initialItems.length - 1];
          if (!lastItem?.id && lastItem?.isFirstEdition && lastItem?.code) {
            return null;
          }
          const idValue = lastItem?.id;
          if (typeof idValue === "number") return idValue;
          if (typeof idValue === "string" && !Number.isNaN(Number(idValue))) {
            return Number(idValue);
          }
          return null;
        })()
      : null;

  const initialData: CardsPage = {
    items: initialItems,
    nextCursor,
    hasMore: allCards.length > DEFAULT_LIMIT,
  };

  return (
    <CardListClient initialData={initialData} initialFilters={initialFilters} />
  );
}
