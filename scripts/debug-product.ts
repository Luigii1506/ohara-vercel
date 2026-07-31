#!/usr/bin/env -S ts-node --project tsconfig.scripts.json
import { config as loadEnv } from "dotenv";
import { tcgplayerFetch } from "../lib/services/tcgplayerClient";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

async function main() {
  const ids = (process.argv.slice(2)[0] || "541057")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const data = (
    await tcgplayerFetch<any>(`/catalog/products/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productIds: ids,
        getExtendedFields: true,
      }),
    })
  )?.results ?? [];
  console.log(
    JSON.stringify(
      data.map((product: any) => ({
        productId: product.productId,
        extendedData: product.extendedData,
      })),
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
