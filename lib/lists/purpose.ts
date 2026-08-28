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
];

export const LIST_PURPOSE_LABELS: Record<ListPurpose, string> = {
  GENERAL: "General",
  PERSONAL_COLLECTION: "Colección",
  INVENTORY: "Venta",
  WISHLIST: "General",
};

export const LIST_PURPOSE_DESCRIPTIONS: Record<ListPurpose, string> = {
  GENERAL: "Listas flexibles para ideas, binders o proyectos generales.",
  PERSONAL_COLLECTION:
    "Colección personal principal del usuario. Se gestiona aparte.",
  INVENTORY:
    "Carpeta comercial para stock, precios, reportes y seguimiento de venta.",
  WISHLIST:
    "Compatibilidad heredada. Las carpetas wishlist ahora se manejan como General con cartas marcadas como faltantes.",
};

export function getCreatableListPurposesForRole(role?: string | null) {
  return role === "ADMIN"
    ? USER_CREATABLE_LIST_PURPOSES
    : USER_CREATABLE_LIST_PURPOSES.filter((purpose) => purpose !== "INVENTORY");
}

export function isListPurposeAllowedForRole(
  role: string | null | undefined,
  purpose: unknown
) {
  const normalizedPurpose = normalizeListPurpose(purpose);
  if (normalizedPurpose === "PERSONAL_COLLECTION") return false;
  return getCreatableListPurposesForRole(role).includes(normalizedPurpose);
}

export function isListPurpose(value: unknown): value is ListPurpose {
  return typeof value === "string" && LIST_PURPOSES.includes(value as ListPurpose);
}

export function normalizeListPurpose(value: unknown): ListPurpose {
  if (value === "WISHLIST") return "GENERAL";
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

export function supportsMissingStateForListPurpose(value: unknown) {
  return normalizeListPurpose(value) === "GENERAL";
}
