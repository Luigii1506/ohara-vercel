export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

const prisma = new PrismaClient();

// GET /api/lists/[id]/cards - Obtener cartas de lista
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    if (isNaN(listId)) {
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

    // Obtener parámetros de consulta
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Construir filtros
    const where: any = { listId };

    if (page) {
      const pageNum = parseInt(page);
      if (!isNaN(pageNum)) {
        where.page = pageNum;
      }
    }

    // Obtener cartas de la lista
    const cards = await prisma.userListCard.findMany({
      where,
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
      orderBy: [
        { page: "asc" },
        { row: "asc" },
        { column: "asc" },
        { sortOrder: "asc" },
      ],
      skip: offset,
      take: limit,
    });

    // Obtener total de cartas
    const totalCards = await prisma.userListCard.count({
      where,
    });

    return NextResponse.json({
      cards,
      totalCards,
      page: page ? parseInt(page) : null,
      limit,
      offset,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/lists/[id]/cards - Agregar cartas a lista
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log("Body received:", body);

    // Determinar si es un array de cartas o una sola carta
    const isArray = Array.isArray(body);
    const cardsToProcess = isArray ? body : [body];

    // Validar que tenemos cartas para procesar
    if (!cardsToProcess || cardsToProcess.length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron cartas para agregar" },
        { status: 400 }
      );
    }

    // Validar cada carta
    for (const cardData of cardsToProcess) {
      const { cardId, quantity = 1 } = cardData;
      if (!cardId || quantity < 1) {
        return NextResponse.json(
          { error: "Todas las cartas deben tener cardId y quantity válida" },
          { status: 400 }
        );
      }
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

    // Obtener información de la lista
    const list = await prisma.userList.findUnique({
      where: { id: listId },
    });

    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Procesar cada carta
    const results = [];
    let maxPageUpdated = list.totalPages;

    for (const cardInput of cardsToProcess) {
      const {
        cardId,
        quantity = 1,
        notes,
        condition,
        page,
        row,
        column,
      } = cardInput;

      // Verificar que la carta existe
      const card = await prisma.card.findUnique({
        where: { id: cardId },
      });

      if (!card) {
        return NextResponse.json(
          { error: `Carta con ID ${cardId} no encontrada` },
          { status: 404 }
        );
      }

      // Para listas ordenadas, verificar posición específica
      // Para listas simples, verificar por cardId para sumar cantidades
      let existingCard = null;

      if (list.isOrdered) {
        // En listas ordenadas, verificamos por posición específica si se proporciona
        if (page && row && column) {
          existingCard = await prisma.userListCard.findFirst({
            where: {
              listId,
              page,
              row,
              column,
            },
          });
        }
        // Si no hay posición específica, no verificamos existencia (se asignará nueva posición)
      } else {
        // En listas simples, verificar por cardId para sumar cantidades
        existingCard = await prisma.userListCard.findFirst({
          where: {
            listId,
            cardId,
          },
        });
      }

      if (existingCard) {
        if (list.isOrdered) {
          // En listas ordenadas, reemplazar la carta en esa posición
          const updatedCard = await prisma.userListCard.update({
            where: { id: existingCard.id },
            data: {
              cardId, // Reemplazar con la nueva carta
              quantity: 1, // Siempre 1 en listas ordenadas
              notes: notes || existingCard.notes,
              condition: condition || existingCard.condition,
            },
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
          });

          results.push(updatedCard);
          continue;
        } else {
          // En listas simples, sumar cantidades como antes
          const updatedCard = await prisma.userListCard.update({
            where: { id: existingCard.id },
            data: {
              quantity: existingCard.quantity + quantity,
              notes: notes || existingCard.notes,
              condition: condition || existingCard.condition,
            },
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
          });

          results.push(updatedCard);
          continue;
        }
      }

      // Preparar datos para nueva carta
      const cardData: any = {
        listId,
        cardId,
        quantity: list.isOrdered ? 1 : quantity, // En listas ordenadas siempre 1
        notes: notes || null,
        condition: condition || "Near Mint",
      };

      if (list.isOrdered) {
        // Lista ordenada - manejar posicionamiento físico
        if (page && row && column) {
          // Posición específica proporcionada
          // Validar posición
          if (
            page < 1 ||
            row < 1 ||
            row > list.maxRows! ||
            column < 1 ||
            column > list.maxColumns!
          ) {
            return NextResponse.json(
              {
                error: `Posición inválida para carta ${cardId}: página ${page}, fila ${row}, columna ${column}`,
              },
              { status: 400 }
            );
          }

          // La verificación de posición ocupada ya se hizo arriba
          // Si llegamos aquí, la posición está libre o se reemplazó

          cardData.page = page;
          cardData.row = row;
          cardData.column = column;

          // Actualizar maxPageUpdated si es necesario
          if (page > maxPageUpdated) {
            maxPageUpdated = page;
          }
        } else {
          // Encontrar primera posición disponible
          const nextPosition = await findNextAvailablePosition(listId, list);
          cardData.page = nextPosition.page;
          cardData.row = nextPosition.row;
          cardData.column = nextPosition.column;

          // Actualizar maxPageUpdated si es necesario
          if (nextPosition.page > maxPageUpdated) {
            maxPageUpdated = nextPosition.page;
          }
        }
      } else {
        // Lista no ordenada - usar sortOrder
        const maxSortOrder = await prisma.userListCard.findFirst({
          where: { listId },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });

        cardData.sortOrder = (maxSortOrder?.sortOrder || 0) + 10;
      }

      // Crear la nueva entrada
      const newCard = await prisma.userListCard.create({
        data: cardData,
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
      });

      results.push(newCard);
    }

    // Actualizar totalPages si es necesario
    if (maxPageUpdated > list.totalPages) {
      await prisma.userList.update({
        where: { id: listId },
        data: { totalPages: maxPageUpdated },
      });
    }

    // Retornar respuesta apropiada
    if (isArray) {
      return NextResponse.json(
        {
          message: `${results.length} carta(s) agregada(s) exitosamente`,
          cards: results,
        },
        { status: 201 }
      );
    } else {
      return NextResponse.json(
        {
          message: "Carta agregada exitosamente",
          card: results[0],
        },
        { status: 201 }
      );
    }
  } catch (error) {
    return handleAuthError(error);
  }
}

// Función auxiliar para encontrar la siguiente posición disponible en lista ordenada
async function findNextAvailablePosition(
  listId: number,
  list: any
): Promise<{ page: number; row: number; column: number }> {
  const maxRows = list.maxRows!;
  const maxColumns = list.maxColumns!;

  // Obtener todas las posiciones ocupadas ordenadas
  const occupiedPositions = await prisma.userListCard.findMany({
    where: { listId },
    select: { page: true, row: true, column: true },
    orderBy: [{ page: "asc" }, { row: "asc" }, { column: "asc" }],
  });

  // Crear un Set para búsqueda rápida
  const occupiedSet = new Set(
    occupiedPositions.map((pos) => `${pos.page}-${pos.row}-${pos.column}`)
  );

  // Buscar primera posición libre
  for (let page = 1; page <= list.totalPages + 1; page++) {
    for (let row = 1; row <= maxRows; row++) {
      for (let column = 1; column <= maxColumns; column++) {
        const positionKey = `${page}-${row}-${column}`;
        if (!occupiedSet.has(positionKey)) {
          return { page, row, column };
        }
      }
    }
  }

  // Si llegamos aquí, algo salió mal
  throw new Error("No se pudo encontrar una posición disponible");
}
