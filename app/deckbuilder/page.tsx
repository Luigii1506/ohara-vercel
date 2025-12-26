import DeckBuilder from "@/components/deckbuilder/Home";
import { fetchCardsPageFromDb } from "@/lib/cards/query";
import type { CardsPage } from "@/lib/cards/types";
import { headers } from "next/headers";

// Carga inicial: solo Leaders para la selección inicial
const INITIAL_LIMIT_DESKTOP = 60;
const INITIAL_LIMIT_MOBILE = 40;

export default async function DeckBuilderPage() {
  // Detectar dispositivo móvil desde headers
  const headersList = headers();
  const userAgent = headersList.get("user-agent") || "";
  const isMobile = /Mobile|Android|iPhone/i.test(userAgent);

  const initialLimit = isMobile ? INITIAL_LIMIT_MOBILE : INITIAL_LIMIT_DESKTOP;

  // Cargar solo Leaders inicialmente (para la primera selección)
  const initialData: CardsPage = await fetchCardsPageFromDb({
    filters: { categories: ["Leader"] },
    includeRelations: true,
    includeAlternates: true,
    includeCounts: true,
    limit: initialLimit,
  });

  return <DeckBuilder initialData={initialData} />;
}
