#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
  };
};

const main = async () => {
  const { dryRun } = parseArgs();
  const where = {
    region: "Global",
  };

  const total = await prisma.card.count({ where });
  console.log(`[start] Cards with region=Global: ${total}`);

  if (dryRun) {
    console.log("[dry-run] No changes applied.");
    return;
  }

  const result = await prisma.card.updateMany({
    where,
    data: {
      region: "US",
      language: "en",
    },
  });

  console.log(`[update] Updated ${result.count} cards to region=US language=en`);
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
