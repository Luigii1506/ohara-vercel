import ProxiesBuilder from "@/components/proxies/ProxiesBuilder";
import { fetchCardsPageFromDb } from "@/lib/cards/query";
import type { CardsPage, CardsFilters } from "@/lib/cards/types";
import { headers } from "next/headers";

// Carga inicial diferenciada: 60 en desktop, 40 en mobile
const INITIAL_LIMIT_DESKTOP = 60;
const INITIAL_LIMIT_MOBILE = 40;

export default async function ProxiesPage() {
  // Filtros iniciales: sin exclusión de DON (solo se excluyen al aplicar sort)
  const initialFilters: CardsFilters = {};

  // Detectar dispositivo móvil desde headers
  const headersList = headers();
  const userAgent = headersList.get("user-agent") || "";
  const isMobile = /Mobile|Android|iPhone/i.test(userAgent);

  const initialLimit = isMobile ? INITIAL_LIMIT_MOBILE : INITIAL_LIMIT_DESKTOP;

  // Fetch inicial desde el servidor
  const initialData: CardsPage = await fetchCardsPageFromDb({
    filters: initialFilters,
    includeRelations: true,
    includeAlternates: true,
    includeCounts: true,
    limit: initialLimit,
  });

  return (
    <ProxiesBuilder
      initialData={initialData}
      initialFilters={initialFilters}
    />
  );
}
