#!/usr/bin/env ts-node

import axios from "axios";
import fs from "node:fs/promises";
import path from "node:path";

type DotggResponse = {
  names: string[];
  data: Array<Array<string | number | null>>;
};

const DEFAULT_URL =
  "https://api.dotgg.gg/cgfw/getcards?game=onepiece&mode=indexed";

const parseArgs = () => {
  const args = process.argv.slice(2);
  let url = DEFAULT_URL;
  let outPath = path.join(process.cwd(), "scripts", "dotgg-onepiece-cards.json");
  let noFile = false;

  for (const arg of args) {
    if (arg.startsWith("--url=")) {
      url = arg.split("=")[1] ?? url;
    } else if (arg.startsWith("--out=")) {
      outPath = arg.split("=")[1] ?? outPath;
    } else if (arg === "--no-file") {
      noFile = true;
    }
  }

  return { url, outPath, noFile };
};

const main = async () => {
  const { url, outPath, noFile } = parseArgs();
  const response = await axios.get<DotggResponse>(url);
  const payload = response.data;

  if (!Array.isArray(payload?.names) || !Array.isArray(payload?.data)) {
    throw new Error("Unexpected API response shape.");
  }

  const items = payload.data.map((row) => {
    const entry: Record<string, string | number | null> = {};
    payload.names.forEach((key, index) => {
      entry[key] = row[index] ?? null;
    });
    return entry;
  });

  console.log(`[dotgg] cards=${items.length}`);

  if (!noFile) {
    await fs.writeFile(outPath, JSON.stringify({ items }, null, 2));
    console.log(`[dotgg] saved ${outPath}`);
  } else {
    console.log(JSON.stringify(items.slice(0, 5), null, 2));
  }
};

main().catch((error) => {
  console.error("[error] Dotgg scraper failed", error);
  process.exitCode = 1;
});
