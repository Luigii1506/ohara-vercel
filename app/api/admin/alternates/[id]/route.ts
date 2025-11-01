export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// * GET: Obtener todas las cartas que tengan el mismo codigo de carta mediante code y que no sean isFirstEdition true

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Obtener el parámetro "code" de la URL
    const { id } = params;

    const card = await prisma.card.findUnique({
      where: { id: parseInt(id) },
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Consulta a la base de datos con el filtro
    const cards = await prisma.card.findMany({
      where: {
        code: card.code, // Filtra por el código
        //isFirstEdition: false, // Asegúrate de que no sean de la primera edición
      },
      include: {
        types: true,
        colors: true,
        effects: true,
        conditions: true,
      },
    });

    return NextResponse.json(cards, { status: 200 });
  } catch (error: any) {
    console.error("Error en GET /api/cards:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// export async function GET(
//   req: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   const { id } = params;

//   try {
//     // Obtener carta por ID con relaciones opcionales
//     const card = await prisma.card.findUnique({
//       where: { id: parseInt(id) },
//       include: {
//         types: true,
//         colors: true,
//         effects: true,
//         conditions: true,
//       },
//     });

//     if (!card) {
//       return NextResponse.json({ error: "Card not found" }, { status: 404 });
//     }

//     return NextResponse.json(card, { status: 200 });
//   } catch (error: any) {
//     console.error("Error en GET /api/cards/[id]:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }
