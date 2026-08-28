export const LIST_PURPOSES = [
  "GENERAL",
  "PERSONAL_COLLECTION",
  "INVENTORY",
  "WISHLIST",
] as const;

export type ListPurpose = (typeof LIST_PURPOSES)[number];

export const DEFAULT_LIST_PURPOSE: ListPurpose = "GENERAL";

export const USER_CREATABLE_LIST_PURPOSES: ListPurpose[] = [
  "GENERAL",
  "INVENTORY",
  "WISHLIST",
];

export const LIST_PURPOSE_LABELS: Record<ListPurpose, string> = {
  GENERAL: "General",
  PERSONAL_COLLECTION: "Colección",
  INVENTORY: "Inventario",
  WISHLIST: "Wishlist",
};

export const LIST_PURPOSE_DESCRIPTIONS: Record<ListPurpose, string> = {
  GENERAL: "Listas flexibles para ideas, binders o proyectos generales.",
  PERSONAL_COLLECTION:
    "Colección personal principal del usuario. Se gestiona aparte.",
  INVENTORY:
    "Inventario comercial para cartas disponibles, precios y seguimiento.",
  WISHLIST: "Cartas o sets que quieres conseguir o completar después.",
};

export function isListPurpose(value: unknown): value is ListPurpose {
  return typeof value === "string" && LIST_PURPOSES.includes(value as ListPurpose);
}

export function normalizeListPurpose(value: unknown): ListPurpose {
  if (isListPurpose(value)) return value;
  return DEFAULT_LIST_PURPOSE;
}

export function getListPurposeLabel(value: unknown) {
  return LIST_PURPOSE_LABELS[normalizeListPurpose(value)];
}

export function getListPurposeDescription(value: unknown) {
  return LIST_PURPOSE_DESCRIPTIONS[normalizeListPurpose(value)];
}

export function isCommercialListPurpose(value: unknown) {
  return normalizeListPurpose(value) === "INVENTORY";
}
