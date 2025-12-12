/**
 * Script para resetear todos los eventos y sus datos relacionados
 *
 * Este script elimina:
 * - Todos los eventos (Event)
 * - EventSet (relación evento-set) - CASCADE
 * - EventCard (relación evento-carta) - CASCADE
 * - EventMissingSet (sets faltantes detectados) - CASCADE
 *
 * Uso:
 *   npm run reset:events
 *   o
 *   npx ts-node scripts/reset-events.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetEvents() {
  console.log('🔄 Iniciando reset de eventos...\n');

  try {
    // Obtener estadísticas antes de eliminar
    const eventCount = await prisma.event.count();
    const eventSetCount = await prisma.eventSet.count();
    const eventCardCount = await prisma.eventCard.count();
    const missingSetLinkCount = await prisma.eventMissingSet.count();
    const canonicalMissingSetCount = await prisma.missingSet.count();
    const missingCardCount = await prisma.eventMissingCard.count();
    const canonicalMissingCardCount = await prisma.missingCard.count();

    console.log('📊 Estadísticas actuales:');
    console.log(`   - Eventos: ${eventCount}`);
    console.log(`   - EventSets: ${eventSetCount}`);
    console.log(`   - EventCards: ${eventCardCount}`);
    console.log(`   - MissingSet links: ${missingSetLinkCount}`);
    console.log(`   - MissingSets únicos: ${canonicalMissingSetCount}`);
    console.log(`   - MissingCards: ${missingCardCount}`);
    console.log(`   - MissingCards únicos: ${canonicalMissingCardCount}`);
    console.log();

    // Confirmar acción (comentar esta sección si quieres ejecutar sin confirmación)
    console.log('⚠️  ADVERTENCIA: Esta acción eliminará TODOS los eventos y datos relacionados.');
    console.log('   Esta acción NO se puede deshacer.\n');

    // Esperar 3 segundos para que el usuario pueda cancelar con Ctrl+C
    console.log('⏳ Iniciando eliminación en 3 segundos... (Ctrl+C para cancelar)');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('⏳ 2...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('⏳ 1...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log();

    console.log('🗑️  Eliminando datos relacionados con eventos...');

    const deletedEventCards = await prisma.eventCard.deleteMany({});
    const deletedEventSets = await prisma.eventSet.deleteMany({});
    const deletedMissingCardLinks = await prisma.eventMissingCard.deleteMany({});
    const deletedMissingSetLinks = await prisma.eventMissingSet.deleteMany({});
    const deletedMissingCards = await prisma.missingCard.deleteMany({});
    const deletedEvents = await prisma.event.deleteMany({});
    const deletedMissingSets = await prisma.missingSet.deleteMany({});

    console.log('✅ Eliminación completada:');
    console.log(`   - Eventos eliminados: ${deletedEvents.count}`);
    console.log(`   - EventSets eliminados: ${deletedEventSets.count}`);
    console.log(`   - EventCards eliminados: ${deletedEventCards.count}`);
    console.log(`   - MissingCard links eliminados: ${deletedMissingCardLinks.count}`);
    console.log(`   - MissingSet links eliminados: ${deletedMissingSetLinks.count}`);
    console.log(`   - MissingCards únicos eliminados: ${deletedMissingCards.count}`);
    console.log(`   - MissingSets únicos eliminados: ${deletedMissingSets.count}`);
    console.log();
    console.log('🎉 Reset completado exitosamente!');

  } catch (error) {
    console.error('❌ Error durante el reset:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
resetEvents()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
