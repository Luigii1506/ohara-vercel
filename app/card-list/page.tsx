import CardListClient from "./CardListClient";
import {
  buildFiltersFromSearchParams,
  fetchCardsPageFromDb,
} from "@/lib/cards/query";
import type { CardsFilters, CardsPage } from "@/lib/cards/types";
import { mergeFiltersWithSetCode } from "@/lib/cards/types";

const DEFAULT_LIMIT = 150;

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

  const initialData: CardsPage = await fetchCardsPageFromDb({
    filters: initialFilters,
    limit: DEFAULT_LIMIT,
    cursor: null,
    includeRelations: true,
    includeAlternates: true,
    includeCounts: true,
  });

  return (
    <CardListClient initialData={initialData} initialFilters={initialFilters} />
  );
}
