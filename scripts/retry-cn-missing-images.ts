#!/usr/bin/env ts-node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

type MissingEntry = { id: string; url: string };
type MissingFile = {
  missingImages: MissingEntry[];
  networkErrors: Array<MissingEntry & { code?: string }>;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let filePath = "";
  const passthrough: string[] = [];

  for (const arg of args) {
    if (arg.startsWith("--file=")) {
      filePath = arg.split("=")[1] ?? "";
    } else {
      passthrough.push(arg);
    }
  }

  const resolved = filePath
    ? path.resolve(process.cwd(), filePath)
    : path.join(process.cwd(), "scripts", "missing-images-cn.json");

  return { filePath: resolved, passthrough };
};

const chunk = <T,>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const runChunk = (ids: string[], passthrough: string[]) =>
  new Promise<void>((resolve, reject) => {
    const onlyIdsArg = `--only-ids=${ids.join(",")}`;
    const child = spawn(
      "ts-node",
      ["scripts/scrape-onepiece-cardlist-cn.ts", onlyIdsArg, ...passthrough],
      { stdio: "inherit" }
    );
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Retry failed with code ${code}`));
    });
  });

const main = async () => {
  const { filePath, passthrough } = parseArgs();
  const raw = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as MissingFile;
  const ids = Array.from(
    new Set([
      ...(data.missingImages ?? []).map((item) => item.id),
      ...(data.networkErrors ?? []).map((item) => item.id),
    ])
  );

  if (!ids.length) {
    console.log("No missing ids found.");
    return;
  }

  const chunks = chunk(ids, 50);
  for (let index = 0; index < chunks.length; index += 1) {
    const slice = chunks[index];
    console.log(`\n[retry] chunk ${index + 1}/${chunks.length} (${slice.length})`);
    await runChunk(slice, passthrough);
  }
};

main().catch((error) => {
  console.error("[error] Retry failed", error);
  process.exitCode = 1;
});
