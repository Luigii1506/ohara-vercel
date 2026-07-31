#!/usr/bin/env ts-node

import { spawnSync } from "node:child_process";

const setCodes = [
  "OP01",
  "OP02",
  "OP03",
  "OP04",
  "OP05",
  "OP06",
  "OP07",
  "OP08",
  "OP09",
  "OP10",
  "OP11",
  "OP12",
  "OP13",
  "OP14-EB04",
];

const setArg = `--set=${setCodes.join(",")}`;
const args = process.argv.slice(2);

const result = spawnSync(
  "npx",
  ["ts-node", "scripts/scrape-onepiece-cardlist-fr.ts", setArg, ...args],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
