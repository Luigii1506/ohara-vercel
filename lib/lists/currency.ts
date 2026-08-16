export interface ListCurrencySettings {
  displayCurrency?: string | null;
  exchangeRate?: number | string | null;
}

/**
 * Convierte un precio en USD a la moneda de despliegue elegida para la
 * carpeta (ej. USD -> MXN con un tipo de cambio fijo que el dueño puso al
 * crear/editar la carpeta). Si la carpeta está en USD, o no tiene un tipo de
 * cambio válido, devuelve el valor tal cual. Redondea a máximo 2 decimales.
 */
export function convertForListDisplay(
  usdValue: number,
  list: ListCurrencySettings | null | undefined
): { value: number; currency: string } {
  const currency = list?.displayCurrency || "USD";
  if (currency === "USD") {
    return { value: usdValue, currency: "USD" };
  }

  const rate = Number(list?.exchangeRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { value: usdValue, currency: "USD" };
  }

  return {
    value: Math.round(usdValue * rate * 100) / 100,
    currency,
  };
}
