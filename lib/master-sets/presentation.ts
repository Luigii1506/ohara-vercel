import {
  getVariantCategoryLabel,
  type MasterSetVariantCategory,
} from "@/lib/master-sets/google-sheet";

export function getMasterSetRelationTypeLabel(value: string) {
  switch (value) {
    case "DEPICTED_IN_ART":
      return "Cameo en arte";
    case "THEME_OF_CARD":
      return "Tema de la carta";
    case "MENTIONED_IN_NAME":
      return "Mencionado en nombre";
    case "MENTIONED_IN_TEXT":
      return "Mencionado en texto";
    case "MENTIONED_IN_TRIGGER":
      return "Mencionado en trigger";
    default:
      return value;
  }
}

export function getMasterSetSourceLabel(value: string) {
  switch (value) {
    case "GOOGLE_SHEET":
      return "Google Sheet";
    case "MANUAL":
      return "Manual";
    case "AUTO":
      return "Auto";
    case "REVIEWED":
      return "Reviewed";
    default:
      return value;
  }
}

export function getMasterSetVariantLabel(category: MasterSetVariantCategory) {
  return getVariantCategoryLabel(category);
}
