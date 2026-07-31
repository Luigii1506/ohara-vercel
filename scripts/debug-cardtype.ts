#!/usr/bin/env -S ts-node --project tsconfig.scripts.json
import { config as loadEnv } from "dotenv";
import {
  searchTcgplayerCategoryProducts,
  getTcgplayerProductsByIds,
} from "../lib/services/tcgplayerClient";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

async function main() {
  const limit = Number(process.argv[2]) || 20;
  const search = await searchTcgplayerCategoryProducts({
    categoryId: 68,
    limit,
    offset: 0,
    includeExtendedFields: true,
    filters: [],
  });

  const ids = (search.results ?? []).map((item) => item.productId ?? item);
  const details = await getTcgplayerProductsByIds(ids, true);

  for (const product of details) {
    const extended = Object.fromEntries(
      (product.extendedData ?? []).map((entry) => [entry.name, entry.value])
    );
    console.log(
      JSON.stringify(
        {
          productId: product.productId,
          name: product.name,
          cardType: extended.CardType ?? null,
          type: product.productTypeName ?? null,
          categoryId: product.categoryId ?? null,
          extendedDataKeys: Object.keys(extended),
        },
        null,
        2
      )
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
