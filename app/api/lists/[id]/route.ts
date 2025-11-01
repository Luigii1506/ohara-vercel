export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

const prisma = new PrismaClient();

// GET /api/lists/[id] - Obtener lista específica con sus cartas
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);

    let user = null;
    let isOwner = false;

    // Intentar obtener el usuario autenticado, pero no fallar si no hay sesión
    try {
      user = await requireAuth();
    } catch (error) {
      // Si no hay autenticación, continuar como acceso público
      user = null;
    }

    const listId = parseInt(params.id);
    if (isNaN(listId) || listId <= 0) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limitParam = searchParams.get("limit");
    const limit =
      limitParam === "0" || limitParam === "all"
        ? undefined // Sin límite
        : Math.max(1, Math.min(100, parseInt(limitParam || "50")));
    const search = (searchParams.get("search") || "").trim();

    const skip = limit ? (page - 1) * limit : 0;

    // Configurar condiciones de acceso según si hay usuario autenticado
    let whereConditions: any;

    if (user) {
      // Para acceso autenticado, permitir propias o públicas
      whereConditions = {
        id: listId,
        OR: [
          { userId: user.id }, // Es propietario
          { isPublic: true }, // Es pública
        ],
      };
    } else {
      // Para acceso sin autenticación, solo permitir listas públicas
      whereConditions = {
        id: listId,
        isPublic: true,
      };
    }

    // Verificar que la lista existe y el usuario tiene acceso
    const list = await prisma.userList.findFirst({
      where: whereConditions,
      include: {
        user: {
          select: { name: true, email: true },
        },
        _count: {
          select: { cards: true },
        },
      },
    });

    if (!list) {
      if (!user) {
        return NextResponse.json(
          {
            error: "Lista no encontrada o no es pública",
          },
          { status: 404 }
        );
      } else {
        return NextResponse.json(
          {
            error: "Lista no encontrada o sin permisos",
          },
          { status: 404 }
        );
      }
    }

    // Verificar si el usuario es propietario
    if (user) {
      isOwner = list.userId === user.id;
    }

    // Construir filtros de búsqueda con validaciones
    const whereClause: any = { listId };

    if (search && search.length > 0) {
      // Sanitizar el término de búsqueda
      const sanitizedSearch = search.replace(/[%_]/g, "\\$&");

      whereClause.card = {
        OR: [
          { name: { contains: sanitizedSearch, mode: "insensitive" } },
          { code: { contains: sanitizedSearch, mode: "insensitive" } },
        ],
      };
    }

    // Obtener cartas con paginación y validaciones de seguridad
    const cards = await prisma.userListCard.findMany({
      where: whereClause,
      include: {
        card: {
          include: {
            colors: true,
            types: true,
            sets: {
              include: { set: true },
            },
          },
        },
      },
      orderBy: list.isOrdered
        ? [{ page: "asc" }, { row: "asc" }, { column: "asc" }]
        : [{ sortOrder: "asc" }, { createdAt: "asc" }],
      skip,
      ...(limit && { take: limit }), // Solo agregar take si hay límite
    });

    // Filtrar cartas con datos válidos y completos
    const validCards = cards.filter((cardItem) => {
      if (!cardItem || !cardItem.card) return false;

      // Validar campos esenciales de la carta
      const card = cardItem.card;
      if (!card.name || !card.code || !card.src) return false;

      // Para listas ordenadas, validar posicionamiento
      if (list.isOrdered) {
        if (
          cardItem.page === null ||
          cardItem.row === null ||
          cardItem.column === null
        ) {
          return false;
        }

        // Validar que las posiciones estén dentro de los límites de la lista
        const maxRows = list.maxRows || 3;
        const maxColumns = list.maxColumns || 3;

        if (
          cardItem.row < 1 ||
          cardItem.row > maxRows ||
          cardItem.column < 1 ||
          cardItem.column > maxColumns ||
          cardItem.page < 1
        ) {
          return false;
        }
      }

      return true;
    });

    const totalCards = await prisma.userListCard.count({
      where: whereClause,
    });

    // Calcular totalPages de manera segura
    let totalPages = 1;

    if (list.isOrdered && list.maxRows && list.maxColumns) {
      // Para listas ordenadas, calcular basado en la página máxima que tiene cartas
      const maxPageResult = await prisma.userListCard.findFirst({
        where: {
          listId,
          page: { not: null },
        },
        orderBy: { page: "desc" },
        select: { page: true },
      });

      totalPages = Math.max(1, maxPageResult?.page || 1);
    } else {
      // Para listas simples, usar paginación estándar
      totalPages = limit ? Math.max(1, Math.ceil(totalCards / limit)) : 1;
    }

    // Preparar respuesta con datos seguros
    const responseList = {
      ...list,
      totalPages,
      maxRows: list.maxRows || (list.isOrdered ? 3 : null),
      maxColumns: list.maxColumns || (list.isOrdered ? 3 : null),
      cards: validCards, // Incluir cartas en la respuesta de la lista
    };

    return NextResponse.json({
      list: responseList,
      cards: validCards,
      pagination: {
        page,
        limit: limit || null,
        total: totalCards,
        pages: limit ? Math.ceil(totalCards / limit) : 1,
      },
      isOwner,
    });
  } catch (error) {
    console.error("Error in GET /api/lists/[id]:", error);

    // Para otros errores, devolver una respuesta genérica
    return NextResponse.json(
      {
        error: "Error interno del servidor al obtener la lista",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: 500 }
    );
  }
}

// PUT /api/lists/[id] - Actualizar lista
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    if (isNaN(listId) || listId <= 0) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    // Verificar que el usuario es propietario de la lista
    const isOwner = await validateListOwnership(listId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        {
          error: "Lista no encontrada o sin permisos",
        },
        { status: 404 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Formato de datos inválido" },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      color,
      isPublic,
      maxRows,
      maxColumns,
      totalPages,
    } = body;

    // Validaciones básicas de entrada
    if (
      name !== undefined &&
      (typeof name !== "string" || name.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: "El nombre de la lista no puede estar vacío" },
        { status: 400 }
      );
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return NextResponse.json(
        { error: "La descripción debe ser texto" },
        { status: 400 }
      );
    }

    if (isPublic !== undefined && typeof isPublic !== "boolean") {
      return NextResponse.json(
        { error: "El campo isPublic debe ser verdadero o falso" },
        { status: 400 }
      );
    }

    if (
      totalPages !== undefined &&
      (!Number.isInteger(totalPages) || totalPages < 0)
    ) {
      return NextResponse.json(
        {
          error:
            "El total de páginas debe ser un número entero positivo o cero",
        },
        { status: 400 }
      );
    }

    // Obtener la lista actual para verificaciones
    const currentList = await prisma.userList.findUnique({
      where: { id: listId },
    });

    if (!currentList) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // No permitir cambio de nombre en la lista de colección
    if (currentList.isCollection && name && name !== currentList.name) {
      return NextResponse.json(
        {
          error: "No se puede cambiar el nombre de la lista de colección",
        },
        { status: 400 }
      );
    }

    // Validar nombre único si se está cambiando
    if (name && name !== currentList.name) {
      if (name.toLowerCase() === "colección") {
        return NextResponse.json(
          {
            error: 'No se puede usar el nombre "Colección"',
          },
          { status: 400 }
        );
      }

      const existingList = await prisma.userList.findFirst({
        where: {
          userId: user.id,
          name: name.trim(),
          id: { not: listId },
        },
      });

      if (existingList) {
        return NextResponse.json(
          {
            error: "Ya existe una lista con ese nombre",
          },
          { status: 400 }
        );
      }
    }

    // Validaciones para cambios en listas ordenadas
    if (currentList.isOrdered && (maxRows || maxColumns)) {
      if (maxRows && (maxRows < 1 || maxRows > 10)) {
        return NextResponse.json(
          {
            error: "Las filas deben estar entre 1 y 10",
          },
          { status: 400 }
        );
      }

      if (maxColumns && (maxColumns < 1 || maxColumns > 10)) {
        return NextResponse.json(
          {
            error: "Las columnas deben estar entre 1 y 10",
          },
          { status: 400 }
        );
      }

      // Verificar que no haya cartas que excedan los nuevos límites
      if (maxRows && maxRows < currentList.maxRows!) {
        const cardsExceedingRows = await prisma.userListCard.count({
          where: {
            listId,
            row: { gt: maxRows },
          },
        });

        if (cardsExceedingRows > 0) {
          return NextResponse.json(
            {
              error: `No se puede reducir las filas. Hay ${cardsExceedingRows} carta(s) en filas superiores`,
            },
            { status: 400 }
          );
        }
      }

      if (maxColumns && maxColumns < currentList.maxColumns!) {
        const cardsExceedingColumns = await prisma.userListCard.count({
          where: {
            listId,
            column: { gt: maxColumns },
          },
        });

        if (cardsExceedingColumns > 0) {
          return NextResponse.json(
            {
              error: `No se puede reducir las columnas. Hay ${cardsExceedingColumns} carta(s) en columnas superiores`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Actualizar la lista
    const updatedList = await prisma.userList.update({
      where: { id: listId },
      data: {
        name: name?.trim() || undefined,
        description:
          description !== undefined ? description?.trim() || null : undefined,
        color: color !== undefined ? color || null : undefined,
        isPublic: typeof isPublic === "boolean" ? isPublic : undefined,
        maxRows: maxRows || undefined,
        maxColumns: maxColumns || undefined,
        totalPages: totalPages !== undefined ? totalPages : undefined,
      },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });

    return NextResponse.json({
      message: "Lista actualizada exitosamente",
      list: updatedList,
    });
  } catch (error) {
    console.error("Error in PUT /api/lists/[id]:", error);

    // Si es un error de autenticación, usar el manejador específico
    if (error instanceof Error && error.message.includes("auth")) {
      return handleAuthError(error);
    }

    // Para otros errores, devolver una respuesta genérica
    return NextResponse.json(
      {
        error: "Error interno del servidor al actualizar la lista",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: 500 }
    );
  }
}

// DELETE /api/lists/[id] - Eliminar lista
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    if (isNaN(listId) || listId <= 0) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    // Verificar que la lista existe y el usuario es propietario
    const list = await prisma.userList.findFirst({
      where: {
        id: listId,
        userId: user.id,
      },
    });

    if (!list) {
      return NextResponse.json(
        {
          error: "Lista no encontrada o sin permisos",
        },
        { status: 404 }
      );
    }

    // Verificar que la lista se puede eliminar
    if (!list.isDeletable) {
      return NextResponse.json(
        {
          error: "Esta lista no se puede eliminar",
        },
        { status: 400 }
      );
    }

    // Eliminar la lista (las cartas se eliminan automáticamente por CASCADE)
    await prisma.userList.delete({
      where: { id: listId },
    });

    return NextResponse.json({
      message: "Lista eliminada exitosamente",
    });
  } catch (error) {
    console.error("Error in DELETE /api/lists/[id]:", error);

    // Si es un error de autenticación, usar el manejador específico
    if (error instanceof Error && error.message.includes("auth")) {
      return handleAuthError(error);
    }

    // Para otros errores, devolver una respuesta genérica
    return NextResponse.json(
      {
        error: "Error interno del servidor al eliminar la lista",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: 500 }
    );
  }
}
