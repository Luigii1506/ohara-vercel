#!/usr/bin/env ts-node

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type Options = {
  rootDir: string;
  dryRun: boolean;
  limit: number | null;
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    rootDir: "/Users/luisencinas/Desktop/Sleeves Real",
    dryRun: args.includes("--dry-run"),
    limit: null,
  };

  for (const arg of args) {
    if (arg.startsWith("--root=")) {
      options.rootDir = arg.split("=")[1] ?? options.rootDir;
    } else if (arg.startsWith("--limit=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isNaN(value) && value > 0) {
        options.limit = value;
      }
    }
  }

  return options;
};

const naturalSort = (a: string, b: string) =>
  a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

const prisma = new PrismaClient();

const main = async () => {
  const options = parseArgs();

  if (!fs.existsSync(options.rootDir)) {
    throw new Error(`Root directory not found: ${options.rootDir}`);
  }

  const folders = fs
    .readdirSync(options.rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(naturalSort);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const folderName of folders) {
    if (options.limit !== null && created >= options.limit) {
      console.log(`[limit] Reached limit ${options.limit}`);
      break;
    }

    const products = await prisma.product.findMany({
      where: {
        name: { startsWith: `${folderName} - ` },
        productType: "SLEEVE",
      },
      select: {
        id: true,
        imageUrl: true,
        thumbnailUrl: true,
        setId: true,
      },
      orderBy: { id: "asc" },
    });

    if (products.length === 0) {
      skipped += 1;
      console.log(`[skip] ${folderName} (no products)`);
      continue;
    }

    const image = products[0].imageUrl || products[0].thumbnailUrl;
    if (!image) {
      skipped += 1;
      console.log(`[skip] ${folderName} (no image for set)`);
      continue;
    }

    const existingSet = await prisma.set.findFirst({
      where: { title: folderName },
      select: { id: true },
    });

    if (options.dryRun) {
      console.log(
        `[dry-run] set=${folderName} products=${products.length} existing=${Boolean(
          existingSet
        )}`
      );
      created += 1;
      continue;
    }

    let setId: number;
    if (existingSet) {
      setId = existingSet.id;
      updated += 1;
    } else {
      const createdSet = await prisma.set.create({
        data: {
          title: folderName,
          image,
          releaseDate: new Date(),
          isOpen: false,
        },
        select: { id: true },
      });
      setId = createdSet.id;
      created += 1;
    }

    const productIds = products.map((product) => product.id);
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { setId },
    });

    console.log(
      `[link] ${folderName} -> setId=${setId} products=${products.length}`
    );
  }

  console.log(
    `[summary] setsCreated=${created} setsExisting=${updated} skipped=${skipped}`
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
