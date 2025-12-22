#!/usr/bin/env ts-node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Corrigiendo baseCardId de alternas...");

  const alternates = await prisma.card.findMany({
    where: {
      isFirstEdition: false,
      baseCardId: null,
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (!alternates.length) {
    console.log("✅ No hay alternas con baseCardId null.");
    return;
  }

  console.log(`Encontradas ${alternates.length} alternas sin baseCardId.`);

  let fixed = 0;

  for (const alt of alternates) {
    const base = await prisma.card.findFirst({
      where: {
        code: alt.code,
        isFirstEdition: true,
      },
      select: { id: true },
    });

    if (base) {
      await prisma.card.update({
        where: { id: alt.id },
        data: { baseCardId: base.id },
      });
      fixed += 1;
      console.log(`🔧 Actualizado ${alt.code}: baseCardId -> ${base.id}`);
    } else {
      console.warn(`⚠️ No se encontró base para ${alt.code}`);
    }
  }

  console.log(`✅ baseCardId actualizado en ${fixed} alternas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
