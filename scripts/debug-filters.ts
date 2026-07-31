#!/usr/bin/env -S ts-node --project tsconfig.scripts.json
import { config as loadEnv } from "dotenv";
import { tcgplayerFetch } from "../lib/services/tcgplayerClient";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

async function main() {
  const data = await tcgplayerFetch(`/catalog/categories/68/filters`);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
