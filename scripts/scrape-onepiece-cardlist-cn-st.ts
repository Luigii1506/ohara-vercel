#!/usr/bin/env ts-node

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const offerTypePatternArg = "--offer-type-pattern=STC-";
const reverseArg = "--offer-type-order=asc";

const child = spawn(
  "ts-node",
  ["scripts/scrape-onepiece-cardlist-cn.ts", offerTypePatternArg, reverseArg, ...args],
  { stdio: "inherit" }
);

child.on("close", (code) => {
  process.exitCode = code ?? 1;
});
