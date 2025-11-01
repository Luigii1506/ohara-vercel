export const dynamic = 'force-dynamic';

// API para crear listados directos del vendedor - POST
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Sin permisos de vendedor" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      cardId,
      price,
      stock,
      conditionForSale,
      sku,
      lowStockThreshold = 5,
      isFeatured = false,
      isDraft = false, // Listado directo está activo por defecto
      isActive = true,
    } = body;

    // Validaciones
    if (!cardId || !price || !stock || !conditionForSale) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    if (price <= 0 || stock < 0) {
      return NextResponse.json(
        { success: false, error: "Precio y stock deben ser positivos" },
        { status: 400 }
      );
    }

    // Verificar que la carta existe
    const card = await prisma.card.findUnique({
      where: { id: parseInt(cardId) },
    });

    if (!card) {
      return NextResponse.json(
        { success: false, error: "Carta no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que no existe un listado activo de esta carta por este vendedor con la misma condición
    const existingListing = await prisma.cardListing.findFirst({
      where: {
        cardId: parseInt(cardId),
        sellerId: user.id,
        conditionForSale,
        isActive: true,
      },
    });

    if (existingListing) {
      return NextResponse.json(
        {
          success: false,
          error: "Ya tienes un listado activo de esta carta en esta condición",
        },
        { status: 409 }
      );
    }

    // Crear el listado directo
    const newListing = await prisma.cardListing.create({
      data: {
        cardId: parseInt(cardId),
        sellerId: user.id,
        price: Math.round(parseFloat(price) * 100), // Convertir a centavos
        stock: parseInt(stock),
        conditionForSale,
        sku: sku || `${card.code}-${conditionForSale}-${user.id}-${Date.now()}`,
        lowStockThreshold: parseInt(lowStockThreshold),
        isFeatured,
        isDraft,
        isActive,
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

    return NextResponse.json({
      success: true,
      data: newListing,
      message: "Listado creado exitosamente",
    });
  } catch (error) {
    console.error("Error creando listado:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// GET - Obtener listados del vendedor
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Sin permisos de vendedor" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "listingDate";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const isActive = searchParams.get("isActive");
    const isDraft = searchParams.get("isDraft");
    const inStock = searchParams.get("inStock");
    const lowStock = searchParams.get("lowStock");

    const skip = (page - 1) * limit;

    // Construir condiciones WHERE
    const whereConditions: any = {
      sellerId: user.id, // Solo listados del vendedor actual
    };

    // Filtro de búsqueda
    if (search) {
      whereConditions.OR = [
        {
          card: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          card: {
            code: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          sku: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    // Filtros de estado
    if (isActive !== null) {
      whereConditions.isActive = isActive === "true";
    }

    if (isDraft !== null) {
      whereConditions.isDraft = isDraft === "true";
    }

    // Filtros de stock
    if (inStock === "true") {
      whereConditions.stock = { gt: 0 };
    }

    if (lowStock === "true") {
      // Para stock bajo, necesitamos usar una consulta raw o hacer la comparación en JavaScript
      // Por ahora usamos un valor fijo de 5 como umbral bajo
      whereConditions.stock = {
        gt: 0,
        lte: 5,
      };
    }

    // Ejecutar consultas
    const [listings, total] = await Promise.all([
      prisma.cardListing.findMany({
        where: whereConditions,
        include: {
          card: {
            select: {
              id: true,
              name: true,
              code: true,
              src: true,
              setCode: true,
              category: true,
              rarity: true,
            },
          },
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder as "asc" | "desc",
        },
        skip,
        take: limit,
      }),
      prisma.cardListing.count({
        where: whereConditions,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        data: listings,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error obteniendo listados:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
