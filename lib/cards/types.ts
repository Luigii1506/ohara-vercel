import { CardWithCollectionData } from "@/types";

export type CardsFilters = {
  search?: string;
  sets?: string[];
  setCodes?: string[];
  colors?: string[];
  rarities?: string[];
  categories?: string[];
  costs?: string[];
  power?: string[];
  attributes?: string[];
  types?: string[];
  effects?: string[];
  altArts?: string[];
  region?: string;
  counter?: string;
  trigger?: string;
  sortBy?: "price_high" | "price_low";
};

export type CardsPage = {
  items: CardWithCollectionData[];
  nextCursor: number | null;
  hasMore: boolean;
  totalCount: number;
};

export const mergeFiltersWithSetCode = (
  filters: CardsFilters,
  setCode: string | null
): CardsFilters => {
  if (!setCode) return filters;

  const sets = new Set(filters.sets ?? []);
  sets.add(setCode);

  return {
    ...filters,
    sets: Array.from(sets),
  };
};

export type FetchCardsPageOptions = {
  filters: CardsFilters;
  limit: number;
  cursor?: number | null;
  includeRelations?: boolean;
  includeAlternates?: boolean;
  includeCounts?: boolean;
};

export type FetchAllCardsOptions = {
  filters: CardsFilters;
  includeRelations?: boolean;
  includeAlternates?: boolean;
  includeCounts?: boolean;
  limit?: number | null;
};
