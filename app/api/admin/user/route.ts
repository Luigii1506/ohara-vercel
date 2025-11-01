export const dynamic = 'force-dynamic';

// /app/api/admin/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { name, email } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Faltan datos: name y email son requeridos" },
        { status: 400 }
      );
    }

    // Realiza el upsert: crea el usuario si no existe, o actualiza el nombre si ya existe
    const user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: { name, email },
    });

    return NextResponse.json(user, { status: 200 });
  } catch (error: any) {
    console.error("Error guardando el usuario:", error);
    return NextResponse.json(
      { error: "Error al guardar el usuario" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Obtenemos el parámetro "email" de la URL
    const email = req.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "El parámetro 'email' es requerido" },
        { status: 400 }
      );
    }

    // Buscamos el usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error: any) {
    console.error("Error obteniendo el usuario:", error);
    return NextResponse.json(
      { error: "Error al obtener el usuario" },
      { status: 500 }
    );
  }
}
