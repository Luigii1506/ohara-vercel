#!/usr/bin/env ts-node

/**
 * Elimina todas las cartas con alternateArt = "Pre-Release" (case-insensitive).
 * La eliminación se hace en cascada gracias a las reglas ON DELETE CASCADE del schema.
 *
 * Uso:
 *   npx ts-node scripts/delete-pre-release-cards.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Buscando cartas con alternateArt = \"Pre-Release\"...");

  const cards = await prisma.card.findMany({
    where: {
      alternateArt: {
        equals: "Pre-Release",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  if (!cards.length) {
    console.log("✅ No se encontraron cartas con alternateArt = \"Pre-Release\".");
    return;
  }

  console.log(`⚠️ Se encontraron ${cards.length} cartas para eliminar:\n`);
  cards.forEach((card) => {
    console.log(`- ID ${card.id} :: ${card.code} :: ${card.name}`);
  });
  console.log("\nEliminando en cascada...");

  const deleted = await prisma.card.deleteMany({
    where: {
      id: {
        in: cards.map((card) => card.id),
      },
    },
  });

  console.log(`\n✅ Eliminadas ${deleted.count} cartas con alternateArt = "Pre-Release".`);
}

main()
  .catch((error) => {
    console.error("❌ Error eliminando cartas Pre-Release:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
