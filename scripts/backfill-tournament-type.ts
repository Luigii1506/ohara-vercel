import { TournamentType } from "@prisma/client";
import { prisma } from "../lib/prisma";

const detectTournamentType = (name?: string | null): TournamentType | null => {
  if (!name) return null;
  const normalized = name.toLowerCase();
  if (/\bregional(s)?\b/.test(normalized)) {
    return TournamentType.REGIONAL;
  }
  if (/treasure\s*cup/.test(normalized)) {
    return TournamentType.TREASURE_CUP;
  }
  if (/\bchampionship(s)?\b/.test(normalized)) {
    return TournamentType.CHAMPIONSHIP;
  }
  return null;
};

async function main() {
  const tournaments = await prisma.tournament.findMany({
    where: { type: null },
    select: { id: true, name: true },
  });

  let updated = 0;

  for (const tournament of tournaments) {
    const type = detectTournamentType(tournament.name);
    if (!type) continue;
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { type },
    });
    updated += 1;
  }

  console.log(
    `Backfill done. Updated ${updated} tournaments out of ${tournaments.length}.`
  );
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
