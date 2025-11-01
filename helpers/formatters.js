export const rarityFormatter = (rarity) => {
  switch (rarity) {
    case "Common":
      return "C";
    case "Uncommon":
      return "UC";
    case "Rare":
      return "R";
    case "Secret Rare":
      return "SEC";
    case "Special Card":
      return "SP";
    case "Super Rare":
      return "SR";
    case "Leader":
      return "L";
    case "Promo":
      return "P";
    default:
      return "";
  }
};
