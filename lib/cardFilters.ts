import { CardWithCollectionData } from "@/types";

export const matchesCardCode = (code: string, search: string): boolean => {
  const query = search.toLowerCase().trim();
  const fullCode = code.toLowerCase();

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
  selectedSets: string[],
  selectedAltArts: string[]
): boolean => {
  if (!card) return false;
  let matches = true;

  if (selectedSets.length > 0) {
    matches = card.sets?.some((s) => selectedSets.includes(s.set.title)) || false;
  }
  if (selectedAltArts.length > 0) {
    matches = matches && selectedAltArts.includes(card?.rarity ?? "");
  }
  return matches;
};

export const getFilteredAlternates = (
  card: CardWithCollectionData | undefined,
  selectedSets: string[],
  selectedAltArts: string[]
): CardWithCollectionData[] => {
  if (!card?.alternates) return [];
  return card.alternates.filter((alt) => {
    let matches = true;
    if (selectedSets.length > 0) {
      matches = alt.sets?.some((s) => selectedSets.includes(s.set.title)) || false;
    }
    if (selectedAltArts.length > 0) {
      matches = matches && selectedAltArts.includes(alt.alternateArt ?? "");
    }
    return matches;
  });
};
