#!/usr/bin/env ts-node

import { spawnSync } from "node:child_process";

const setCodes = ["PRB-01", "PRB-02"];

const setArg = `--set=${setCodes.join(",")}`;
const args = process.argv.slice(2);

const result = spawnSync(
  "npx",
  ["ts-node", "scripts/scrape-onepiece-cardlist-fr.ts", setArg, ...args],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
