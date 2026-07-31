#!/usr/bin/env -S ts-node --project tsconfig.scripts.json

import {
  filterOnePieceGgTournaments,
  scrapeOnePieceGgTournamentDetails,
  scrapeOnePieceGgTournaments,
  type OnePieceGgTournamentCard,
} from "../lib/services/tournaments/onepieceGgScraper";

interface CliOptions {
  limit?: number;
  details?: number;
  headless: boolean;
  allowUnderMinBeforeFirst: boolean;
}

const DEFAULT_OPTIONS: CliOptions = {
  limit: undefined,
  details: 0,
  headless: true,
  allowUnderMinBeforeFirst: true,
};

function parseCliArgs(): CliOptions {
  const rawArgs = process.argv.slice(2);
  const parsed: Partial<CliOptions> = {};

  for (const entry of rawArgs) {
    if (!entry.startsWith("--")) continue;
    const [key, ...rest] = entry.replace(/^--/, "").split("=");
    const value = rest.join("=");
    switch (key) {
      case "limit": {
        const num = Number(value);
        if (Number.isFinite(num) && num > 0) {
          parsed.limit = num;
        }
        break;
      }
      case "details": {
        const num = Number(value);
        if (Number.isFinite(num) && num >= 0) {
          parsed.details = num;
        }
        break;
      }
      case "headful":
        parsed.headless = false;
        break;
      case "headless":
        parsed.headless = value !== "false";
        break;
      case "allowUnderMinBeforeFirst":
        parsed.allowUnderMinBeforeFirst = value !== "false";
        break;
      default:
        break;
    }
  }

  return {
    ...DEFAULT_OPTIONS,
    ...parsed,
  };
}

const cli = parseCliArgs();

function printTournamentSummary(
  card: OnePieceGgTournamentCard,
  index: number
) {
  const date = card.eventDate
    ? card.eventDate.toISOString().slice(0, 10)
    : card.eventDateText ?? "unknown date";
  const name = card.name ?? "Unknown event";
  const set = card.setCode ?? "Unknown set";
  const players = card.playerCount ?? "??";
  const platform = card.platform ?? "Unknown platform";
  const winner = card.winner ?? "Unknown winner";
  const location = card.country ?? "";
  const detailInfo = card.detailUrl ?? "no detail url";

  console.log(
    `[${index + 1}] ${date} · ${name} · ${set} · ${players} players · ${platform} · winner ${winner} ${location} · ${detailInfo}`
  );
}

async function main() {
  console.log("[onepiece-gg] Loading tournaments...");
  const all = await scrapeOnePieceGgTournaments({
    limit: cli.limit,
    headless: cli.headless,
  });

  console.log(
    `[onepiece-gg] Retrieved ${all.length} tournaments from the listing`
  );

  const filtered = filterOnePieceGgTournaments(all, {
    allowUnderMinBeforeFirst: cli.allowUnderMinBeforeFirst,
  });
  console.log(
    `[onepiece-gg] ${filtered.length} tournaments match OP13 + >=16 players (plus leading non-OP13 rows)`
  );

  filtered.forEach((card, index) => printTournamentSummary(card, index));

  if (cli.details && cli.details > 0) {
    const targets = filtered.slice(0, cli.details);
    for (const card of targets) {
      if (!card.detailUrl) {
        console.warn(
          `[onepiece-gg] Skipping detail scrape for "${card.name}" (missing slug)`
        );
        continue;
      }
      console.log(
        `[onepiece-gg] Fetching standings for ${card.name} (${card.detailUrl})`
      );
      try {
        const detail = await scrapeOnePieceGgTournamentDetails(card.detailUrl, {
          headless: cli.headless,
          standingsLimit: 8,
        });
        detail.standings.forEach((standing, idx) => {
          const deckInfo = standing.deckName
            ? `${standing.deckName} → ${standing.deckUrl}`
            : "No deck link";
          console.log(
            `   #${standing.placement ?? idx + 1} ${standing.playerName} (${standing.record ?? "?"}) ${deckInfo}`
          );
        });
      } catch (error) {
        console.warn(
          `[onepiece-gg] Failed to fetch detail for ${card.detailUrl}`,
          error
        );
      }
    }
  } else {
    console.log(
      "[onepiece-gg] Pass --details=N to preview deck standings for the first N tournaments."
    );
  }
}

main().catch((error) => {
  console.error("[onepiece-gg] Scrape failed", error);
  process.exitCode = 1;
});
