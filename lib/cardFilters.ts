import { CardWithCollectionData } from "@/types";

export const matchesCardCode = (code: string, search: string): boolean => {
  const query = search.toLowerCase().trim();
  const fullCode = code.toLowerCase();

  // Tratamiento especial: el filtro "P-000" representa todos los códigos promocionales
  if (query === "p-000") {
    return /^p-\d+$/i.test(code);
  }

  if (query.includes("-")) {
    return fullCode.includes(query);
  }

  const parts = code.split("-");

  if (/^\d+$/.test(query)) {
    if (query[0] === "0") {
      return parts.some((part) => {
        const matchDigits = part.match(/\d+/);
        return matchDigits ? matchDigits[0] === query : false;
      });
    } else {
      const queryNumber = parseInt(query, 10);
      return parts.some((part) => {
        const matchDigits = part.match(/\d+/);
        return matchDigits ? parseInt(matchDigits[0], 10) === queryNumber : false;
      });
    }
  }

  return parts.some((part) => part.toLowerCase().includes(query));
};

export const baseCardMatches = (
  card: CardWithCollectionData | undefined,
  selectedSets: string[] = [],
  selectedAltArts: string[] = []
): boolean => {
  if (!card) return false;

  if (selectedSets?.length) {
    const normalizedSets = selectedSets.map((value) => value.toLowerCase());
    // Dividir setCode por comas y verificar si alguno coincide
    const baseSetCodes = (card.setCode ?? "")
      .split(",")
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean);
    if (!baseSetCodes.some((code) => normalizedSets.includes(code))) {
      return false;
    }
  }

  if (selectedAltArts?.length) {
    return selectedAltArts.includes(card.alternateArt ?? "");
  }

  return true;
};

export const getFilteredAlternates = (
  card: CardWithCollectionData | undefined,
  selectedSets: string[] = [],
  selectedAltArts: string[] = []
): CardWithCollectionData[] => {
  if (!card?.alternates) return [];
  return card.alternates.filter((alt) => {
    if (selectedSets?.length) {
      const normalizedSets = selectedSets.map((value) => value.toLowerCase());
      // Dividir setCode por comas y verificar si alguno coincide
      const altSetCodes = (alt.setCode ?? "")
        .split(",")
        .map((code) => code.trim().toLowerCase())
        .filter(Boolean);
      if (!altSetCodes.some((code) => normalizedSets.includes(code))) {
        return false;
      }
    }

    if (selectedAltArts?.length) {
      return selectedAltArts.includes(alt.alternateArt ?? "");
    }

    return true;
  });
};
