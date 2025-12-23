// Servicios para la gestión de productos e inventario - Ohara TCG Shop
// Fecha de modificación: 2025-01-19 - REFACTORIZADO para usar CardListing separado

import { prisma } from "@/lib/prisma";
import {
  CardListing,
  Product,
  CreateCardListingDto,
  UpdateCardListingDto,
  CreateProductDto,
  UpdateProductDto,
  ProductFilters,
  PaginatedResponse,
  LowStockAlert,
  SellerStats,
} from "./types";
import {
  validateProduct,
  validateCardListing,
  generateSKU,
  hasLowStock,
  filterProducts,
  sortProducts,
  paginateResults,
} from "./utils";

// Inicializar Prisma Client
/**
 * ===== SERVICIOS PARA LISTADOS DE CARTAS =====
 */

// Crear un listado de carta para venta
export async function createCardListing(
  sellerId: number,
  data: CreateCardListingDto
): Promise<{ success: boolean; data?: CardListing; error?: string }> {
  try {
    // Validar datos de entrada
    const validation = validateCardListing(data);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(", "),
      };
    }

    // Verificar que la carta existe
    const cardExists = await prisma.card.findUnique({
      where: { id: data.cardId },
    });

    if (!cardExists) {
      return {
        success: false,
        error: "La carta especificada no existe",
      };
    }

    // Verificar que el usuario puede vender (es SELLER o ADMIN)
    const user = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { role: true },
    });

    if (!user || !["SELLER", "ADMIN"].includes(user.role)) {
      return {
        success: false,
        error: "No tienes permisos para crear listados de venta",
      };
    }

    // Generar SKU si no se proporciona
    const sku = data.sku || generateSKU("OHARA", "card");

    // Crear el listado
    const listing = await prisma.cardListing.create({
      data: {
        cardId: data.cardId,
        sellerId: sellerId,
        price: data.price,
        stock: data.stock,
        conditionForSale: data.conditionForSale,
        sku: sku,
        isFeatured: data.isFeatured || false,
        lowStockThreshold: data.lowStockThreshold || 5,
        isActive: true,
        isDraft: false,
      },
      include: {
        card: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        id: listing.id,
        uuid: listing.uuid,
        cardId: listing.cardId,
        card: {
          id: listing.card.id,
          uuid: listing.card.uuid,
          name: listing.card.name,
          code: listing.card.code,
          setCode: listing.card.setCode,
          rarity: listing.card.rarity || undefined,
          src: listing.card.src,
          category: listing.card.category,
          cost: listing.card.cost || undefined,
          power: listing.card.power || undefined,
          life: listing.card.life || undefined,
        },
        sellerId: listing.sellerId,
        seller: listing.seller
          ? {
              id: listing.seller.id,
              name: listing.seller.name,
              email: listing.seller.email,
            }
          : undefined,
        price: listing.price.toNumber(),
        stock: listing.stock,
        conditionForSale: listing.conditionForSale,
        sku: listing.sku || undefined,
        isActive: listing.isActive,
        isDraft: listing.isDraft,
        isFeatured: listing.isFeatured,
        lowStockThreshold: listing.lowStockThreshold,
        listingDate: listing.listingDate,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
      },
    };
  } catch (error) {
    console.error("Error creando listado de carta:", error);
    return {
      success: false,
      error: "Error interno del servidor",
    };
  }
}

// Obtener listados de carta del vendedor
export async function getSellerCardListings(
  sellerId: number,
  filters: ProductFilters = {}
): Promise<{
  success: boolean;
  data?: PaginatedResponse<CardListing>;
  error?: string;
}> {
  try {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Construir condiciones de filtro
    const where: any = {
      sellerId: sellerId,
    };

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.isDraft !== undefined) {
      where.isDraft = filters.isDraft;
    }

    if (filters.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
    }

    if (filters.search) {
      where.OR = [
        { card: { name: { contains: filters.search } } },
        { card: { code: { contains: filters.search } } },
        { sku: { contains: filters.search } },
      ];
    }

    if (filters.inStock) {
      where.stock = { gt: 0 };
    }

    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }

    // Construir ordenamiento
    let orderBy: any = {};
    if (filters.sortBy && filters.sortOrder) {
      if (filters.sortBy === "name") {
        orderBy = { card: { name: filters.sortOrder } };
      } else {
        orderBy[filters.sortBy] = filters.sortOrder;
      }
    } else {
      orderBy = { listingDate: "desc" };
    }

    // Obtener total de registros
    const total = await prisma.cardListing.count({ where });

    // Obtener registros paginados
    const listings = await prisma.cardListing.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        card: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(total / limit);

    const cardListings: CardListing[] = listings.map((listing) => ({
      id: listing.id,
      uuid: listing.uuid,
      cardId: listing.cardId,
      card: {
        id: listing.card.id,
        uuid: listing.card.uuid,
        name: listing.card.name,
        code: listing.card.code,
        setCode: listing.card.setCode,
        rarity: listing.card.rarity || undefined,
        src: listing.card.src,
        category: listing.card.category,
        cost: listing.card.cost || undefined,
        power: listing.card.power || undefined,
        life: listing.card.life || undefined,
      },
      sellerId: listing.sellerId,
      seller: listing.seller
        ? {
            id: listing.seller.id,
            name: listing.seller.name,
            email: listing.seller.email,
          }
        : undefined,
      price: listing.price.toNumber(),
      stock: listing.stock,
      conditionForSale: listing.conditionForSale,
      sku: listing.sku || undefined,
      isActive: listing.isActive,
      isDraft: listing.isDraft,
      isFeatured: listing.isFeatured,
      lowStockThreshold: listing.lowStockThreshold,
      listingDate: listing.listingDate,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    }));

    return {
      success: true,
      data: {
        data: cardListings,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      },
    };
  } catch (error) {
    console.error("Error obteniendo listados de carta:", error);
    return {
      success: false,
      error: "Error interno del servidor",
    };
  }
}

// Actualizar listado de carta
export async function updateCardListing(
  listingId: number,
  sellerId: number,
  data: UpdateCardListingDto
): Promise<{ success: boolean; data?: CardListing; error?: string }> {
  try {
    // Verificar que el listado pertenece al vendedor
    const existingListing = await prisma.cardListing.findFirst({
      where: {
        id: listingId,
        sellerId: sellerId,
      },
    });

    if (!existingListing) {
      return {
        success: false,
        error: "Listado no encontrado o no tienes permisos para modificarlo",
      };
    }

    // Actualizar listado
    const updatedListing = await prisma.cardListing.update({
      where: { id: listingId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        card: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        id: updatedListing.id,
        uuid: updatedListing.uuid,
        cardId: updatedListing.cardId,
        card: {
          id: updatedListing.card.id,
          uuid: updatedListing.card.uuid,
          name: updatedListing.card.name,
          code: updatedListing.card.code,
          setCode: updatedListing.card.setCode,
          rarity: updatedListing.card.rarity || undefined,
          src: updatedListing.card.src,
          category: updatedListing.card.category,
          cost: updatedListing.card.cost || undefined,
          power: updatedListing.card.power || undefined,
          life: updatedListing.card.life || undefined,
        },
        sellerId: updatedListing.sellerId,
        seller: updatedListing.seller
          ? {
              id: updatedListing.seller.id,
              name: updatedListing.seller.name,
              email: updatedListing.seller.email,
            }
          : undefined,
        price: updatedListing.price.toNumber(),
        stock: updatedListing.stock,
        conditionForSale: updatedListing.conditionForSale,
        sku: updatedListing.sku || undefined,
        isActive: updatedListing.isActive,
        isDraft: updatedListing.isDraft,
        isFeatured: updatedListing.isFeatured,
        lowStockThreshold: updatedListing.lowStockThreshold,
        listingDate: updatedListing.listingDate,
        createdAt: updatedListing.createdAt,
        updatedAt: updatedListing.updatedAt,
      },
    };
  } catch (error) {
    console.error("Error actualizando listado de carta:", error);
    return {
      success: false,
      error: "Error interno del servidor",
    };
  }
}

/**
 * ===== SERVICIOS PARA PRODUCTOS (NO CARTAS) =====
 */

// Crear producto (mantenido igual)
export async function createProduct(
  sellerId: number,
  data: CreateProductDto
): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    // Validar datos
    const validation = validateProduct(data);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(", "),
      };
    }

    // Verificar permisos
    const user = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { role: true },
    });

    if (!user || !["SELLER", "ADMIN"].includes(user.role)) {
      return {
        success: false,
        error: "No tienes permisos para crear productos",
      };
    }

    // Generar SKU si no se proporciona
    const sku = data.sku || generateSKU("OHARA", "product");

    // Crear producto
    const product = await prisma.product.create({
      data: {
        ...data,
        sellerId,
        sku,
        lowStockThreshold: data.lowStockThreshold || 5,
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        id: product.id,
        uuid: product.uuid,
        name: product.name,
        description: product.description || undefined,
        price: product.price.toNumber(),
        stock: product.stock,
        sku: product.sku || undefined,
        imageUrl: product.imageUrl || undefined,
        categoryId: product.categoryId || undefined,
        sellerId: product.sellerId,
        isActive: product.isActive,
        isDraft: product.isDraft,
        isFeatured: product.isFeatured,
        lowStockThreshold: product.lowStockThreshold || undefined,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        seller: product.seller,
      },
    };
  } catch (error) {
    console.error("Error creando producto:", error);
    return {
      success: false,
      error: "Error interno del servidor",
    };
  }
}

/**
 * ===== SERVICIOS DE ALERTAS Y ESTADÍSTICAS =====
 */

// Obtener alertas de bajo stock
export async function getLowStockAlerts(
  sellerId: number
): Promise<{ success: boolean; data?: LowStockAlert[]; error?: string }> {
  try {
    // Listados de cartas con bajo stock
    const lowStockListings = await prisma.cardListing.findMany({
      where: {
        sellerId: sellerId,
        isActive: true,
        stock: {
          lte: prisma.cardListing.fields.lowStockThreshold,
        },
      },
      include: {
        card: {
          select: {
            name: true,
            code: true,
            setCode: true,
            rarity: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Productos con bajo stock
    const lowStockProducts = await prisma.product.findMany({
      where: {
        sellerId: sellerId,
        isActive: true,
        stock: {
          lte: prisma.product.fields.lowStockThreshold,
        },
      },
      select: {
        id: true,
        name: true,
        stock: true,
        lowStockThreshold: true,
        seller: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const alerts: LowStockAlert[] = [
      ...lowStockListings.map((listing) => ({
        id: listing.id,
        type: "cardListing" as const,
        name: listing.card.name,
        currentStock: listing.stock,
        threshold: listing.lowStockThreshold,
        sellerId: listing.seller.id,
        sellerName: listing.seller.name,
        cardInfo: {
          code: listing.card.code,
          setCode: listing.card.setCode,
          rarity: listing.card.rarity || undefined,
        },
      })),
      ...lowStockProducts.map((product) => ({
        id: product.id,
        type: "product" as const,
        name: product.name,
        currentStock: product.stock,
        threshold: product.lowStockThreshold || 5,
        sellerId: product.seller.id,
        sellerName: product.seller.name,
      })),
    ];

    return {
      success: true,
      data: alerts,
    };
  } catch (error) {
    console.error("Error obteniendo alertas de stock:", error);
    return {
      success: false,
      error: "Error interno del servidor",
    };
  }
}

// Obtener estadísticas del vendedor
export async function getSellerStats(
  sellerId: number
): Promise<{ success: boolean; data?: SellerStats; error?: string }> {
  try {
    // Contar listados activos de cartas
    const activeCardListings = await prisma.cardListing.count({
      where: {
        sellerId: sellerId,
        isActive: true,
      },
    });

    // Contar productos activos
    const activeProducts = await prisma.product.count({
      where: {
        sellerId: sellerId,
        isActive: true,
      },
    });

    // Total de listados activos
    const totalListings = activeCardListings + activeProducts;
    const activeListings = totalListings; // Ya filtrado por activos

    // Obtener alertas de bajo stock
    const lowStockAlertsResult = await getLowStockAlerts(sellerId);
    const lowStockItems = lowStockAlertsResult.data?.length || 0;

    // Calcular valor total del inventario
    const listingValues = await prisma.cardListing.findMany({
      where: {
        sellerId: sellerId,
        isActive: true,
      },
      select: {
        price: true,
        stock: true,
      },
    });

    const productValues = await prisma.product.findMany({
      where: {
        sellerId: sellerId,
        isActive: true,
      },
      select: {
        price: true,
        stock: true,
      },
    });

    const totalValue = [
      ...listingValues.map((l) => ({
        price: l.price.toNumber(),
        stock: l.stock,
      })),
      ...productValues.map((p) => ({
        price: p.price.toNumber(),
        stock: p.stock,
      })),
    ].reduce((total, item) => total + item.price * item.stock, 0);

    const totalItems = listingValues.length + productValues.length;
    const averagePrice = totalItems > 0 ? totalValue / totalItems : 0;

    const stats: SellerStats = {
      totalListings,
      activeListings,
      lowStockItems,
      totalValue,
      averagePrice,
      topPerformingItems: [], // TODO: Implementar cuando tengamos datos de ventas
    };

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error("Error obteniendo estadísticas del vendedor:", error);
    return {
      success: false,
      error: "Error interno del servidor",
    };
  }
}

// Desactivar listado de carta (soft delete)
export async function deactivateCardListing(
  listingId: number,
  sellerId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const updatedListing = await prisma.cardListing.updateMany({
      where: {
        id: listingId,
        sellerId: sellerId,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    if (updatedListing.count === 0) {
      return {
        success: false,
        error: "Listado no encontrado o no tienes permisos",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error desactivando listado:", error);
    return {
      success: false,
      error: "Error interno del servidor",
    };
  }
}

// Cerrar conexión de Prisma (para cleanup)
export async function disconnectPrisma() {
  await prisma.$disconnect();
}
