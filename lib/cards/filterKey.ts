import type { CardsFilters } from "./types";

export const serializeFiltersForKey = (filters: CardsFilters) => {
  const sortedEntries: Record<string, unknown> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => item.trim())
        .filter(Boolean)
        .sort();
      if (normalized.length) {
        sortedEntries[key] = normalized;
      }
    } else if (value !== undefined && value !== "") {
      sortedEntries[key] = value;
    }
  });

  return JSON.stringify(sortedEntries);
};
