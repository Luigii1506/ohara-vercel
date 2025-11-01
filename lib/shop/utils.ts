// Utilidades para la gestión de productos y tienda - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { CardCondition } from "./types";

// Convertir precio de dólares a centavos para evitar problemas de redondeo
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

// Convertir precio de centavos a dólares
export function centsToDollars(cents: number): number {
  return cents / 100;
}

// Alias para centsToDollars (para compatibilidad)
export function centsToUSD(cents: number): number {
  return centsToDollars(cents);
}

// Formatear precio para mostrar en UI
export function formatPrice(cents: number, currency: string = "USD"): string {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(dollars);
}

// Validar datos de producto
export function validateProduct(data: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (
    !data.name ||
    typeof data.name !== "string" ||
    data.name.trim().length < 2
  ) {
    errors.push("El nombre del producto debe tener al menos 2 caracteres");
  }

  if (!data.price || typeof data.price !== "number" || data.price <= 0) {
    errors.push("El precio debe ser un número mayor a 0");
  }

  if (!data.stock || typeof data.stock !== "number" || data.stock < 0) {
    errors.push("El stock debe ser un número mayor o igual a 0");
  }

  if (data.sku && typeof data.sku !== "string") {
    errors.push("El SKU debe ser un texto válido");
  }

  if (
    data.lowStockThreshold &&
    (typeof data.lowStockThreshold !== "number" || data.lowStockThreshold < 0)
  ) {
    errors.push("El umbral de bajo stock debe ser un número mayor o igual a 0");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Validar datos de listado de carta
export function validateCardListing(data: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.cardId || typeof data.cardId !== "number" || data.cardId <= 0) {
    errors.push("ID de carta inválido");
  }

  if (!data.price || typeof data.price !== "number" || data.price <= 0) {
    errors.push("El precio debe ser un número mayor a 0");
  }

  if (!data.stock || typeof data.stock !== "number" || data.stock < 0) {
    errors.push("El stock debe ser un número mayor o igual a 0");
  }

  if (
    !data.conditionForSale ||
    !Object.values(CardCondition).includes(data.conditionForSale)
  ) {
    errors.push("La condición de la carta es inválida");
  }

  if (data.sku && typeof data.sku !== "string") {
    errors.push("El SKU debe ser un texto válido");
  }

  if (
    data.lowStockThreshold &&
    (typeof data.lowStockThreshold !== "number" || data.lowStockThreshold < 0)
  ) {
    errors.push("El umbral de bajo stock debe ser un número mayor o igual a 0");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Generar SKU automático
export function generateSKU(
  prefix: string = "OHARA",
  type: "card" | "product" = "card"
): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const typeCode = type === "card" ? "C" : "P";
  return `${prefix}-${typeCode}-${timestamp}-${random}`;
}

// Verificar si un producto tiene bajo stock
export function hasLowStock(stock: number, threshold: number = 5): boolean {
  return stock <= threshold;
}

// Calcular descuento porcentual
export function calculateDiscountPercentage(
  originalPrice: number,
  discountedPrice: number
): number {
  if (originalPrice <= 0 || discountedPrice < 0) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}

// Limpiar y normalizar nombre de producto
export function normalizeProductName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ") // Reemplazar múltiples espacios con uno solo
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Validar que el usuario sea vendedor o admin
export function canManageProducts(userRole: string): boolean {
  return ["ADMIN", "SELLER"].includes(userRole.toUpperCase());
}

// Obtener estado de stock para UI
export function getStockStatus(
  stock: number,
  threshold: number = 5
): {
  status: "out_of_stock" | "low_stock" | "in_stock";
  label: string;
  color: string;
} {
  if (stock === 0) {
    return {
      status: "out_of_stock",
      label: "Sin stock",
      color: "red",
    };
  }

  if (stock <= threshold) {
    return {
      status: "low_stock",
      label: "Stock bajo",
      color: "orange",
    };
  }

  return {
    status: "in_stock",
    label: "En stock",
    color: "green",
  };
}

// Sanitizar texto para prevenir XSS
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, "") // Remover caracteres HTML básicos
    .trim();
}

// Validar formato de email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Generar slug para URL amigable
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remover caracteres especiales
    .replace(/[\s_-]+/g, "-") // Reemplazar espacios y guiones con un solo guión
    .replace(/^-+|-+$/g, ""); // Remover guiones del inicio y final
}

// Calcular valor total del inventario
export function calculateInventoryValue(
  items: Array<{ price: number; stock: number }>
): number {
  return items.reduce((total, item) => total + item.price * item.stock, 0);
}

// Filtrar productos basado en criterios de búsqueda
export function filterProducts<
  T extends { name: string; price: number; stock: number }
>(
  products: T[],
  filters: {
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    lowStock?: boolean;
    threshold?: number;
  }
): T[] {
  return products.filter((product) => {
    // Filtro de búsqueda por nombre
    if (
      filters.search &&
      !product.name.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }

    // Filtro de precio mínimo
    if (filters.minPrice !== undefined && product.price < filters.minPrice) {
      return false;
    }

    // Filtro de precio máximo
    if (filters.maxPrice !== undefined && product.price > filters.maxPrice) {
      return false;
    }

    // Filtro de productos en stock
    if (filters.inStock && product.stock === 0) {
      return false;
    }

    // Filtro de productos con bajo stock
    if (filters.lowStock && !hasLowStock(product.stock, filters.threshold)) {
      return false;
    }

    return true;
  });
}

// Ordenar productos
export function sortProducts<T extends Record<string, any>>(
  products: T[],
  sortBy: string,
  sortOrder: "asc" | "desc" = "asc"
): T[] {
  return [...products].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];

    if (aValue === bValue) return 0;

    const comparison = aValue > bValue ? 1 : -1;
    return sortOrder === "asc" ? comparison : -comparison;
  });
}

// Paginar resultados
export function paginateResults<T>(
  items: T[],
  page: number = 1,
  limit: number = 20
): {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
} {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const data = items.slice(startIndex, endIndex);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}
