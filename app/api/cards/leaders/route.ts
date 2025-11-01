export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const leaders = await prisma.card.findMany({
      where: {
        category: "Leader",
        isFirstEdition: true,
      },
      include: {
        colors: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      leaders,
      count: leaders.length,
    });
  } catch (error) {
    console.error("Error fetching leaders:", error);
    return NextResponse.json(
      { error: "Error al obtener los líderes" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
