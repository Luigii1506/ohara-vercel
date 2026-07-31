#!/usr/bin/env ts-node

/**
 * Script para asegurarse de que todas las cartas con alternateArt = "Pre-Release"
 * tengan setCode = null.
 *
 * Uso:
 *   npx ts-node scripts/fix-pre-release-setcode.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log(
    "Buscando cartas Pre-Release con setCode diferente a cadena vacía..."
  );

  const cards = await prisma.card.findMany({
    where: {
      alternateArt: {
        equals: "Pre-Release",
        mode: "insensitive",
      },
      setCode: {
        not: "",
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      setCode: true,
    },
  });

  if (!cards.length) {
    console.log("✅ Todas las cartas Pre-Release ya tienen setCode = null.");
    return;
  }

  console.log(`⚠️ Se encontraron ${cards.length} cartas con setCode definido:`);
  cards.forEach((card) => {
    console.log(`- ID ${card.id} :: ${card.code} :: setCode=${card.setCode}`);
  });

  const updated = await prisma.card.updateMany({
    where: {
      id: {
        in: cards.map((card) => card.id),
      },
    },
    data: {
      setCode: "",
    },
  });

  console.log(
    `\n✅ Actualizadas ${updated.count} cartas: setCode ahora es \"\" (cadena vacía).`
  );
}

main()
  .catch((error) => {
    console.error("❌ Error ajustando setCode de cartas Pre-Release:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
