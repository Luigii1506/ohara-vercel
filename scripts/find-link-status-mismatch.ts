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
  console.log("[find-link-status-mismatch] Auditing cards…");

  const linkedWithoutProduct = await prisma.card.findMany({
    where: {
      tcgplayerLinkStatus: true,
      OR: [
        { tcgplayerProductId: null },
        { tcgplayerProductId: "" },
      ],
    },
    select: {
      id: true,
      name: true,
      code: true,
      setCode: true,
      tcgplayerProductId: true,
    },
    orderBy: { id: "asc" },
  });

  const productWithoutStatus = await prisma.card.findMany({
    where: {
      tcgplayerProductId: { not: null },
      OR: [
        { tcgplayerLinkStatus: null },
        { tcgplayerLinkStatus: false },
      ],
    },
    select: {
      id: true,
      name: true,
      code: true,
      setCode: true,
      tcgplayerProductId: true,
      tcgplayerLinkStatus: true,
    },
    orderBy: { id: "asc" },
  });

  if (linkedWithoutProduct.length === 0) {
    console.log("✅ No cards linked without productId.");
  } else {
    console.warn(
      `⚠️ ${linkedWithoutProduct.length} cards have tcgplayerLinkStatus=true but no productId:`
    );
    linkedWithoutProduct.forEach((card) => {
      console.log(
        `  - #${card.id} ${card.code} ${card.name} (set ${card.setCode}) productId=${card.tcgplayerProductId}`
      );
    });
  }

  if (productWithoutStatus.length === 0) {
    console.log("✅ No cards with productId but missing link status.");
  } else {
    console.warn(
      `⚠️ ${productWithoutStatus.length} cards have productId but linkStatus=${productWithoutStatus[0].tcgplayerLinkStatus}:`
    );
    productWithoutStatus.forEach((card) => {
      console.log(
        `  - #${card.id} ${card.code} ${card.name} (set ${card.setCode}) productId=${card.tcgplayerProductId} status=${card.tcgplayerLinkStatus}`
      );
    });
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("[find-link-status-mismatch] Failed", error);
  prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
});
