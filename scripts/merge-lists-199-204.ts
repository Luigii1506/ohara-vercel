/**
 * Script de un solo uso: fusiona las carpetas 204 y 199 en una carpeta nueva,
 * sin tocar las carpetas ni cartas originales. Primero coloca todas las
 * cartas de la 204, luego las de la 199. Copia cantidad, precio
 * personalizado (customPrice/customCurrency), condición, notas y estado de
 * venta de cada carta tal cual estaban en su carpeta de origen.
 *
 * Uso:
 *   npx ts-node scripts/merge-lists-199-204.ts            (dry-run, no escribe nada)
 *   npx ts-node scripts/merge-lists-199-204.ts --execute   (aplica los cambios)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_LIST_IDS_IN_ORDER = [204, 199];
const NEW_LIST_NAME = "Fusión 204 + 199";
const NEW_LIST_COLOR = "#8B5CF6";

const dryRun = !process.argv.includes("--execute");

async function main() {
  const lists = await prisma.userList.findMany({
    where: { id: { in: SOURCE_LIST_IDS_IN_ORDER } },
    include: {
      cards: {
        orderBy: [
          { page: "asc" },
          { row: "asc" },
          { column: "asc" },
          { sortOrder: "asc" },
          { createdAt: "asc" },
        ],
      },
    },
  });

  const listsById = new Map(lists.map((l) => [l.id, l]));
  const list204 = listsById.get(204);
  const list199 = listsById.get(199);

  if (!list204 || !list199) {
    throw new Error(
      `No se encontraron ambas carpetas (204: ${!!list204}, 199: ${!!list199}).`
    );
  }

  const newOwnerId = list204.userId;

  if (list204.userId !== list199.userId) {
    console.warn(
      `⚠️  Fusión entre usuarios distintos (204→user ${list204.userId}, 199→user ${list199.userId}). ` +
        `La carpeta nueva quedará bajo el usuario ${newOwnerId} (confirmado).`
    );
  }

  const maxRows = list204.maxRows || list199.maxRows || 3;
  const maxColumns = list204.maxColumns || list199.maxColumns || 3;

  if (
    (list204.maxRows && list199.maxRows && list204.maxRows !== list199.maxRows) ||
    (list204.maxColumns &&
      list199.maxColumns &&
      list204.maxColumns !== list199.maxColumns)
  ) {
    console.warn(
      `⚠️  Tamaños distintos (204: ${list204.maxRows}x${list204.maxColumns}, ` +
        `199: ${list199.maxRows}x${list199.maxColumns}). Usando ${maxRows}x${maxColumns}.`
    );
  }

  const orderedSourceCards = [...list204.cards, ...list199.cards];
  const perPage = maxRows * maxColumns;
  const totalPages = Math.max(1, Math.ceil(orderedSourceCards.length / perPage));

  const sameCurrency = list204.displayCurrency === list199.displayCurrency;
  const displayCurrency = sameCurrency ? list204.displayCurrency : "USD";
  const exchangeRate = sameCurrency ? list204.exchangeRate : null;

  console.log(`Carpeta 204: "${list204.name}" — ${list204.cards.length} cartas`);
  console.log(`Carpeta 199: "${list199.name}" — ${list199.cards.length} cartas`);
  console.log(`Usuario dueño de la nueva carpeta: ${newOwnerId}`);
  console.log(`Total combinado: ${orderedSourceCards.length} cartas`);
  console.log(`Dimensiones destino: ${maxRows}x${maxColumns} → ${totalPages} página(s)`);
  console.log(
    `Moneda destino: ${displayCurrency}${
      exchangeRate ? ` (tipo de cambio ${exchangeRate})` : ""
    }${sameCurrency ? "" : "  [las carpetas origen tenían monedas distintas, se usa USD]"}`
  );
  console.log(`Nueva carpeta: "${NEW_LIST_NAME}" color ${NEW_LIST_COLOR}`);

  const nameTaken = await prisma.userList.findFirst({
    where: { userId: newOwnerId, name: NEW_LIST_NAME },
    select: { id: true },
  });
  if (nameTaken) {
    throw new Error(
      `El usuario ${newOwnerId} ya tiene una carpeta llamada "${NEW_LIST_NAME}" (id ${nameTaken.id}). Cambia NEW_LIST_NAME en el script.`
    );
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No se escribió nada. Corre con --execute para aplicar.");
    return;
  }

  const newListId = await prisma.$transaction(async (tx) => {
    const newList = await tx.userList.create({
      data: {
        userId: newOwnerId,
        name: NEW_LIST_NAME,
        isOrdered: true,
        isDeletable: true,
        isCollection: false,
        isPublic: false,
        hideTcgLink: false,
        color: NEW_LIST_COLOR,
        maxRows,
        maxColumns,
        totalPages,
        displayCurrency,
        exchangeRate: exchangeRate ?? undefined,
      },
    });

    let page = 1;
    let row = 1;
    let col = 1;

    const cardRows = orderedSourceCards.map((sourceCard) => {
      const sortOrder = (page - 1) * perPage + (row - 1) * maxColumns + (col - 1);

      const data = {
        listId: newList.id,
        cardId: sourceCard.cardId,
        quantity: sourceCard.quantity,
        sortOrder,
        page,
        row,
        column: col,
        notes: sourceCard.notes,
        condition: sourceCard.condition,
        customPrice: sourceCard.customPrice ?? undefined,
        customCurrency: sourceCard.customCurrency,
        isSold: sourceCard.isSold,
        soldAt: sourceCard.soldAt,
        soldPrice: sourceCard.soldPrice ?? undefined,
      };

      col++;
      if (col > maxColumns) {
        col = 1;
        row++;
      }
      if (row > maxRows) {
        row = 1;
        page++;
      }

      return data;
    });

    await tx.userListCard.createMany({ data: cardRows });

    return newList.id;
  }, { timeout: 20000 });

  console.log(`\n✅ Carpeta fusionada creada: id=${newListId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
