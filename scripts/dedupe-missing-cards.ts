#!/usr/bin/env -S npx tsx
/**
 * Backfill de `canonicalKey` en MissingCard + fusión de duplicados cross-evento.
 *
 * La misma carta física premiada en varios eventos generaba un MissingCard por
 * evento (el `title` traía el nombre/fecha del evento). Ahora computamos una
 * identidad canónica (`CÓDIGO|variante`) independiente del evento y colapsamos
 * los duplicados a un solo MissingCard con múltiples EventMissingCard.
 *
 *   npx tsx scripts/dedupe-missing-cards.ts           # dry-run
 *   npx tsx scripts/dedupe-missing-cards.ts --apply    # aplica
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { buildCardIdentityKey } from "../lib/services/tcgplayerCardData";

const APPLY = process.argv.includes("--apply");

async function main() {
  const cards = await prisma.missingCard.findMany({
    include: {
      events: { select: { id: true, eventId: true, event: { select: { title: true } } } },
    },
  });
  console.log(`MissingCard totales: ${cards.length}`);

  // Computa canonicalKey por carta (título de sus eventos + su propio título).
  const keyed = cards.map((c) => {
    const eventTitles = c.events.map((e) => e.event.title).filter(Boolean).join(" ");
    const canonicalKey = buildCardIdentityKey(c.code, c.title, eventTitles);
    return { ...c, canonicalKey };
  });

  // Agrupa por canonicalKey.
  const groups = new Map<string, typeof keyed>();
  for (const c of keyed) {
    const arr = groups.get(c.canonicalKey) ?? [];
    arr.push(c);
    groups.set(c.canonicalKey, arr);
  }

  let dupGroups = 0;
  let removed = 0;
  let relinked = 0;
  let keyUpdates = 0;

  for (const [canonicalKey, group] of Array.from(groups.entries())) {
    // Sobreviviente: prefiere el que tiene imagen; a igualdad, el id más chico.
    const survivor = group
      .slice()
      .sort((a, b) => {
        const ai = a.imageUrl ? 0 : 1;
        const bi = b.imageUrl ? 0 : 1;
        return ai - bi || a.id - b.id;
      })[0];

    // Set canonicalKey del sobreviviente SIEMPRE (idempotente), y rellena
    // imagen si le falta y algún duplicado la tiene.
    const fillImage =
      !survivor.imageUrl
        ? group.find((g) => g.imageUrl)?.imageUrl ?? ""
        : survivor.imageUrl;
    const needsUpdate =
      survivor.canonicalKey !== canonicalKey || fillImage !== survivor.imageUrl;
    if (needsUpdate) keyUpdates++;
    if (APPLY) {
      await prisma.missingCard.update({
        where: { id: survivor.id },
        data: { canonicalKey, imageUrl: fillImage || undefined },
      });
    }

    const dups = group.filter((g) => g.id !== survivor.id);
    if (dups.length === 0) continue;
    dupGroups++;

    // Eventos ya ligados al sobreviviente (para no violar el unique al re-apuntar).
    const survivorEventIds = new Set(survivor.events.map((e) => e.eventId));

    for (const dup of dups) {
      for (const link of dup.events) {
        if (survivorEventIds.has(link.eventId)) {
          // Ya existe el link (eventId, survivor) → borra el duplicado.
          if (APPLY) {
            await prisma.eventMissingCard.delete({ where: { id: link.id } });
          }
        } else {
          // Re-apunta el link al sobreviviente.
          relinked++;
          survivorEventIds.add(link.eventId);
          if (APPLY) {
            await prisma.eventMissingCard.update({
              where: { id: link.id },
              data: { missingCardId: survivor.id },
            });
          }
        }
      }
      removed++;
      if (APPLY) {
        await prisma.missingCard.delete({ where: { id: dup.id } });
      }
    }
  }

  console.log(`\n${APPLY ? "✅ APLICADO" : "[DRY-RUN]"}`);
  console.log(`  Grupos con duplicados: ${dupGroups}`);
  console.log(`  MissingCard fusionados (borrados): ${removed}`);
  console.log(`  Links re-apuntados al sobreviviente: ${relinked}`);
  console.log(`  canonicalKey/imagen actualizados: ${keyUpdates}`);
  console.log(`  MissingCard resultantes: ${cards.length - (APPLY ? removed : 0)} (esperado ${groups.size})`);
  if (!APPLY) console.log(`\nCorre con --apply para aplicar.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
