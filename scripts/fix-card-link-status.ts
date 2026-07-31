#!/usr/bin/env ts-node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Buscando cartas con tcgplayerLinkStatus=true y tcgplayerProductId=null...");

  const cards = await prisma.card.findMany({
    where: {
      tcgplayerLinkStatus: true,
      OR: [{ tcgplayerProductId: null }, { tcgplayerProductId: "" }],
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  if (!cards.length) {
    console.log("✅ No hay cartas con datos inconsistentes.");
    return;
  }

  console.log(`⚠️ Encontradas ${cards.length} cartas con estado linkeado pero sin productId.`);

  const updated = await prisma.card.updateMany({
    where: {
      id: { in: cards.map((card) => card.id) },
    },
    data: {
      tcgplayerLinkStatus: null,
    },
  });

  console.log(`🔧 Actualizadas ${updated.count} cartas. El campo tcgplayerLinkStatus ahora es null.`);
  console.log("Cartas afectadas:");
  cards.forEach((card) => {
    console.log(` - [${card.id}] ${card.code} :: ${card.name}`);
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
