#!/usr/bin/env ts-node

import { spawn } from "node:child_process";

const makeSetCodes = (prefix: string, start: number, end: number) => {
  const items: string[] = [];
  for (let i = start; i <= end; i += 1) {
    items.push(`${prefix}${String(i).padStart(2, "0")}`);
  }
  return items;
};

const SETS = makeSetCodes("PRB", 1, 2);

const args = process.argv.slice(2);
const setArg = `--set=${SETS.join(",")}`;

const child = spawn(
  "ts-node",
  ["scripts/scrape-onepiece-cardlist-cn.ts", setArg, ...args],
  { stdio: "inherit" }
);

child.on("close", (code) => {
  process.exitCode = code ?? 1;
});
