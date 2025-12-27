import { chromium } from "playwright";
import type { Browser, Page } from "playwright";

const TOURNAMENTS_URL = "https://onepiece.gg/tournaments/";
const DETAIL_BASE_URL = "https://onepiece.gg";
const DEFAULT_TIMEOUT_MS = 90000;
const MIN_PLAYER_COUNT = 16;
const TARGET_SET = "OP13";

export interface OnePieceGgMetaStat {
  label: string | null;
  percentageText: string | null;
  percentageValue: number | null;
  recordText: string | null;
}

export interface OnePieceGgTournamentCard {
  position: number;
  name: string | null;
  slug: string | null;
  detailUrl: string | null;
  eventDateText: string | null;
  eventDate: Date | null;
  platform: string | null;
  setCode: string | null;
  format: string | null;
  playerCount: number | null;
  winner: string | null;
  country: string | null;
  metaStats: OnePieceGgMetaStat[];
}

export interface OnePieceGgStanding {
  placement: number | null;
  placementText: string | null;
  record: string | null;
  playerName: string | null;
  country: string | null;
  deckName: string | null;
  deckUrl: string | null;
}

export interface OnePieceGgTournamentDetail {
  detailUrl: string;
  title: string | null;
  eventDateText: string | null;
  winner: string | null;
  standings: OnePieceGgStanding[];
}

export interface OnePieceGgScrapeOptions {
  limit?: number;
  headless?: boolean;
  waitTimeoutMs?: number;
}

export interface OnePieceGgDetailOptions {
  headless?: boolean;
  waitTimeoutMs?: number;
  standingsLimit?: number;
}

interface RawCard {
  position: number;
  dateText: string | null;
  name: string | null;
  platform: string | null;
  setCode: string | null;
  format: string | null;
  playerCount: string | null;
  winner: string | null;
  country: string | null;
  metaStats: {
    label: string | null;
    percentageText: string | null;
    recordText: string | null;
  }[];
}

const normalizeText = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toInteger = (value?: string | null) => {
  if (!value) return null;
  const match = value.replace(/[^0-9-]/g, "");
  if (!match.length) return null;
  const parsed = Number.parseInt(match, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFloat = (value?: string | null) => {
  if (!value) return null;
  const match = value.replace(/[^0-9.]/g, "");
  if (!match.length) return null;
  const parsed = Number.parseFloat(match);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDate = (value?: string | null) => {
  if (!value) return null;
  const normalized = `${value.trim()} UTC`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const slugify = (value?: string | null) => {
  if (!value) return null;
  const ascii = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const withoutBrackets = ascii.replace(/[\[\]]/g, " ");
  const slug = withoutBrackets
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return slug.length ? slug : null;
};

async function waitForListingContent(page: Page, timeout: number) {
  await page.waitForSelector("#TheTournamentsOutput > div .sc-hwMtKH a", {
    timeout,
  });
  await page.waitForFunction(
    () => {
      const anchors = Array.from(
        document.querySelectorAll("#TheTournamentsOutput > div .sc-hwMtKH a")
      );
      return anchors.some((anchor) => {
        const text = anchor.textContent?.trim();
        return text && text.length > 0 && text !== "Fetching...";
      });
    },
    { timeout }
  );
}

async function extractRawCards(page: Page): Promise<RawCard[]> {
  return page.$$eval("#TheTournamentsOutput > div", (nodes) =>
    nodes.map((node, index) => {
      const dateText =
        (node.querySelector(".sc-cJSxUA div") as HTMLElement | null)
          ?.textContent || null;
      const name =
        (node.querySelector(".sc-hwMtKH a") as HTMLElement | null)
          ?.textContent || null;
      const platform =
        (node.querySelector(".sc-dHpsdn") as HTMLElement | null)?.textContent ||
        null;
      const setCode =
        (node.querySelector(".sc-dihiC > div:first-child") as HTMLElement | null)
          ?.textContent || null;
      const format =
        (node.querySelector(".sc-dihiC > div:nth-child(2)") as HTMLElement | null)
          ?.textContent || null;
      const playerCountContainer = node.querySelector(".sc-gByRMG");
      const playerCountText = playerCountContainer
        ? playerCountContainer.textContent?.replace(/[^0-9]/g, "") || null
        : null;
      const winner =
        (node.querySelector(".sc-eUJmUS") as HTMLElement | null)?.textContent ||
        null;
      const country =
        (node.querySelector(".sc-dekbKM") as HTMLElement | null)?.textContent ||
        null;
      const statNodes = Array.from(
        node.querySelectorAll(".sc-gTRDQs")
      ) as HTMLElement[];
      const metaStats = statNodes.map((stat) => {
        const label =
          (stat.querySelector(".sc-fGqoZs") as HTMLElement | null)?.getAttribute(
            "title"
          ) || null;
        const percentageText =
          (stat.querySelector(".sc-jQmowt") as HTMLElement | null)?.textContent ||
          null;
        const recordText =
          (stat.querySelector(".sc-jrpWxd") as HTMLElement | null)?.textContent ||
          null;
        return { label, percentageText, recordText };
      });

      return {
        position: index,
        dateText,
        name,
        platform,
        setCode,
        format,
        playerCount: playerCountText,
        winner,
        country,
        metaStats,
      };
    })
  );
}

const transformCard = (raw: RawCard): OnePieceGgTournamentCard => {
  const normalizedName = normalizeText(raw.name);
  const slug = slugify(normalizedName || undefined);
  const detailUrl = slug ? `${DETAIL_BASE_URL}/tournaments/${slug}` : null;
  const playerCount = toInteger(normalizeText(raw.playerCount));
  return {
    position: raw.position,
    name: normalizedName,
    slug,
    detailUrl,
    eventDateText: normalizeText(raw.dateText),
    eventDate: toDate(raw.dateText || undefined),
    platform: normalizeText(raw.platform),
    setCode: normalizeText(raw.setCode),
    format: normalizeText(raw.format),
    playerCount,
    winner: normalizeText(raw.winner),
    country: normalizeText(raw.country),
    metaStats: raw.metaStats.map((stat) => ({
      label: normalizeText(stat.label),
      percentageText: normalizeText(stat.percentageText),
      percentageValue: toFloat(stat.percentageText),
      recordText: normalizeText(stat.recordText),
    })),
  };
};

export async function scrapeOnePieceGgTournaments(
  options?: OnePieceGgScrapeOptions
): Promise<OnePieceGgTournamentCard[]> {
  const headless = options?.headless ?? true;
  const waitTimeout = options?.waitTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage();
    await page.goto(TOURNAMENTS_URL, {
      waitUntil: "domcontentloaded",
      timeout: waitTimeout,
    });
    await waitForListingContent(page, waitTimeout);

    const raw = await extractRawCards(page);
    const cards = raw.map(transformCard);
    return typeof options?.limit === "number"
      ? cards.slice(0, options.limit)
      : cards;
  } finally {
    await browser.close();
  }
}

export interface OnePieceGgFilterOptions {
  targetSet?: string;
  minPlayers?: number;
  includePreceding?: boolean;
  allowUnderMinBeforeFirst?: boolean;
}

export function filterOnePieceGgTournaments(
  cards: OnePieceGgTournamentCard[],
  options?: OnePieceGgFilterOptions
): OnePieceGgTournamentCard[] {
  const targetSet = (options?.targetSet ?? TARGET_SET).toUpperCase();
  const minPlayers = options?.minPlayers ?? MIN_PLAYER_COUNT;
  const includePreceding = options?.includePreceding ?? true;
  const allowUnderMinBeforeFirst =
    options?.allowUnderMinBeforeFirst ?? false;

  const firstTargetIndex = cards.findIndex((card) => {
    const set = card.setCode?.toUpperCase() ?? "";
    return set.includes(targetSet);
  });

  return cards.filter((card, index) => {
    const set = card.setCode?.toUpperCase() ?? "";
    const isTargetSet = set.includes(targetSet);
    const hasMinPlayers =
      typeof card.playerCount === "number"
        ? card.playerCount >= minPlayers
        : false;

    if (isTargetSet) {
      return hasMinPlayers;
    }

    if (!includePreceding) {
      return false;
    }

    if (firstTargetIndex === -1) {
      return allowUnderMinBeforeFirst || hasMinPlayers;
    }

    if (index < firstTargetIndex) {
      return allowUnderMinBeforeFirst || hasMinPlayers;
    }

    return false;
  });
}

async function waitForDetailContent(page: Page, timeout: number) {
  await page.waitForFunction(
    () => {
      const heading = document.querySelector("h1");
      return heading && heading.textContent && heading.textContent.length > 0;
    },
    { timeout }
  );
  await page.waitForFunction(
    () =>
      document.body.innerText
        .toLowerCase()
        .includes("tournament standings and decks"),
    { timeout }
  );
}

const resolveAbsoluteUrl = (href?: string | null) => {
  if (!href) return null;
  try {
    return new URL(href, DETAIL_BASE_URL).toString();
  } catch {
    return null;
  }
};

export async function scrapeOnePieceGgTournamentDetails(
  detailUrl: string,
  options?: OnePieceGgDetailOptions
): Promise<OnePieceGgTournamentDetail> {
  const headless = options?.headless ?? true;
  const waitTimeout = options?.waitTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage();
    await page.goto(detailUrl, {
      waitUntil: "domcontentloaded",
      timeout: waitTimeout,
    });
    await waitForDetailContent(page, waitTimeout);
    await page.waitForTimeout(1000);

    const detail = await page.evaluate(() => {
      const title = document
        .querySelector(".entry-header h1, h1")
        ?.textContent?.trim();
      const dateText = Array.from(
        document.querySelectorAll("div")
      ).find((div) => div.textContent?.includes("Event Date"))
        ?.nextElementSibling?.textContent;
      const winner = document
        .querySelector(".sc-eUJmUS")
        ?.textContent?.trim();
      const rows = Array.from(
        document.querySelectorAll(".sc-fuNSHy")
      ) as HTMLElement[];
      const standings = rows
        .filter((row) => row.querySelector(".sc-ljoEiT a"))
        .map((row) => {
          const placement =
            row.querySelector(".sc-dmnZre")?.textContent?.trim() || null;
          const record =
            row.querySelector(".sc-gGOevJ")?.textContent?.trim() || null;
          const playerName =
            row.querySelector(".sc-imTTCS")?.textContent?.trim() || null;
          const country =
            row.querySelector(".sc-jMpVQY")?.textContent?.trim() || null;
          const deckAnchor = row.querySelector(
            '.sc-ljoEiT a[href^="/decks/"]'
          ) as HTMLAnchorElement | null;
          const deckName = deckAnchor?.textContent?.trim() || null;
          const deckUrl = deckAnchor?.getAttribute("href") || null;
          return {
            placement,
            record,
            playerName,
            country,
            deckName,
            deckUrl,
          };
        });

      return {
        title: title || null,
        dateText: dateText?.trim() || null,
        winner: winner || null,
        standings,
      };
    });

    const standings =
      detail.standings
        .map((row) => ({
          placement: toInteger(row.placement),
          placementText: normalizeText(row.placement),
          record: normalizeText(row.record),
          playerName: normalizeText(row.playerName),
          country: normalizeText(row.country),
          deckName: normalizeText(row.deckName),
          deckUrl: resolveAbsoluteUrl(row.deckUrl),
        }))
        .slice(0, options?.standingsLimit ?? undefined) ?? [];

    return {
      detailUrl,
      title: normalizeText(detail.title),
      eventDateText: normalizeText(detail.dateText),
      winner: normalizeText(detail.winner),
      standings,
    };
  } finally {
    await browser.close();
  }
}
