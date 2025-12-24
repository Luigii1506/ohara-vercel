import CardListClient from "./CardListClient";
import {
  buildFiltersFromSearchParams,
  fetchCardsPageFromDb,
} from "@/lib/cards/query";
import type { CardsPage } from "@/lib/cards/types";
import { mergeFiltersWithSetCode } from "@/lib/cards/types";
import { headers } from "next/headers";

// Carga inicial diferenciada: 60 en desktop, 40 en mobile
const INITIAL_LIMIT_DESKTOP = 60;
const INITIAL_LIMIT_MOBILE = 40;

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

  // Detectar dispositivo móvil desde headers
  const headersList = headers();
  const userAgent = headersList.get("user-agent") || "";
  const isMobile = /Mobile|Android|iPhone/i.test(userAgent);

  const initialLimit = isMobile ? INITIAL_LIMIT_MOBILE : INITIAL_LIMIT_DESKTOP;

  const initialData: CardsPage = await fetchCardsPageFromDb({
    filters: initialFilters,
    includeRelations: true,
    includeAlternates: true,
    includeCounts: true,
    limit: initialLimit,
  });

  return (
    <CardListClient initialData={initialData} initialFilters={initialFilters} />
  );
}
