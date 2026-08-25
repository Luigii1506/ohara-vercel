import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { createS3Client, uploadCardImage } from "@/lib/services/krOfficialSync";

// P-001/KR se creó hace tiempo con el arte de "P1" (primer plano) guardado
// como si fuera la carta BASE — el sitio real tiene 3 impresiones separadas
// para este slot: base (golpe de cuerpo completo, "Promotion Pack 2024"),
// P1 (primer plano, "Promotion Card Set") y P2 (a lomos de un jabalí,
// también "Promotion Card Set"). P2 ya se creó bien esta corrida, pero
// colgada de la fila equivocada (la que en realidad es P1).
const TRUE_BASE_IMAGE_URL =
  "https://onepiece-cardgame.kr/fileDownload?downname=202403211121434293";

const PREFIX_INDEX_P = 3; // "P" cae en el mismo bucket de promos que el resto

const normalizeCodeSegment = (value: string) =>
  value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/\d+/g, (match) => match.padStart(4, "0"));

const buildCollectionOrder = (card: {
  id: number;
  code: string;
  baseCardId: number | null;
  order: string;
}) => {
  const normalizedCode = normalizeCodeSegment(card.code);
  const isBaseCard = card.baseCardId === null;
  const suffix = isBaseCard
    ? "00"
    : `10_${card.order.padStart(4, "0")}_${String(card.baseCardId ?? "").padStart(6, "0")}`;
  return `${PREFIX_INDEX_P.toString().padStart(2, "0")}_${normalizedCode}_${suffix}_${card.id
    .toString()
    .padStart(6, "0")}`;
};

async function main() {
  const mislabeled = await prisma.card.findUnique({
    where: { id: 17531 },
    include: {
      colors: true,
      types: true,
      effects: true,
      conditions: true,
      texts: true,
      sets: true,
    },
  });
  if (!mislabeled) throw new Error("Card 17531 not found — aborting.");
  if (!mislabeled.isFirstEdition || mislabeled.baseCardId !== null) {
    throw new Error(
      "Card 17531 ya no tiene la forma esperada (isFirstEdition/baseCardId) — revisar a mano antes de continuar."
    );
  }

  console.log("[1/6] Subiendo la imagen real de la base (golpe de cuerpo completo)...");
  const s3Client = createS3Client();
  const bucketName = process.env.R2_BUCKET_NAME!;
  const publicUrl = process.env.R2_PUBLIC_URL!;
  const { src: newBaseSrc } = await uploadCardImage(
    { id: "P-001", imageUrl: TRUE_BASE_IMAGE_URL },
    { region: "KR" },
    s3Client,
    bucketName,
    publicUrl
  );
  console.log("  ->", newBaseSrc);

  console.log("[2/6] Creando la fila de la base real...");
  const created = await prisma.card.create({
    data: {
      src: newBaseSrc,
      name: mislabeled.name,
      code: mislabeled.code,
      setCode: mislabeled.setCode,
      category: mislabeled.category,
      rarity: mislabeled.rarity,
      attribute: mislabeled.attribute,
      cost: mislabeled.cost,
      power: mislabeled.power,
      counter: mislabeled.counter,
      life: mislabeled.life,
      triggerCard: mislabeled.triggerCard,
      isFirstEdition: true,
      baseCardId: null,
      alias: "0",
      order: "0",
      region: mislabeled.region,
      language: mislabeled.language,
    },
    select: { id: true },
  });
  console.log("  -> nueva carta base id =", created.id);

  if (mislabeled.colors.length) {
    await prisma.cardColor.createMany({
      data: mislabeled.colors.map((c) => ({ cardId: created.id, color: c.color })),
    });
  }
  if (mislabeled.types.length) {
    await prisma.cardType.createMany({
      data: mislabeled.types.map((t) => ({ cardId: created.id, type: t.type })),
    });
  }
  if (mislabeled.effects.length) {
    await prisma.cardEffect.createMany({
      data: mislabeled.effects.map((e) => ({ cardId: created.id, effect: e.effect })),
    });
  }
  if (mislabeled.conditions.length) {
    await prisma.cardCondition.createMany({
      data: mislabeled.conditions.map((c) => ({ cardId: created.id, condition: c.condition })),
    });
  }
  if (mislabeled.texts.length) {
    await prisma.cardText.createMany({
      data: mislabeled.texts.map((t) => ({ cardId: created.id, text: t.text })),
    });
  }
  if (mislabeled.sets.length) {
    await prisma.cardSet.createMany({
      data: mislabeled.sets.map((s) => ({ cardId: created.id, setId: s.setId })),
    });
  }
  console.log("  -> relaciones (colores/tipos/efectos/condiciones/textos/sets) copiadas.");

  console.log("[3/6] Convirtiendo la fila 17531 en la alterna P1 real...");
  await prisma.card.update({
    where: { id: 17531 },
    data: {
      isFirstEdition: false,
      baseCardId: created.id,
      alias: "P1",
      order: "P1",
      collectionOrder: buildCollectionOrder({
        id: 17531,
        code: "P-001",
        baseCardId: created.id,
        order: "P1",
      }),
    },
  });

  console.log("[4/6] Fijando collectionOrder de la nueva base...");
  await prisma.card.update({
    where: { id: created.id },
    data: {
      collectionOrder: buildCollectionOrder({
        id: created.id,
        code: "P-001",
        baseCardId: null,
        order: "0",
      }),
    },
  });

  console.log("[5/6] Re-colgando P2 (id=30861) de la base real...");
  const p2 = await prisma.card.findUnique({ where: { id: 30861 } });
  if (p2 && p2.baseCardId === 17531) {
    await prisma.card.update({
      where: { id: 30861 },
      data: {
        baseCardId: created.id,
        collectionOrder: buildCollectionOrder({
          id: 30861,
          code: "P-001",
          baseCardId: created.id,
          order: p2.order || "P2",
        }),
      },
    });
  } else {
    console.log("  -> P2 no estaba donde se esperaba, no se tocó (revisar a mano).");
  }

  console.log("[6/6] Corrigiendo CardSource...");
  // sourceId="P-001" (sin sufijo) apunta a la carta real desde ahora.
  await prisma.cardSource.updateMany({
    where: { source: "KR", sourceId: "P-001" },
    data: { cardId: created.id },
  });
  // sourceId="P-001_P1" ya apunta a 17531 — solo le llenamos la URL para que
  // la detección de "imagen cambiada" funcione a futuro.
  await prisma.cardSource.updateMany({
    where: { source: "KR", sourceId: "P-001_P1" },
    data: { sourceImageUrl: mislabeled.src },
  });

  console.log("\nListo. P-001/KR ahora tiene:");
  console.log(`  base   -> id=${created.id} (${newBaseSrc})`);
  console.log(`  P1     -> id=17531 (${mislabeled.src})`);
  console.log(`  P2     -> id=30861`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
