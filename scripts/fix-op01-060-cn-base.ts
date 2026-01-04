#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE_ID = 18755;
const DELETE_ID = 17458;
const ALTERNATE_ID = 17491;

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");

  const [baseCard, deleteCard, altCard] = await Promise.all([
    prisma.card.findUnique({ where: { id: BASE_ID } }),
    prisma.card.findUnique({ where: { id: DELETE_ID } }),
    prisma.card.findUnique({ where: { id: ALTERNATE_ID } }),
  ]);

  if (!baseCard || !deleteCard || !altCard) {
    console.log("[skip] Missing one of the target cards.");
    return;
  }

  console.log(
    `[scan] base=${BASE_ID} delete=${DELETE_ID} alt=${ALTERNATE_ID} dryRun=${dryRun}`
  );

  if (dryRun) {
    console.log(
      `[dry-run] promote ${BASE_ID} to base, delete ${DELETE_ID}, set ${ALTERNATE_ID} baseCardId=${BASE_ID}`
    );
    return;
  }

  await prisma.card.update({
    where: { id: BASE_ID },
    data: {
      isFirstEdition: true,
      alias: "0",
      baseCardId: null,
    },
  });

  await prisma.card.update({
    where: { id: ALTERNATE_ID },
    data: {
      isFirstEdition: false,
      baseCardId: BASE_ID,
    },
  });

  await prisma.card.updateMany({
    where: { baseCardId: DELETE_ID },
    data: { baseCardId: BASE_ID },
  });

  await prisma.cardSet.deleteMany({ where: { cardId: DELETE_ID } });
  await prisma.cardSource.deleteMany({ where: { cardId: DELETE_ID } });
  await prisma.cardGroupLink.deleteMany({ where: { cardId: DELETE_ID } });
  await prisma.cardVariantLink.deleteMany({ where: { cardId: DELETE_ID } });

  await prisma.card.delete({ where: { id: DELETE_ID } });

  console.log("[done] base promoted, alternate linked, old base removed.");
};

main()
  .catch((error) => {
    console.error("[error] fix failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
