export const dynamic = 'force-dynamic';

// // app/api/test/route.ts
// import { NextResponse } from "next/server";
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// export async function POST(request: Request) {
//   console.log("updatingRarities");

//   try {
//     const firstEditionCards = await prisma.card.findMany({
//       where: { isFirstEdition: true },
//     });
//     for (const feCard of firstEditionCards) {
//       const nonFirstEditionCards = await prisma.card.findMany({
//         where: {
//           code: feCard.code,
//           isFirstEdition: false,
//         },
//       });
//       for (const card of nonFirstEditionCards) {
//         await prisma.card.update({
//           where: { id: card.id },
//           data: { rarity: feCard.rarity },
//         });
//       }
//     }

//     return NextResponse.json(
//       { message: "Rarities actualizadas correctamente." },
//       { status: 200 }
//     );
//   } catch (error) {
//     return NextResponse.json(
//       { message: "Error actualizando las cartas", error },
//       { status: 500 }
//     );
//   } finally {
//     await prisma.$disconnect();
//   }
// }

// app/api/cards/deleteCardsBySet150/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE() {
  try {
    console.log("JAJAJA");
    // Se eliminan las cartas que tengan una relación en "sets" con setId 150.
    // Asegúrate de que en tu esquema se hayan configurado correctamente las relaciones
    // para que la eliminación en cascada borre también los registros en la tabla intermedia.
    const deletedCards = await prisma.card.deleteMany({
      where: {
        sets: {
          some: {
            setId: 150,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Cartas eliminadas correctamente.",
        count: deletedCards.count,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al eliminar las cartas:", error);
    return NextResponse.json(
      { message: "Error eliminando las cartas", error },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
