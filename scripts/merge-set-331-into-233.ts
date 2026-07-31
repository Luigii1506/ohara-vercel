import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Merge del set SOURCE dentro de TARGET, conservando TARGET y eliminando SOURCE.
// Caso: 331 (OP14-EB04, aporta FR + reprints EB04) -> 233 (OP14, canónico).
const SOURCE_SET_ID = 331;
const TARGET_SET_ID = 233;

const APPLY = process.argv.includes("--apply");

async function main() {
  const [source, target] = await Promise.all([
    prisma.set.findUnique({ where: { id: SOURCE_SET_ID }, select: { id: true, code: true, title: true } }),
    prisma.set.findUnique({ where: { id: TARGET_SET_ID }, select: { id: true, code: true, title: true } }),
  ]);
  if (!source) throw new Error(`Set origen ${SOURCE_SET_ID} no existe`);
  if (!target) throw new Error(`Set destino ${TARGET_SET_ID} no existe`);

  console.log(`Origen : ${source.id} (${source.code}) "${source.title}"`);
  console.log(`Destino: ${target.id} (${target.code}) "${target.title}"`);

  // Seguridad: solo CardSet debe referenciar al origen.
  const [evCount, prodCount] = await Promise.all([
    prisma.eventSet.count({ where: { setId: SOURCE_SET_ID } }),
    prisma.product.count({ where: { setId: SOURCE_SET_ID } }),
  ]);
  if (evCount > 0 || prodCount > 0) {
    throw new Error(
      `El set origen tiene otras relaciones (EventSet=${evCount}, Product=${prodCount}). Revisar antes de continuar.`
    );
  }

  const sourceLinks = await prisma.cardSet.findMany({
    where: { setId: SOURCE_SET_ID },
    select: { cardId: true },
  });
  const targetCardIds = new Set(
    (await prisma.cardSet.findMany({ where: { setId: TARGET_SET_ID }, select: { cardId: true } })).map((l) => l.cardId)
  );

  // cardIds del origen que aún NO están en destino (deduplicado por cardId).
  const toCreate = Array.from(
    new Set(sourceLinks.map((l) => l.cardId).filter((id) => !targetCardIds.has(id)))
  );
  const alreadyLinked = sourceLinks.length - toCreate.length;

  console.log(`\nLinks en origen: ${sourceLinks.length}`);
  console.log(`  ya ligados a destino (se descartan): ${alreadyLinked}`);
  console.log(`  nuevos a crear en destino: ${toCreate.length}`);
  console.log(`Destino pasaría de ${targetCardIds.size} a ${targetCardIds.size + toCreate.length} links.`);

  if (!APPLY) {
    console.log("\n🧪 DRY RUN: no se escribió nada. Ejecuta con --apply para aplicar.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (toCreate.length) {
      await tx.cardSet.createMany({
        data: toCreate.map((cardId) => ({ cardId, setId: TARGET_SET_ID })),
      });
    }
    const del = await tx.cardSet.deleteMany({ where: { setId: SOURCE_SET_ID } });
    await tx.set.delete({ where: { id: SOURCE_SET_ID } });
    console.log(`\n✅ Creados ${toCreate.length} links en ${TARGET_SET_ID}, eliminados ${del.count} links de ${SOURCE_SET_ID}, set ${SOURCE_SET_ID} borrado.`);
  });

  const finalCount = await prisma.cardSet.count({ where: { setId: TARGET_SET_ID } });
  console.log(`Destino ${TARGET_SET_ID} ahora tiene ${finalCount} links.`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
