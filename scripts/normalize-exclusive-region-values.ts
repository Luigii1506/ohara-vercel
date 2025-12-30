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

const REGION_MAP: Record<string, string> = {
  "Chinese exclusive": "CN-S",
  "English exclusive": "US",
  "French exclusive": "FR",
  "Japanese exclusive": "JP",
  "Korean exclusive": "KR",
  "Not in English": "JP",
};

const main = async () => {
  const { dryRun } = parseArgs();

  const values = Object.keys(REGION_MAP);
  const counts = await prisma.card.groupBy({
    by: ["region"],
    where: { region: { in: values } },
    _count: { _all: true },
  });

  console.log("[start] Exclusive region values found:", counts);

  if (dryRun) {
    console.log("[dry-run] No changes applied.");
    return;
  }

  for (const [sourceValue, targetRegion] of Object.entries(REGION_MAP)) {
    const result = await prisma.card.updateMany({
      where: { region: sourceValue },
      data: {
        region: targetRegion,
        isRegionalExclusive: true,
      },
    });
    if (result.count > 0) {
      console.log(
        `[update] ${sourceValue} -> ${targetRegion} (${result.count} cards)`
      );
    }
  }
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
