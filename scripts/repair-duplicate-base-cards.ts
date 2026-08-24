import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Candidate = { id: number; childCount: number };
type Group = {
  region: string;
  code: string;
  classification: "exact_duplicate" | "mislabeled_alternate" | "unclear";
  suggestedKeepId: number | null;
  candidates: Candidate[];
};

async function main() {
  const report = JSON.parse(
    readFileSync("scripts/duplicate-base-cards-report.json", "utf-8")
  ) as { groups: Group[] };

  console.log(
    APPLY
      ? "*** APLICANDO cambios reales ***"
      : "*** DRY RUN — no se escribe nada (usa --apply para ejecutar) ***"
  );

  let deleted = 0;
  let convertedToAlternate = 0;
  let childrenReparented = 0;
  let groupsProcessed = 0;
  let groupsFailed = 0;
  const failures: { region: string; code: string; error: string }[] = [];

  for (const g of report.groups) {
    if (g.classification === "unclear" || g.suggestedKeepId === null) {
      groupsFailed += 1;
      failures.push({ region: g.region, code: g.code, error: "unclear/no keep id" });
      continue;
    }

    const survivorId = g.suggestedKeepId;
    const losers = g.candidates.filter((c) => c.id !== survivorId);

    try {
      if (APPLY) {
        await prisma.$transaction(async (tx) => {
          for (const loser of losers) {
            const moved = await tx.card.updateMany({
              where: { baseCardId: loser.id },
              data: { baseCardId: survivorId },
            });
            childrenReparented += moved.count;

            if (g.classification === "exact_duplicate") {
              await tx.card.delete({ where: { id: loser.id } });
              deleted += 1;
            } else {
              await tx.card.update({
                where: { id: loser.id },
                data: { baseCardId: survivorId, isFirstEdition: false },
              });
              convertedToAlternate += 1;
            }
          }
        });
      } else {
        for (const loser of losers) {
          childrenReparented += loser.childCount;
          if (g.classification === "exact_duplicate") deleted += 1;
          else convertedToAlternate += 1;
        }
      }
      groupsProcessed += 1;
    } catch (err) {
      groupsFailed += 1;
      failures.push({ region: g.region, code: g.code, error: String(err) });
    }
  }

  console.log({
    groupsProcessed,
    groupsFailed,
    cardsDeleted: deleted,
    cardsConvertedToAlternate: convertedToAlternate,
    childrenReparented,
  });
  if (failures.length) {
    console.log("Fallos:", JSON.stringify(failures.slice(0, 30), null, 2));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
