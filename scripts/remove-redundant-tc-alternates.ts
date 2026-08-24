import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const affected = require("./tc-wrong-image-affected.json") as { id: number }[];

// Estas filas son duplicados puros generados por la carrera de concurrencia
// en applyOfficialItem: al crear la base sintética le puso el NOMBRE de la
// alterna real ("...(異圖卡)") pero la IMAGEN de la base. La alterna real
// (con su imagen distinta correcta) ya existe como hermana — verificado
// para las 136, cada una tiene un hermano con imagen genuinamente distinta.
// Estas filas no aportan información: son seguras de borrar.
async function main() {
  let deleted = 0;
  let skipped = 0;
  const skippedIds: number[] = [];

  for (const { id } of affected) {
    const stillHasChildren = await prisma.card.count({ where: { baseCardId: id } });
    if (stillHasChildren > 0) {
      skipped += 1;
      skippedIds.push(id);
      continue;
    }
    await prisma.card.delete({ where: { id } });
    deleted += 1;
  }

  console.log({ total: affected.length, deleted, skipped });
  if (skippedIds.length) console.log("saltadas (tenían hijos, requieren revisión):", skippedIds);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
