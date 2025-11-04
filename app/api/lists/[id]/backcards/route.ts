export const dynamic = 'force-dynamic';

// 🎴 API para manejar backcards en listas de usuario
// Fecha: 2024-09-09 - Funcionalidad de backcard
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

// GET: Obtener todos los backcards de una lista
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log("🎴 GET Backcards - Iniciando...");
    const session = await getServerSession(authOptions);
    console.log("🎴 GET Session user id:", session?.user?.id);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Buscar el usuario REAL en la base de datos por email
    let realUserId = null;
    if (session?.user?.email) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, email: true, name: true },
      });
      console.log("🎴 GET Usuario encontrado por email:", userByEmail);
      realUserId = userByEmail?.id;
    }

    if (!realUserId) {
      console.log("🎴 GET Error: No se encontró usuario real");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const listId = parseInt(params.id);
    console.log("🎴 GET List ID:", params.id, "→", listId);
    if (isNaN(listId)) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    // Verificar que la lista pertenezca al usuario REAL
    const list = await prisma.userList.findFirst({
      where: {
        id: listId,
        userId: realUserId,
      },
    });

    console.log("🎴 GET Lista encontrada:", list ? `Sí (${list.name})` : "No");
    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Obtener todos los backcards de la lista
    const backcards = await prisma.userListBackcard.findMany({
      where: {
        listId: listId,
      },
      orderBy: [{ page: "asc" }, { row: "asc" }, { column: "asc" }],
    });

    console.log("🎴 GET Backcards encontrados:", backcards.length);
    console.log("🎴 GET Backcards data:", backcards);
    return NextResponse.json(backcards);
  } catch (error) {
    console.error("Error obteniendo backcards:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST: Agregar un backcard
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log("🎴 POST Backcard - Iniciando...");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Buscar el usuario REAL en la base de datos por email
    let realUserId = null;
    if (session?.user?.email) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, email: true, name: true },
      });
      console.log("🎴 POST Usuario encontrado por email:", userByEmail);
      realUserId = userByEmail?.id;
    }

    if (!realUserId) {
      console.log("🎴 POST Error: No se encontró usuario real");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const listId = parseInt(params.id);
    console.log("🎴 POST List ID:", params.id, "→", listId);
    if (isNaN(listId)) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { page, row, column } = body;
    console.log("🎴 POST Body:", body);

    // Validar datos requeridos
    if (!page || !row || !column) {
      return NextResponse.json(
        { error: "page, row y column son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que la lista pertenezca al usuario REAL
    const list = await prisma.userList.findFirst({
      where: {
        id: listId,
        userId: realUserId,
      },
    });

    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que no haya un backcard en esa posición
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
      return NextResponse.json(
        { error: "Ya existe un backcard en esa posición" },
        { status: 409 }
      );
    }

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
        { error: "Ya existe una carta en esa posición" },
        { status: 409 }
      );
    }

    // Crear el backcard
    const backcard = await prisma.userListBackcard.create({
      data: {
        listId: listId,
        page: parseInt(page),
        row: parseInt(row),
        column: parseInt(column),
      },
    });

    return NextResponse.json(backcard, { status: 201 });
  } catch (error) {
    console.error("Error creando backcard:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE: Quitar un backcard por posición
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log("🎴 DELETE Backcard - Iniciando...");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Buscar el usuario REAL en la base de datos por email
    let realUserId = null;
    if (session?.user?.email) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, email: true, name: true },
      });
      console.log("🎴 DELETE Usuario encontrado por email:", userByEmail);
      realUserId = userByEmail?.id;
    }

    if (!realUserId) {
      console.log("🎴 DELETE Error: No se encontró usuario real");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const listId = parseInt(params.id);
    console.log("🎴 DELETE List ID:", params.id, "→", listId);
    if (isNaN(listId)) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const page = url.searchParams.get("page");
    const row = url.searchParams.get("row");
    const column = url.searchParams.get("column");

    // Validar parámetros requeridos
    if (!page || !row || !column) {
      return NextResponse.json(
        { error: "page, row y column son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que la lista pertenezca al usuario REAL
    const list = await prisma.userList.findFirst({
      where: {
        id: listId,
        userId: realUserId,
      },
    });

    console.log(
      "🎴 DELETE Lista encontrada:",
      list ? `Sí (${list.name})` : "No"
    );

    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Intentar eliminar el backcard
    const deletedBackcard = await prisma.userListBackcard.delete({
      where: {
        unique_backcard_position: {
          listId: listId,
          page: parseInt(page),
          row: parseInt(row),
          column: parseInt(column),
        },
      },
    });

    return NextResponse.json({ success: true, deletedBackcard });
  } catch (error: any) {
    if (error?.code === "P2025") {
      // Prisma error: Record not found
      return NextResponse.json(
        { error: "Backcard no encontrado en esa posición" },
        { status: 404 }
      );
    }

    console.error("Error eliminando backcard:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
