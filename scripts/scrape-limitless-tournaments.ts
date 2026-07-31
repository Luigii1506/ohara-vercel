#!/usr/bin/env -S ts-node --project tsconfig.scripts.json

import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import {
  syncLimitlessTournamentDecks,
  syncLimitlessTournaments,
} from "../lib/services/tournaments/limitlessScraper";

function bootstrapEnv() {
  const envFiles = [".env", ".env.local"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      loadEnv({ path: fullPath, override: true });
    }
  }
}

async function main() {
  bootstrapEnv();
  const result = await syncLimitlessTournaments();
  console.log(
    `Synced ${result.total} tournaments (created: ${result.created}, updated: ${result.updated})`
  );

  const deckResult = await syncLimitlessTournamentDecks();
  console.log(
    `Decklists processed: ${deckResult.processed} (created: ${deckResult.created}, updated: ${deckResult.updated}, skipped: ${deckResult.skipped}) across ${deckResult.tournamentsProcessed} tournaments`
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error syncing tournaments:", error);
    process.exit(1);
  });
