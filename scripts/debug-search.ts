#!/usr/bin/env -S ts-node --project tsconfig.scripts.json
import { config as loadEnv } from "dotenv";
import { searchTcgplayerCategoryProducts } from "../lib/services/tcgplayerClient";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

async function main() {
  const type = process.argv[2] ?? "Cards";
  const data = await searchTcgplayerCategoryProducts({
    categoryId: 68,
    filters: [
      { name: "ProductType", values: [type] },
    ],
    limit: 20,
    offset: 0,
    includeExtendedFields: true,
  });
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
