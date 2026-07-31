#!/usr/bin/env ts-node

import { spawnSync } from "node:child_process";

const setCodes = [
  "ST-29",
  "ST-28",
  "ST-27",
  "ST-26",
  "ST-25",
  "ST-24",
  "ST-23",
  "ST-22",
  "ST-21",
  "ST-20",
  "ST-19",
  "ST-18",
  "ST-17",
  "ST-16",
  "ST-15",
];

const setArg = `--set=${setCodes.join(",")}`;
const args = process.argv.slice(2);
const overrideArg = "--override-setcode";

const result = spawnSync(
  "npx",
  ["ts-node", "scripts/scrape-onepiece-cardlist-fr.ts", setArg, overrideArg, ...args],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
