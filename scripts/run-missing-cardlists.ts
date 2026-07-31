#!/usr/bin/env ts-node

import { spawn } from "node:child_process";
import path from "node:path";

type RunnerOptions = {
  only: "jp" | "cn" | "both";
  passthroughArgs: string[];
};

const DONE_JP = new Set([
  "OP07",
  "OP06",
  "OP05",
  "OP04",
  "OP03",
  "OP02",
  "OP01",
  "ST16",
  "ST15",
  "ST14",
  "ST13",
  "ST12",
  "ST11",
  "ST10",
  "ST09",
  "ST08",
  "ST07",
  "ST06",
  "ST05",
  "ST04",
  "ST03",
  "ST02",
  "ST01",
]);

const EXCLUDED_SETS = new Set(["ST29"]);

const makeSetCodes = (prefix: string, start: number, end: number) => {
  const items: string[] = [];
  for (let i = start; i <= end; i += 1) {
    items.push(`${prefix}${String(i).padStart(2, "0")}`);
  }
  return items;
};

const SET_ORDER = [
  ...makeSetCodes("ST", 1, 29),
  ...makeSetCodes("OP", 1, 15),
  ...makeSetCodes("EB", 1, 3),
  ...makeSetCodes("PRB", 1, 2),
];

const buildMissingJpSets = () =>
  SET_ORDER.filter(
    (setCode) => !DONE_JP.has(setCode) && !EXCLUDED_SETS.has(setCode)
  );

const buildAllCnSets = () =>
  SET_ORDER.filter((setCode) => !EXCLUDED_SETS.has(setCode));

const parseArgs = (): RunnerOptions => {
  const args = process.argv.slice(2);
  let only: RunnerOptions["only"] = "both";
  const passthroughArgs: string[] = [];

  for (const arg of args) {
    if (arg.startsWith("--only=")) {
      const value = arg.split("=")[1]?.toLowerCase();
      if (value === "jp" || value === "cn" || value === "both") {
        only = value;
      }
    } else {
      passthroughArgs.push(arg);
    }
  }

  return { only, passthroughArgs };
};

const runScript = (label: string, scriptPath: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    console.log(`\n[run] ${label}: ${scriptPath} ${args.join(" ")}`);
    const child = spawn("ts-node", [scriptPath, ...args], {
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`[run] ${label} failed with code ${code}`));
    });
  });

const runSets = async (
  label: string,
  scriptPath: string,
  setCodes: string[],
  passthroughArgs: string[]
) => {
  for (let index = 0; index < setCodes.length; index += 1) {
    const setCode = setCodes[index];
    console.log(
      `\n[queue] ${label} set ${setCode} (${index + 1}/${setCodes.length})`
    );
    await runScript(
      `${label}:${setCode}`,
      scriptPath,
      [`--set=${setCode}`, ...passthroughArgs]
    );
  }
};

const main = async () => {
  const { only, passthroughArgs } = parseArgs();
  const jpSets = buildMissingJpSets();
  const cnSets = buildAllCnSets();

  const jpScript = path.join("scripts", "scrape-onepiece-cardlist-jp.ts");
  const cnScript = path.join("scripts", "scrape-onepiece-cardlist-cn.ts");

  if (only === "jp" || only === "both") {
    console.log(`[start] JP missing sets: ${jpSets.length}`);
    await runSets("JP", jpScript, jpSets, passthroughArgs);
  }

  if (only === "cn" || only === "both") {
    console.log(`\n[start] CN sets: ${cnSets.length}`);
    await runSets("CN", cnScript, cnSets, passthroughArgs);
  }
};

main().catch((error) => {
  console.error("[error] Runner failed", error);
  process.exitCode = 1;
});
