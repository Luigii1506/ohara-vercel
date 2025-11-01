export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// CREATE - POST
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, title, code, version, releaseDate, isOpen } = body;

    const newSet = await prisma.set.create({
      data: {
        image,
        title,
        code,
        version,
        releaseDate: new Date(releaseDate), // Aseguramos que sea Date
        isOpen: isOpen ?? false,
      },
    });

    return NextResponse.json(newSet, { status: 201 });
  } catch (error: any) {
    console.error("Error en POST /api/sets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// READ - GET ALL
export async function GET(req: NextRequest) {
  // Obtenemos parámetros de query para incluir relaciones si es necesario
  const includeRelations = req.nextUrl.searchParams.get("includeRelations");

  try {
    const sets = await prisma.set.findMany({
      include:
        includeRelations === "true"
          ? { cards: true, events: true, _count: { select: { cards: true } } }
          : { _count: { select: { cards: true } } },
      orderBy: { createdAt: "desc" }, // Más recientes primero
    });

    return NextResponse.json(sets, { status: 200 });
  } catch (error: any) {
    console.error("Error en GET /api/sets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
