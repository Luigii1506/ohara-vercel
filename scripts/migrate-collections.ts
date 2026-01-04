#!/usr/bin/env ts-node

/**
 * Script de migración: UserList (isCollection=true) -> Collection
 *
 * Este script:
 * 1. Crea una Collection para TODOS los usuarios existentes
 * 2. Migra las cartas de UserList (isCollection=true) a CollectionCard
 * 3. Elimina los UserListCard asociados a colecciones
 * 4. Elimina los UserList con isCollection=true
 *
 * Ejecutar con: npx ts-node scripts/migrate-collections.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Iniciando migración de colecciones...\n");

  // 1. Obtener todos los usuarios
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  console.log(`📊 Total de usuarios: ${users.length}`);

  let collectionsCreated = 0;
  let cardsMigrated = 0;
  let userListsDeleted = 0;

  for (const user of users) {
    // Verificar si ya tiene Collection (por si se ejecuta el script múltiples veces)
    const existingCollection = await prisma.collection.findUnique({
      where: { userId: user.id },
    });

    if (existingCollection) {
      console.log(`⏭️  Usuario ${user.id} ya tiene Collection, saltando...`);
      continue;
    }

    // Buscar UserList con isCollection=true
    const userListCollection = await prisma.userList.findFirst({
      where: {
        userId: user.id,
        isCollection: true,
      },
      include: {
        cards: true,
      },
    });

    // Crear Collection para el usuario
    const newCollection = await prisma.collection.create({
      data: {
        userId: user.id,
        isPublic: userListCollection?.isPublic ?? false,
      },
    });
    collectionsCreated++;

    // Si tenía UserList con cartas, migrarlas
    if (userListCollection && userListCollection.cards.length > 0) {
      const cardsToMigrate = userListCollection.cards.map((card) => ({
        collectionId: newCollection.id,
        cardId: card.cardId,
        quantity: card.quantity,
        notes: card.notes,
        condition: card.condition,
        customPrice: card.customPrice,
        customCurrency: card.customCurrency,
      }));

      await prisma.collectionCard.createMany({
        data: cardsToMigrate,
        skipDuplicates: true,
      });

      cardsMigrated += cardsToMigrate.length;
      console.log(
        `✅ Usuario ${user.id}: Collection creada con ${cardsToMigrate.length} cartas migradas`
      );
    } else {
      console.log(`✅ Usuario ${user.id}: Collection vacía creada`);
    }
  }

  // 3. Eliminar UserListCard de colecciones
  const userListCollectionIds = await prisma.userList.findMany({
    where: { isCollection: true },
    select: { id: true },
  });

  if (userListCollectionIds.length > 0) {
    const deletedCards = await prisma.userListCard.deleteMany({
      where: {
        listId: { in: userListCollectionIds.map((ul) => ul.id) },
      },
    });
    console.log(`\n🗑️  UserListCard eliminadas: ${deletedCards.count}`);
  }

  // 4. Eliminar UserList con isCollection=true
  const deletedUserLists = await prisma.userList.deleteMany({
    where: { isCollection: true },
  });
  userListsDeleted = deletedUserLists.count;

  console.log("\n" + "=".repeat(50));
  console.log("📋 RESUMEN DE MIGRACIÓN");
  console.log("=".repeat(50));
  console.log(`✅ Collections creadas: ${collectionsCreated}`);
  console.log(`✅ Cartas migradas: ${cardsMigrated}`);
  console.log(`🗑️  UserLists eliminadas: ${userListsDeleted}`);
  console.log("\n✨ Migración completada exitosamente!");
}

main()
  .catch((error) => {
    console.error("❌ Error durante la migración:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
