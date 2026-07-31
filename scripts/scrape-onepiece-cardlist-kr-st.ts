#!/usr/bin/env ts-node

import { spawnSync } from "node:child_process";

const setCodes = [
  "ST01",
  "ST02",
  "ST03",
  "ST04",
  "ST05",
  "ST06",
  "ST07",
  "ST08",
  "ST09",
  "ST10",
  "ST11",
  "ST12",
  "ST13",
  "ST14",
  "ST21",
];

const setArg = `--set=${setCodes.join(",")}`;
const args = process.argv.slice(2);

const result = spawnSync(
  "npx",
  ["ts-node", "scripts/scrape-onepiece-cardlist-kr.ts", setArg, ...args],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
