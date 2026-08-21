import { prisma } from "@/lib/prisma";
import { syncGoogleCameoSource } from "@/lib/master-sets/cameo-sync";

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();

  for (const entry of argv) {
    if (!entry.startsWith("--")) continue;
    const [key, value = ""] = entry.slice(2).split("=");
    args.set(key, value);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const limitSheets = args.get("limit")
    ? Number.parseInt(args.get("limit") as string, 10)
    : undefined;
  const onlyGids = args.get("gids")
    ? (args.get("gids") as string)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;
  const onlyNames = args.get("names")
    ? (args.get("names") as string)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;

  const summary = await syncGoogleCameoSource({
    limitSheets,
    onlyGids,
    onlyNames,
    logger: (message) => console.log(message),
  });

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error("[cameo-sync] failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
