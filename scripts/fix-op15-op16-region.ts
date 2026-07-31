import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");
const TARGET_REGION = "US";

// Cartas afectadas: code que empieza con OP15 / OP16 y region nula o vacía
const where = {
  AND: [
    {
      OR: [
        { code: { startsWith: "OP15" } },
        { code: { startsWith: "OP16" } },
      ],
    },
    {
      OR: [{ region: null }, { region: "" }],
    },
  ],
};

async function main() {
  const affected = await prisma.card.findMany({
    where,
    select: { id: true, code: true, name: true, region: true, baseCardId: true },
    orderBy: { code: "asc" },
  });

  console.log(
    `🔎 Encontradas ${affected.length} cartas OP15/OP16 con region null/"":`
  );
  for (const c of affected) {
    const tipo = c.baseCardId === null ? "base" : "alt ";
    console.log(`   [${tipo}] ${c.code} — ${c.name} (region=${c.region ?? "null"})`);
  }

  if (!affected.length) {
    console.log("✅ No hay nada que corregir.");
    return;
  }

  if (DRY_RUN) {
    console.log("\n🧪 DRY RUN: no se aplicaron cambios. Quita --dry-run para ejecutar.");
    return;
  }

  const result = await prisma.card.updateMany({
    where,
    data: { region: TARGET_REGION },
  });

  console.log(`\n✅ Actualizadas ${result.count} cartas a region="${TARGET_REGION}".`);
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
