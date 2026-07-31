import { prisma } from "../lib/prisma";

async function main() {
  const tournamentId = parseInt(process.argv[2], 10);

  if (isNaN(tournamentId)) {
    console.log("Usage: npm run debug:tournament <tournamentId>");
    process.exit(1);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      source: true,
      decks: {
        orderBy: {
          standing: "asc",
        },
        include: {
          deck: {
            select: {
              id: true,
              name: true,
            },
          },
          leaderCard: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
  });

  if (!tournament) {
    console.log(`Tournament ${tournamentId} not found`);
    process.exit(1);
  }

  console.log(`\n📊 Tournament: ${tournament.name}`);
  console.log(`📅 Date: ${tournament.eventDate}`);
  console.log(`👥 Player Count: ${tournament.playerCount}`);
  console.log(`\n🎴 Decks (${tournament.decks.length} total):\n`);

  tournament.decks.forEach((deck, index) => {
    console.log(
      `${index + 1}. ${deck.playerName} - Standing: ${deck.standing || "N/A"} - Leader: ${deck.leaderCard?.name || "N/A"} - Deck: ${deck.deck?.name || "N/A"}`
    );
  });

  console.log(`\n✅ Total decks found: ${tournament.decks.length}`);
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
