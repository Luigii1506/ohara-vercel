import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PREFIXES: Record<string, number> = {
  OP: 0,
  EB: 1,
  ST: 2,
  P: 3,
  PRB: 4,
};

const digitsRegex = /\d+/g;

const getPrefixIndex = (code: string, category?: string | null) => {
  if (category === "DON") return 5;
  const upper = code?.toUpperCase() ?? "";
  const prefix = upper.slice(0, 3).replace(/[^A-Z]/g, "");
  if (prefix in PREFIXES) return PREFIXES[prefix];
  if (upper.startsWith("PRB")) return PREFIXES.PRB;
  return PREFIXES[upper.slice(0, 2)] ?? 6;
};

const normalizeCodeSegment = (code: string) =>
  (code ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .replace(digitsRegex, (match) => match.padStart(4, "0"));

const normalizeAlternateOrder = (order?: string | null) => {
  if (!order) return "zzzz";
  const trimmed = order.trim();
  if (!trimmed) return "zzzz";
  const numeric = trimmed.match(/^\d+/);
  if (numeric) {
    return numeric[0].padStart(4, "0");
  }
  return trimmed.padStart(4, "0");
};

const buildCollectionOrder = (card: {
  id: number;
  code: string;
  category?: string | null;
  baseCardId?: number | null;
  order?: string | null;
}) => {
  const prefixIndex = getPrefixIndex(card.code, card.category);
  const normalizedCode = normalizeCodeSegment(card.code);
  const isBaseCard =
    card.baseCardId === null || card.baseCardId === undefined;
  const suffix = isBaseCard
    ? "00"
    : `10_${normalizeAlternateOrder(card.order)}_${String(
        card.baseCardId ?? ""
      ).padStart(6, "0")}`;

  return `${prefixIndex.toString().padStart(2, "0")}_${normalizedCode}_${suffix}_${card.id
    .toString()
    .padStart(6, "0")}`;
};

const CHUNK_SIZE = 500;

async function backfillCollectionOrder() {
  console.log("🚀 Calculando collectionOrder para cartas...");
  const total = await prisma.card.count();
  let processed = 0;
  let cursor: number | null = null;

  while (true) {
    const cards: {
      id: number;
      code: string;
      category: string | null;
      order: string | null;
      baseCardId: number | null;
    }[] = await prisma.card.findMany({
      take: CHUNK_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        code: true,
        category: true,
        order: true,
        baseCardId: true,
      },
    });

    if (!cards.length) break;

    await prisma.$transaction(
      cards.map((card) =>
        prisma.card.update({
          where: { id: card.id },
          data: {
            collectionOrder: buildCollectionOrder(card),
          },
        })
      )
    );

    processed += cards.length;
    cursor = cards[cards.length - 1].id;
    console.log(`✅ Procesadas ${processed}/${total}`);
  }

  console.log("🎉 collectionOrder actualizado para todas las cartas");
}

backfillCollectionOrder()
  .catch((error) => {
    console.error("❌ Error al actualizar collectionOrder:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
