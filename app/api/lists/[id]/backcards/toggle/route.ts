export const dynamic = 'force-dynamic';

// 🎴 API para toggle (alternar) backcards en listas de usuario
// Fecha: 2024-09-09 - Funcionalidad de backcard toggle
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

const prisma = new PrismaClient();

// POST: Toggle backcard (agregar si no existe, quitar si existe)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log("🎴 Toggle Backcard - Iniciando...");

    const session = await getServerSession(authOptions);
    console.log("🎴 Session completa:", JSON.stringify(session, null, 2));
    console.log("🎴 Session user:", session?.user);
    console.log("🎴 Session user email:", session?.user?.email);
    console.log("🎴 Session user id:", session?.user?.id);

    // Buscar el usuario REAL en la base de datos por email
    let realUserId = null;
    if (session?.user?.email) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, email: true, name: true },
      });
      console.log("🎴 Usuario encontrado por email:", userByEmail);
      realUserId = userByEmail?.id;
    }

    if (!session?.user?.id || !realUserId) {
      console.log("🎴 Error: No autorizado - falta session o usuario");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.log(
      "🎴 CORRECIÓN: Session ID =",
      session.user.id,
      ", Real DB ID =",
      realUserId
    );

    const listId = parseInt(params.id);
    console.log("🎴 List ID:", params.id, "→", listId);

    if (isNaN(listId)) {
      console.log("🎴 Error: ID de lista inválido");
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log("🎴 Body:", body);
    const { page, row, column } = body;

    // Validar datos requeridos
    if (!page || !row || !column) {
      console.log("🎴 Error: Datos faltantes", { page, row, column });
      return NextResponse.json(
        { error: "page, row y column son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que la lista pertenezca al usuario
    console.log(
      "🎴 Buscando lista con ID:",
      listId,
      "para usuario REAL:",
      realUserId
    );
    // Primero, veamos todas las listas del usuario
    const userLists = await prisma.userList.findMany({
      where: {
        userId: realUserId,
      },
      select: {
        id: true,
        name: true,
        isOrdered: true,
      },
    });
    console.log("🎴 Todas las listas del usuario REAL:", userLists);

    const list = await prisma.userList.findFirst({
      where: {
        id: listId,
        userId: realUserId,
      },
    });

    console.log("🎴 Lista encontrada:", list ? `Sí (${list.name})` : "No");

    if (!list) {
      console.log(
        "🎴 Error: Lista no encontrada para usuario REAL",
        realUserId
      );

      // También veamos si la lista existe pero pertenece a otro usuario
      const listExists = await prisma.userList.findUnique({
        where: { id: listId },
        select: { id: true, userId: true, name: true },
      });
      console.log("🎴 Lista existe en DB:", listExists);

      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Buscar si ya existe un backcard en esa posición
    const existingBackcard = await prisma.userListBackcard.findUnique({
      where: {
        unique_backcard_position: {
          listId: listId,
          page: parseInt(page),
          row: parseInt(row),
          column: parseInt(column),
        },
      },
    });

    if (existingBackcard) {
      // Si existe, lo eliminamos
      await prisma.userListBackcard.delete({
        where: {
          id: existingBackcard.id,
        },
      });

      return NextResponse.json({
        success: true,
        action: "removed",
        message: "Backcard eliminado",
        position: {
          page: parseInt(page),
          row: parseInt(row),
          column: parseInt(column),
        },
      });
    } else {
      // Verificar que no haya una carta real en esa posición
      const existingCard = await prisma.userListCard.findUnique({
        where: {
          unique_physical_position: {
            listId: listId,
            page: parseInt(page),
            row: parseInt(row),
            column: parseInt(column),
          },
        },
      });

      if (existingCard) {
        return NextResponse.json(
          { error: "No se puede colocar un backcard donde ya hay una carta" },
          { status: 409 }
        );
      }

      // Si no existe, lo creamos
      const newBackcard = await prisma.userListBackcard.create({
        data: {
          listId: listId,
          page: parseInt(page),
          row: parseInt(row),
          column: parseInt(column),
        },
      });

      return NextResponse.json({
        success: true,
        action: "added",
        message: "Backcard agregado",
        backcard: newBackcard,
      });
    }
  } catch (error) {
    console.error("Error en toggle de backcard:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
