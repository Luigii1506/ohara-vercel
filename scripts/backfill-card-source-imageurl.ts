#!/usr/bin/env ts-node

import "dotenv/config";
import { spawnSync } from "node:child_process";

const REGION_SCRIPTS: Record<string, string> = {
  CN: "scripts/scrape-onepiece-cardlist-cn.ts",
  JP: "scripts/scrape-onepiece-cardlist-jp.ts",
  FR: "scripts/scrape-onepiece-cardlist-fr.ts",
  KR: "scripts/scrape-onepiece-cardlist-kr.ts",
};

const main = () => {
  const args = process.argv.slice(2);
  const allRegions = args.includes("--all");
  const regionArg = args.find((arg) => arg.startsWith("--region="));
  const region = regionArg ? regionArg.split("=")[1]?.toUpperCase() : "CN";

  const regions = allRegions ? ["KR", "FR", "JP", "CN"] : [region || "CN"];
  const passthrough = args.filter(
    (arg) => arg !== "--all" && !arg.startsWith("--region=")
  );

  for (const code of regions) {
    const script = REGION_SCRIPTS[code];
    if (!script) {
      console.log(`[skip] Unknown region ${code}`);
      continue;
    }

    const finalArgs = [
      "ts-node",
      script,
      ...passthrough,
      "--backfill-card-source",
    ];

    console.log(`[run] ${code} -> npx ${finalArgs.join(" ")}`);
    const result = spawnSync("npx", finalArgs, { stdio: "inherit" });
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
};

main();
