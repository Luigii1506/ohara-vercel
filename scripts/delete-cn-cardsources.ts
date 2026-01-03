#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");

  const total = await prisma.cardSource.count({
    where: { source: "CN" },
  });

  console.log(`[scan] cardSources(CN)=${total}`);

  if (dryRun) {
    console.log("[dry-run] No deletions performed.");
    return;
  }

  const removed = await prisma.cardSource.deleteMany({
    where: { source: "CN" },
  });

  console.log(`[delete] cardSources=${removed.count}`);
};

main()
  .catch((error) => {
    console.error("[error] delete failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
