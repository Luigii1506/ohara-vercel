export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

// GET /api/lists - Obtener todas las listas del usuario
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Obtener todas las listas del usuario con estadísticas básicas
    const lists = await prisma.userList.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { cards: true },
        },
        cards: {
          include: {
            card: {
              select: {
                id: true,
                marketPrice: true,
                priceCurrency: true,
              },
            },
            customPrice: true,
            customCurrency: true,
            quantity: true,
          },
        },
      },
      orderBy: [
        { isCollection: "desc" }, // Colección primero
        { createdAt: "asc" },
      ],
    });

    // Calcular el precio total de cada lista
    const listsWithTotal = lists.map((list) => {
      let totalValue = 0;
      let currency = "USD";

      list.cards.forEach((listCard) => {
        const card = listCard.card;
        const quantity = listCard.quantity || 1;

        // Obtener precio de la carta
        const getNumericPrice = (value: any) => {
          if (value === null || value === undefined || value === "") return null;
          const numberValue = typeof value === "number" ? value : Number(value);
          return Number.isFinite(numberValue) ? numberValue : null;
        };

        const customPrice = getNumericPrice(listCard.customPrice);
        const price = customPrice ?? getNumericPrice(card.marketPrice);

        if (price !== null) {
          totalValue += price * quantity;
          // Usar la moneda de la primera carta con precio
          if (totalValue === price * quantity) {
            currency =
              listCard.customCurrency || card.priceCurrency || currency;
          }
        }
      });

      return {
        ...list,
        totalValue,
        currency,
        cards: undefined, // No enviar las cartas completas al frontend
      };
    });

    return NextResponse.json({ lists: listsWithTotal });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/lists - Crear nueva lista
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const {
      name,
      description,
      isOrdered = false,
      maxRows,
      maxColumns,
      color,
      isPublic = false,
      isCollection = false, // Agregar este campo por seguridad
    } = body;

    // Validación adicional: nunca permitir crear listas de colección manualmente
    if (isCollection === true) {
      return NextResponse.json(
        { error: "No se pueden crear listas de colección manualmente" },
        { status: 400 }
      );
    }

    // Validaciones básicas
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      );
    }

    if (name.toLowerCase() === "colección") {
      return NextResponse.json(
        {
          error: 'No se puede crear una lista con el nombre "Colección"',
        },
        { status: 400 }
      );
    }

    // Verificar que no exista una lista con el mismo nombre
    const existingList = await prisma.userList.findFirst({
      where: {
        userId: user.id,
        name: name.trim(),
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

    // Validaciones para listas ordenadas
    if (isOrdered) {
      if (!maxRows || !maxColumns || maxRows < 1 || maxColumns < 1) {
        return NextResponse.json(
          {
            error:
              "Para listas ordenadas se requieren maxRows y maxColumns válidos",
          },
          { status: 400 }
        );
      }

      if (maxRows > 10 || maxColumns > 10) {
        return NextResponse.json(
          {
            error: "Máximo 10 filas y 10 columnas permitidas",
          },
          { status: 400 }
        );
      }
    }

    // Crear la lista con manejo de errores mejorado
    let newList;
    try {
      newList = await prisma.userList.create({
        data: {
          userId: user.id,
          name: name.trim(),
          description: description?.trim() || null,
          isOrdered,
          maxRows: isOrdered ? maxRows : null,
          maxColumns: isOrdered ? maxColumns : null,
          totalPages: 1,
          color: color || null,
          isPublic,
          isDeletable: true,
          isCollection: false, // Siempre false para listas normales
        },
        include: {
          _count: {
            select: { cards: true },
          },
        },
      });
    } catch (createError: any) {
      console.error("Error al crear lista:", createError);

      // Si es un error de constraint único
      if (createError.code === "P2002") {
        const target = createError.meta?.target || [];

        // Error de ID duplicado - resetear secuencia
        if (target.includes("id")) {
          console.log("🔧 Reseteando secuencia de UserList...");

          // Resetear la secuencia de autoincremento
          await prisma.$executeRaw`
            SELECT setval(
              pg_get_serial_sequence('"UserList"', 'id'),
              COALESCE(MAX(id), 1),
              true
            )
            FROM "UserList";
          `;

          console.log("✅ Secuencia reseteada, reintentando...");

          // Reintentar la creación
          newList = await prisma.userList.create({
            data: {
              userId: user.id,
              name: name.trim(),
              description: description?.trim() || null,
              isOrdered,
              maxRows: isOrdered ? maxRows : null,
              maxColumns: isOrdered ? maxColumns : null,
              totalPages: 1,
              color: color || null,
              isPublic,
              isDeletable: true,
              isCollection: false,
            },
            include: {
              _count: {
                select: { cards: true },
              },
            },
          });
        } else if (target.includes("userId_name") || target.includes("name")) {
          return NextResponse.json(
            { error: "Ya existe una lista con ese nombre" },
            { status: 400 }
          );
        }
      } else {
        // Para otros errores
        throw createError;
      }
    }

    return NextResponse.json(
      {
        message: "Lista creada exitosamente",
        list: newList,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
