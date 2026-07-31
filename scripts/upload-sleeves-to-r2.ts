#!/usr/bin/env ts-node

import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

type Options = {
  rootDir: string;
  dryRun: boolean;
  limit: number | null;
  updateExisting: boolean;
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    rootDir: "/Users/luisencinas/Desktop/Sleeves Real",
    dryRun: args.includes("--dry-run"),
    limit: null,
    updateExisting: args.includes("--update-existing"),
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

const sanitizeForFilename = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const naturalSort = (a: string, b: string) =>
  a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

const resolvePublicUrl = (baseUrl: string, key: string) => {
  if (!baseUrl) return key;
  return `${baseUrl.replace(/\/+$/, "")}/${key}`;
};

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "ohara";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

const uploadImageToR2 = async (filePath: string, filename: string) => {
  const buffer = await fs.promises.readFile(filePath);
  const webp = await sharp(buffer).webp({ quality: 85 }).toBuffer();
  const key = `products/${filename}.webp`;

  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
  } catch {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: webp,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  }

  return {
    publicUrl: resolvePublicUrl(PUBLIC_URL, key),
    imageKey: key,
  };
};

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
  let skipped = 0;
  let updated = 0;

  for (const folderName of folders) {
    const folderPath = path.join(options.rootDir, folderName);
    const files = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort(naturalSort);

    if (files.length === 0) continue;

    for (let index = 0; index < files.length; index += 1) {
      if (options.limit !== null && created >= options.limit) {
        console.log(`[limit] Reached limit ${options.limit}`);
        console.log(`[summary] created=${created} skipped=${skipped}`);
        return;
      }

      const filename = files[index];
      const displayIndex = index + 1;
      const productName = `${folderName} - ${displayIndex}`;

      const existingRecord = await prisma.product.findFirst({
        where: { name: productName },
        select: { id: true },
      });
      const existingId =
        existingRecord && typeof existingRecord.id === "number"
          ? existingRecord.id
          : null;

      const filePath = path.join(folderPath, filename);
      const uploadName = sanitizeForFilename(productName);

      if (options.dryRun) {
        console.log(`[dry-run] ${productName} -> ${filePath}`);
        created += 1;
        continue;
      }

      const uploaded = await uploadImageToR2(filePath, uploadName);

      if (existingId) {
        if (!options.updateExisting) {
          skipped += 1;
          console.log(`[skip] ${productName} (exists id=${existingId})`);
          continue;
        }
        await prisma.product.update({
          where: { id: existingId },
          data: {
            imageUrl: uploaded.publicUrl,
            imageKey: uploaded.imageKey,
          },
        });
        updated += 1;
        console.log(`[update] ${productName} (id=${existingId})`);
        continue;
      }

      const createdProduct = await prisma.product.create({
        data: {
          name: productName,
          productType: "SLEEVE" as any,
          imageUrl: uploaded.publicUrl,
          imageKey: uploaded.imageKey,
          metadata: {
            source: "desktop-sleeves",
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

  console.log(
    `[summary] created=${created} updated=${updated} skipped=${skipped}`
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
