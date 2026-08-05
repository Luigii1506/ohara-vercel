#!/usr/bin/env -S npx tsx --tsconfig tsconfig.scripts.json

import "dotenv/config";
import {
  persistLimitlessMembershipSources,
  reconcileLimitlessSetMembership,
} from "@/lib/services/limitlessSetSync";
import { prisma } from "@/lib/prisma";

type ScriptOptions = {
  setUrlOrSlug: string;
  dbSetId: number | null;
  region: string | null;
  writeSources: boolean;
  json: boolean;
};

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const getArg = (key: string) =>
    args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1) ?? null;

  const setUrlOrSlug = getArg("--url") ?? getArg("--slug");
  if (!setUrlOrSlug) {
    throw new Error("Missing required argument: --url=<limitless set url or slug>");
  }

  const dbSetIdRaw = getArg("--set-id");
  const dbSetId = dbSetIdRaw ? Number.parseInt(dbSetIdRaw, 10) : null;
  const region = getArg("--region");

  return {
    setUrlOrSlug,
    dbSetId: Number.isFinite(dbSetId) ? dbSetId : null,
    region: region?.trim() ? region.trim().toUpperCase() : null,
    writeSources: args.includes("--write-sources"),
    json: args.includes("--json"),
  };
}

async function main() {
  const options = parseArgs();
  const report = await reconcileLimitlessSetMembership({
    setUrlOrSlug: options.setUrlOrSlug,
    dbSetId: options.dbSetId,
    region: options.region,
  });

  let sourceWriteSummary: { created: number; updated: number } | null = null;
  if (options.writeSources) {
    sourceWriteSummary = await persistLimitlessMembershipSources(report);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          report,
          sourceWriteSummary,
        },
        null,
        2
      )
    );
    return;
  }

  console.log("");
  console.log(`[limitless-set-sync] Set: ${report.snapshot.title}`);
  console.log(`[limitless-set-sync] Source: ${report.snapshot.sourceUrl}`);
  console.log(
    `[limitless-set-sync] Limitless cards: ${report.snapshot.declaredCardCount} · DB set cards: ${report.dbSetCardCount}`
  );
  console.log(
    `[limitless-set-sync] DB set: ${
      report.dbSet?.setId
        ? `${report.dbSet.title} (#${report.dbSet.setId})`
        : "not resolved"
    }`
  );
  if (options.region) {
    console.log(`[limitless-set-sync] Region filter: ${options.region}`);
  }

  console.log("");
  console.log(
    `[limitless-set-sync] Matched by productId: ${report.matchedByProductId.length}`
  );
  console.log(
    `[limitless-set-sync] Matched by code only: ${report.matchedByCodeOnly.length}`
  );
  console.log(`[limitless-set-sync] Missing in DB: ${report.missing.length}`);
  console.log(`[limitless-set-sync] Present in DB but wrong set: ${report.wrongSet.length}`);
  console.log(`[limitless-set-sync] Extra cards in DB set: ${report.extraInDbSet.length}`);

  if (report.missing.length) {
    console.log("");
    console.log("Missing in DB:");
    report.missing.forEach((item) => {
      console.log(
        `  - ${item.code} · ${item.printTitle ?? item.name} · ${item.reason}${
          item.productId ? ` · pid ${item.productId}` : ""
        }`
      );
    });
  }

  if (report.wrongSet.length) {
    console.log("");
    console.log("Present in DB but wrong set:");
    report.wrongSet.forEach((item) => {
      console.log(
        `  - ${item.code} · ${item.printTitle ?? item.name} · ${item.reason}${
          item.productId ? ` · pid ${item.productId}` : ""
        } · candidates ${item.candidateCardIds.join(", ")}`
      );
    });
  }

  if (report.extraInDbSet.length) {
    console.log("");
    console.log("Extra cards in DB set:");
    report.extraInDbSet.forEach((card) => {
      console.log(
        `  - ${card.code} · ${card.name} · cardId ${card.id}${
          card.tcgplayerProductId ? ` · pid ${card.tcgplayerProductId}` : ""
        }${card.baseCardId ? ` · baseCardId ${card.baseCardId}` : " · base"}`
      );
    });
  }

  if (sourceWriteSummary) {
    console.log("");
    console.log(
      `[limitless-set-sync] Stored CardSource links · created ${sourceWriteSummary.created} · updated ${sourceWriteSummary.updated}`
    );
  }
}

main()
  .catch((error) => {
    console.error("[limitless-set-sync] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
