#!/usr/bin/env -S ts-node --project tsconfig.scripts.json

import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "../lib/prisma";

function loadEnvFiles() {
  const envFiles = [".env", ".env.local"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      loadEnv({ path: fullPath, override: true });
    }
  }
}

async function main() {
  loadEnvFiles();

  console.log("[find-duplicate-tcg-links] Searching for duplicate product IDs…");

  const duplicates = await prisma.card.groupBy({
    by: ["tcgplayerProductId"],
    where: { tcgplayerProductId: { not: null } },
    _count: { tcgplayerProductId: true },
  });

  const duplicateEntries = duplicates.filter(
    (entry) => (entry._count?.tcgplayerProductId ?? 0) > 1
  );

  if (!duplicateEntries.length) {
    console.log("[find-duplicate-tcg-links] No duplicates found ✅");
    return;
  }

  for (const entry of duplicateEntries) {
    const productId = entry.tcgplayerProductId;
    if (!productId) continue;

    const cards = await prisma.card.findMany({
      where: { tcgplayerProductId: productId },
      select: {
        id: true,
        name: true,
        code: true,
        setCode: true,
        tcgplayerLinkStatus: true,
        tcgUrl: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    });

    const count = entry._count?.tcgplayerProductId ?? 0;
    console.log(`\nProduct ID ${productId} has ${count} linked cards:`);
    cards.forEach((card) => {
      console.log(
        `  - Card #${card.id} | ${card.code} | ${card.name} | set ${card.setCode} | status=${card.tcgplayerLinkStatus} | tcgUrl=${card.tcgUrl ?? "—"}`
      );
    });
  }
}

main()
  .catch((error) => {
    console.error("[find-duplicate-tcg-links] Failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
