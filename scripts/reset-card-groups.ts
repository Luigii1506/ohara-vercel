#!/usr/bin/env ts-node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  const variantLinks = await prisma.cardVariantLink.deleteMany({});
  const groupLinks = await prisma.cardGroupLink.deleteMany({});
  const variantGroups = await prisma.cardVariantGroup.deleteMany({});
  const groups = await prisma.cardGroup.deleteMany({});

  console.log(
    `[summary] deleted variantLinks=${variantLinks.count} groupLinks=${groupLinks.count} variantGroups=${variantGroups.count} groups=${groups.count}`
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
