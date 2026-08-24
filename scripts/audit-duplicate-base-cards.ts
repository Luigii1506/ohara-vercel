import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

// Marcadores de "esto es una alterna, no una base" vistos en nombres
// mal-importados como base (ej. TC: "托拉法爾加・羅(異圖卡)" = "... (carta de
// arte alterno)"). Si el nombre de un candidato contiene uno de estos, es
// casi seguro que en realidad es una alterna, no la base real del código.
const ALT_MARKERS = ["異圖卡", "异图卡", "パラレル", "(alt)", "alternate art"];

const hasAltMarker = (name: string) =>
  ALT_MARKERS.some((marker) => name.toLowerCase().includes(marker.toLowerCase()));

type Candidate = {
  id: number;
  name: string;
  alias: string | null;
  officialVariantCode: string | null;
  illustrator: string | null;
  createdAt: Date;
  childCount: number;
  hasAltMarker: boolean;
};

type Group = {
  region: string;
  code: string;
  setCode: string;
  classification: "exact_duplicate" | "mislabeled_alternate" | "unclear";
  suggestedKeepId: number | null;
  needsChildMerge: boolean;
  candidates: Candidate[];
};

async function main() {
  const bases = await prisma.card.findMany({
    where: { baseCardId: null, isFirstEdition: true, category: { not: "DON" } },
    select: {
      id: true,
      code: true,
      region: true,
      setCode: true,
      name: true,
      alias: true,
      officialVariantCode: true,
      illustrator: true,
      createdAt: true,
    },
  });

  const byRegionCode = new Map<string, typeof bases>();
  for (const b of bases) {
    if (b.code.toUpperCase().includes("DON")) continue;
    const key = `${b.region}::${b.code}`;
    if (!byRegionCode.has(key)) byRegionCode.set(key, []);
    byRegionCode.get(key)!.push(b);
  }

  const dupeEntries = Array.from(byRegionCode.entries()).filter(
    ([, rows]) => rows.length > 1
  );

  console.log(`Auditando ${dupeEntries.length} grupos duplicados...`);

  const groups: Group[] = [];
  let processed = 0;

  for (const [key, rows] of dupeEntries) {
    const [region, code] = key.split("::");
    const candidates: Candidate[] = [];

    for (const row of rows) {
      const childCount = await prisma.card.count({
        where: { baseCardId: row.id },
      });
      candidates.push({
        id: row.id,
        name: row.name,
        alias: row.alias,
        officialVariantCode: row.officialVariantCode,
        illustrator: row.illustrator,
        createdAt: row.createdAt!,
        childCount,
        hasAltMarker: hasAltMarker(row.name),
      });
    }

    const names = new Set(candidates.map((c) => c.name.trim()));
    let classification: Group["classification"];
    let suggestedKeepId: number | null = null;

    if (names.size === 1) {
      classification = "exact_duplicate";
      // Preferimos al candidato con más alternas ya colgando de él — ese es
      // el que el resto del pipeline terminó tratando como "la base real"
      // en pasadas posteriores, aunque no sea el que se creó primero.
      const best = [...candidates].sort((a, b) => {
        if (b.childCount !== a.childCount) return b.childCount - a.childCount;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })[0];
      suggestedKeepId = best.id;
    } else {
      const markedCount = candidates.filter((c) => c.hasAltMarker).length;
      if (markedCount > 0 && markedCount < candidates.length) {
        classification = "mislabeled_alternate";
        const clean = candidates.find((c) => !c.hasAltMarker);
        suggestedKeepId = clean?.id ?? null;
      } else {
        classification = "unclear";
      }
    }

    const candidatesWithChildren = candidates.filter((c) => c.childCount > 0);
    // Si más de un candidato ya tiene alternas colgando, no basta con
    // borrar al "perdedor" — hay que MOVER sus hijos al sobreviviente antes,
    // o se quedan huérfanos.
    const needsChildMerge = candidatesWithChildren.length > 1;

    groups.push({
      region,
      code,
      setCode: rows[0].setCode,
      classification,
      suggestedKeepId,
      needsChildMerge,
      candidates,
    });

    processed += 1;
    if (processed % 100 === 0) {
      console.log(`  ${processed}/${dupeEntries.length}`);
    }
  }

  const summary = {
    total: groups.length,
    byRegion: {} as Record<string, number>,
    byClassification: {} as Record<string, number>,
    needsChildMerge: groups.filter((g) => g.needsChildMerge).length,
  };
  for (const g of groups) {
    summary.byRegion[g.region] = (summary.byRegion[g.region] ?? 0) + 1;
    summary.byClassification[g.classification] =
      (summary.byClassification[g.classification] ?? 0) + 1;
  }

  writeFileSync(
    "scripts/duplicate-base-cards-report.json",
    JSON.stringify({ summary, groups }, null, 2)
  );

  console.log("\n=== RESUMEN ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nReporte completo: scripts/duplicate-base-cards-report.json");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
