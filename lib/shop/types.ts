// Tipos para la gestión de productos y tienda - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

// Enum para estados de pedido (matching Prisma schema)
export enum OrderStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELED = "CANCELED",
  REFUNDED = "REFUNDED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
}

// Enum para condiciones de cartas
export enum CardCondition {
  NEAR_MINT = "Near Mint",
  LIGHT_PLAY = "Light Play",
  MODERATELY_PLAYED = "Moderately Played",
  HEAVILY_PLAYED = "Heavily Played",
  DAMAGED = "Damaged",
}

// Tipo para productos (no cartas)
export interface Product {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  price: number; // En centavos para evitar problemas de redondeo
  stock: number;
  sku?: string;
  imageUrl?: string;
  categoryId?: number;
  sellerId: number;

  // Estados del producto
  isActive: boolean;
  isDraft: boolean;
  isFeatured: boolean;
  lowStockThreshold?: number;

  createdAt: Date;
  updatedAt: Date;

  // Relaciones expandidas (opcionales)
  seller?: {
    id: number;
    name: string;
    email: string;
  };
}

// Tipo para listados de cartas (modelo separado de Card)
export interface CardListing {
  id: number;
  uuid: string;

  // Información de la carta original
  cardId: number;
  card?: {
    id: number;
    uuid: string;
    name: string;
    code: string;
    setCode: string;
    rarity?: string;
    src: string;
    category: string;
    cost?: string;
    power?: string;
    life?: string;
  };

  // Información del vendedor
  sellerId: number;
  seller?: {
    id: number;
    name: string;
    email: string;
    sellerProfile?: {
      storeName?: string;
      rating?: number;
    };
  };

  // Información de venta
  price: number; // En centavos
  stock: number;
  conditionForSale: string;
  sku?: string;

  // Estados del listado
  isActive: boolean;
  isDraft: boolean;
  isFeatured: boolean;
  lowStockThreshold: number;

  // Metadata
  listingDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// DTO para crear listado de carta
export interface CreateCardListingDto {
  cardId: number;
  price: number; // En centavos
  stock: number;
  conditionForSale: CardCondition;
  sku?: string;
  isFeatured?: boolean;
  lowStockThreshold?: number;
}

// DTO para actualizar listado de carta
export interface UpdateCardListingDto {
  price?: number;
  stock?: number;
  conditionForSale?: CardCondition;
  sku?: string;
  isFeatured?: boolean;
  isActive?: boolean;
  isDraft?: boolean;
  lowStockThreshold?: number;
}

// DTO para crear producto (no carta)
export interface CreateProductDto {
  name: string;
  description?: string;
  price: number; // En centavos
  stock: number;
  sku?: string;
  imageUrl?: string;
  categoryId?: number;
  isFeatured?: boolean;
  lowStockThreshold?: number;
}

// DTO para actualizar producto
export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  sku?: string;
  imageUrl?: string;
  categoryId?: number;
  isActive?: boolean;
  isDraft?: boolean;
  isFeatured?: boolean;
  lowStockThreshold?: number;
}

// Tipo para respuestas de API paginadas
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Tipo para filtros de búsqueda de productos
export interface ProductFilters {
  search?: string;
  sellerId?: number;
  isActive?: boolean;
  isDraft?: boolean;
  isFeatured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  lowStock?: boolean;
  category?: string;
  sortBy?: "name" | "price" | "stock" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

// Tipo para alertas de bajo stock
export interface LowStockAlert {
  id: number;
  type: "cardListing" | "product";
  name: string;
  currentStock: number;
  threshold: number;
  sellerId: number;
  sellerName: string;
  cardInfo?: {
    code: string;
    setCode: string;
    rarity?: string;
  };
}

// Tipo para estadísticas del vendedor
export interface SellerStats {
  totalListings: number;
  activeListings: number;
  lowStockItems: number;
  totalValue: number; // Valor total del inventario
  averagePrice: number;
  topPerformingItems: Array<{
    id: number;
    name: string;
    type: "card" | "product";
    sales: number;
    revenue: number;
  }>;
}

// Tipo para respuestas de error de API
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Tipo para respuestas exitosas de API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: any;
}
