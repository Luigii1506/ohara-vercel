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
    rootDir: path.join("public", "assets", "Sleeves Real"),
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

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const toPublicUrl = (rootDir: string, filePath: string) => {
  const relative = path.relative("public", filePath);
  const urlPath = `/${relative.split(path.sep).join("/")}`;
  return encodeURI(urlPath);
};

const naturalSort = (a: string, b: string) =>
  a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

const prisma = new PrismaClient();

const main = async () => {
  const options = parseArgs();
  const rootDir = options.rootDir;

  if (!fs.existsSync(rootDir)) {
    throw new Error(`Root directory not found: ${rootDir}`);
  }

  const folderEntries = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(naturalSort);

  let created = 0;
  let skipped = 0;

  for (const folderName of folderEntries) {
    const folderPath = path.join(rootDir, folderName);
    const files = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort(naturalSort);

    if (files.length === 0) {
      continue;
    }

    for (let index = 0; index < files.length; index += 1) {
      const filename = files[index];
      if (options.limit !== null && created >= options.limit) {
        console.log(`[limit] Reached limit ${options.limit}`);
        console.log(`[summary] created=${created} skipped=${skipped}`);
        return;
      }

      const displayIndex = index + 1;
      const productName = `${folderName} - ${displayIndex}`;
      const imagePath = path.join(folderPath, filename);
      const publicUrl = toPublicUrl(rootDir, imagePath);

      const existing = await prisma.product.findFirst({
        where: { name: productName },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        console.log(`[skip] ${productName} (exists id=${existing.id})`);
        continue;
      }

      if (options.dryRun) {
        console.log(`[dry-run] create ${productName} -> ${publicUrl}`);
        created += 1;
        continue;
      }

      const createdProduct = await prisma.product.create({
        data: {
          name: productName,
          productType: "SLEEVE" as any,
          imageUrl: publicUrl,
          thumbnailUrl: publicUrl,
          metadata: {
            source: "public-assets",
            folder: folderName,
            filename,
            index: displayIndex,
            total: files.length,
          },
        },
      });

      created += 1;
      console.log(`[create] ${productName} (id=${createdProduct.id})`);
    }
  }

  console.log(`[summary] created=${created} skipped=${skipped}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
