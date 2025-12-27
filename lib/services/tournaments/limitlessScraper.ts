import axios from "axios";
import * as cheerio from "cheerio";
import { TournamentStatus, TournamentType } from "@prisma/client";
import { prisma } from "../../prisma";

const LIMITLESS_BASE_URL = "https://onepiece.limitlesstcg.com";
const LIMITLESS_TOURNAMENTS_URL = `${LIMITLESS_BASE_URL}/tournaments`;
const DEFAULT_PAGE_SIZE = 100;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
};

export interface LimitlessTournamentRow {
  sourceTournamentId: string;
  name: string;
  region: string | null;
  country: string | null;
  format: string | null;
  playerCount: number | null;
  isPlayerCountApprox: boolean;
  winnerName: string | null;
  winnerUrl: string | null;
  eventDate: Date;
  tournamentUrl: string;
}

const toAbsoluteUrl = (maybeUrl?: string | null) => {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, LIMITLESS_BASE_URL).toString();
  } catch (error) {
    console.warn("[limitless-scraper] invalid url", maybeUrl, error);
    return null;
  }
};

const toDate = (value?: string | null) => {
  if (!value) return new Date();
  const isoCandidate = `${value}T00:00:00Z`;
  const parsed = new Date(isoCandidate);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const toInteger = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.replace(/[^0-9]/g, "");
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const detectTournamentType = (name?: string | null): TournamentType | null => {
  if (!name) return null;
  const normalized = name.toLowerCase();
  if (/\bregional(s)?\b/.test(normalized)) {
    return TournamentType.REGIONAL;
  }
  if (/treasure\s*cup/.test(normalized)) {
    return TournamentType.TREASURE_CUP;
  }
  if (/\bchampionship(s)?\b/.test(normalized)) {
    return TournamentType.CHAMPIONSHIP;
  }
  return null;
};

interface FetchPageResult {
  rows: LimitlessTournamentRow[];
  maxPages: number;
}

async function fetchPage(page: number): Promise<FetchPageResult> {
  const response = await axios.get(LIMITLESS_TOURNAMENTS_URL, {
    headers: DEFAULT_HEADERS,
    params: { page, show: DEFAULT_PAGE_SIZE },
  });

  const $ = cheerio.load(response.data);
  const rows: LimitlessTournamentRow[] = [];

  $("table.completed-tournaments tbody tr").each((_, element) => {
    const row = $(element);
    const hasCells = row.find("td").length >= 4;
    if (!hasCells) return;

    const dateAttr = row.attr("data-date");
    const regionAttr = row.attr("data-region") ?? null;
    const countryAttr = row.attr("data-country") ?? null;
    const formatAttr = row.attr("data-format") ?? null;
    const nameAttr = row.attr("data-name");
    const playersAttr = row.attr("data-players") ?? row.find("td").eq(4).text();
    const winnerAttr = row.attr("data-winner") ?? null;

    const linkHref = row.find("td").eq(2).find("a").attr("href") ?? null;
    const tournamentUrl = toAbsoluteUrl(linkHref) ?? LIMITLESS_TOURNAMENTS_URL;

    const tournamentIdMatch = linkHref?.match(/\/(\d+)(?:\/?|$)/);
    const sourceTournamentId = tournamentIdMatch?.[1] ?? linkHref ?? nameAttr ?? tournamentUrl;

    const winnerAnchor = row.find("td.winner a");
    const winnerUrl = toAbsoluteUrl(winnerAnchor.attr("href") ?? undefined);
    const winnerName = winnerAnchor.text().trim() || winnerAttr || null;

    const isApprox = row.find("span.apc").length > 0;

    rows.push({
      sourceTournamentId,
      name: nameAttr ?? row.find("td").eq(2).text().trim(),
      region: regionAttr,
      country: countryAttr,
      format: formatAttr,
      playerCount: toInteger(playersAttr),
      isPlayerCountApprox: isApprox,
      winnerName,
      winnerUrl,
      eventDate: toDate(dateAttr),
      tournamentUrl,
    });
  });
  const pagination = $("ul.pagination");
  const maxAttr = pagination.attr("data-max");
  const maxPagesAttr = maxAttr ? Number(maxAttr) : Number.NaN;
  const maxPages = Number.isFinite(maxPagesAttr) && maxPagesAttr > 0 ? maxPagesAttr : page;

  return { rows, maxPages };
}

export async function fetchLimitlessTournamentRows(): Promise<LimitlessTournamentRow[]> {
  const aggregated: LimitlessTournamentRow[] = [];

  const first = await fetchPage(1);
  console.log(`[limitless-scraper] Page 1 processed (${first.rows.length} tournaments)`);
  aggregated.push(...first.rows);

  for (let page = 2; page <= first.maxPages; page += 1) {
    const { rows } = await fetchPage(page);
    if (!rows.length) break;
    console.log(`[limitless-scraper] Page ${page} processed (${rows.length} tournaments)`);
    aggregated.push(...rows);
  }

  return aggregated;
}

export interface SyncResult {
  sourceId: number;
  total: number;
  created: number;
  updated: number;
}

export async function syncLimitlessTournaments(): Promise<SyncResult> {
  const tournaments = await fetchLimitlessTournamentRows();
  console.log(`[limitless-scraper] Total tournaments fetched: ${tournaments.length}`);

  const now = new Date();

  const source = await prisma.tournamentSource.upsert({
    where: { slug: "limitless" },
    update: {
      name: "Limitless TCG",
      baseUrl: LIMITLESS_BASE_URL,
      lastSyncedAt: now,
    },
    create: {
      slug: "limitless",
      name: "Limitless TCG",
      baseUrl: LIMITLESS_BASE_URL,
      description: "Limitless One Piece event listings",
      lastSyncedAt: now,
    },
  });

  const existing = await prisma.tournament.findMany({
    where: { sourceId: source.id },
    select: { id: true, sourceTournamentId: true },
  });

  const existingMap = new Map(existing.map((t) => [t.sourceTournamentId, t.id]));

  let created = 0;
  let updated = 0;

  for (const tournament of tournaments) {
    const payload = {
      type: detectTournamentType(tournament.name),
      name: tournament.name,
      region: tournament.region,
      country: tournament.country,
      format: tournament.format,
      playerCount: tournament.playerCount,
      isPlayerCountApprox: tournament.isPlayerCountApprox,
      winnerName: tournament.winnerName,
      winnerUrl: tournament.winnerUrl,
      eventDate: tournament.eventDate,
      tournamentUrl: tournament.tournamentUrl,
      status: TournamentStatus.COMPLETED,
    };

    const existingId = existingMap.get(tournament.sourceTournamentId);
    if (existingId) {
      await prisma.tournament.update({
        where: { id: existingId },
        data: payload,
      });
      updated += 1;
    } else {
      await prisma.tournament.create({
        data: {
          ...payload,
          sourceId: source.id,
          sourceTournamentId: tournament.sourceTournamentId,
        },
      });
      created += 1;
    }
  }

  return {
    sourceId: source.id,
    total: tournaments.length,
    created,
    updated,
  };
}

interface TournamentResultRow {
  standing: number | null;
  playerName: string;
  playerUrl: string | null;
  deckName: string | null;
  deckSlug: string | null;
  deckListId: string | null;
  deckListUrl: string | null;
}

interface DeckListCardEntry {
  code: string;
  quantity: number;
  section: string;
}

interface DeckListData {
  leaderCode?: string;
  cards: DeckListCardEntry[];
}

const cardIdCache = new Map<string, number>();
const LIMITLESS_SOURCE = "limitless";

const normalizeRefPart = (value?: string | null) => {
  if (!value) return "unknown";
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
};

const extractPlayerId = (playerUrl?: string | null) => {
  if (!playerUrl) return null;
  const match = playerUrl.match(/\/players\/(\d+)/i);
  return match?.[1] ?? null;
};

async function resolveCardId(code: string): Promise<number | null> {
  if (!code) return null;
  if (cardIdCache.has(code)) {
    return cardIdCache.get(code)!;
  }

  const baseCard = await prisma.card.findFirst({
    where: {
      code,
      baseCardId: null,
    },
    select: { id: true },
  });

  if (baseCard) {
    cardIdCache.set(code, baseCard.id);
    return baseCard.id;
  }

  const fallbackCard = await prisma.card.findFirst({
    where: { code },
    select: { id: true },
  });

  if (fallbackCard) {
    cardIdCache.set(code, fallbackCard.id);
    return fallbackCard.id;
  }

  console.warn(`[limitless-scraper] Could not resolve card code: ${code}`);
  return null;
}

async function fetchTournamentResultRows(tournamentUrl: string): Promise<TournamentResultRow[]> {
  const response = await axios.get(tournamentUrl, { headers: DEFAULT_HEADERS });
  const $ = cheerio.load(response.data);
  const rows: TournamentResultRow[] = [];

  $("table.tournament-results tbody tr").each((_, element) => {
    const row = $(element);
    const cells = row.find("td");
    if (cells.length < 4) return;

    const standingText = cells.eq(0).text().trim();
    const standing = standingText ? Number.parseInt(standingText, 10) : null;

    const playerCell = cells.eq(1);
    const playerAnchor = playerCell.find("a").first();
    const playerName = playerAnchor.text().trim() || playerCell.text().trim();
    const playerUrl = playerAnchor.length ? toAbsoluteUrl(playerAnchor.attr("href")) : null;

    const deckLink = row.find("a.deck-link").first();
    const deckHref = deckLink.attr("href") ?? null;
    const deckSlugMatch = deckHref?.match(/decks\/(\d+)/i);
    const deckSlug = deckSlugMatch?.[1] ?? deckHref ?? null;
    const deckName = deckLink.text().replace(/\s+/g, " ").trim() || null;

    const listAnchor = cells.eq(3).find("a").first();
    const listHref = listAnchor.attr("href") ?? null;
    const listMatch = listHref?.match(/decks\/list\/(\d+)/i);
    const deckListId = listMatch?.[1] ?? null;
    const deckListUrl = listHref ? toAbsoluteUrl(listHref) : null;

    rows.push({
      standing,
      playerName: playerName || "Unknown Player",
      playerUrl,
      deckName,
      deckSlug,
      deckListId,
      deckListUrl,
    });
  });

  return rows;
}

async function fetchDeckListCards(deckListUrl: string): Promise<DeckListData> {
  const response = await axios.get(deckListUrl, { headers: DEFAULT_HEADERS });
  const $ = cheerio.load(response.data);

  const cards: DeckListCardEntry[] = [];
  let leaderCode: string | undefined;

  $(".decklist-card").each((_, element) => {
    const cardEl = $(element);
    const rawQuantity = cardEl.attr("data-count") ?? cardEl.data("count");
    const quantity = Number.parseInt(String(rawQuantity ?? "1"), 10) || 1;
    const rawCode = cardEl.attr("data-id") ?? cardEl.data("id");
    const code = rawCode ? String(rawCode) : null;
    if (!code) return;

    const section = cardEl
      .closest(".decklist-column")
      .find(".decklist-column-heading")
      .first()
      .text()
      .trim();

    if (section.toLowerCase().includes("leader")) {
      leaderCode = code;
    }

    cards.push({
      code,
      quantity,
      section,
    });
  });

  return { leaderCode, cards };
}

interface DeckBuildInput {
  listId: string;
  listUrl: string;
  deckName: string;
  description?: string;
  playerName: string;
  tournamentName: string;
  cards: DeckListCardEntry[];
  leaderCode?: string;
}

interface DeckBuildResult {
  deckId: number;
  leaderCardId: number | null;
}

async function upsertDeckFromList(input: DeckBuildInput): Promise<DeckBuildResult> {
  const cardRecords: { cardId: number; quantity: number }[] = [];

  for (const entry of input.cards) {
    const cardId = await resolveCardId(entry.code);
    if (!cardId) continue;
    cardRecords.push({ cardId, quantity: entry.quantity });
  }

  const leaderCardId = input.leaderCode ? await resolveCardId(input.leaderCode) : null;

  const uniqueUrl = `limitless-${input.listId}`;
  const safeDescription =
    input.description ??
    `${input.playerName} • ${input.tournamentName} • imported from Limitless (${input.listId})`;

  const deck = await prisma.$transaction(async (tx) => {
    const deckRecord = await tx.deck.upsert({
      where: { uniqueUrl },
      update: {
        name: input.deckName,
        description: safeDescription,
        updatedAt: new Date(),
      },
      create: {
        name: input.deckName,
        description: safeDescription,
        uniqueUrl,
        isPublished: false,
        isShopDeck: false,
      },
    });

    await tx.deckCard.deleteMany({ where: { deckId: deckRecord.id } });

    if (cardRecords.length > 0) {
      await tx.deckCard.createMany({
        data: cardRecords.map((record) => ({
          deckId: deckRecord.id,
          cardId: record.cardId,
          quantity: record.quantity,
        })),
      });
    }

    return deckRecord;
  });

  return {
    deckId: deck.id,
    leaderCardId,
  };
}

export interface DeckSyncResult {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  tournamentsProcessed: number;
}

export async function syncLimitlessTournamentDecks(options?: {
  limit?: number;
}): Promise<DeckSyncResult> {
  const source = await prisma.tournamentSource.findUnique({
    where: { slug: "limitless" },
    select: { id: true },
  });

  if (!source) {
    throw new Error("Tournament source 'limitless' not found. Run base sync first.");
  }

  const tournaments = await prisma.tournament.findMany({
    where: { sourceId: source.id },
    orderBy: { eventDate: "desc" },
    take: options?.limit,
  });

  let processed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  console.log(`[limitless-scraper] Starting deck import for ${tournaments.length} tournaments`);

  for (const tournament of tournaments) {
    console.log(
      `[limitless-scraper] Processing tournament ${tournament.id} - ${tournament.name} (${tournament.tournamentUrl})`
    );
    const results = await fetchTournamentResultRows(tournament.tournamentUrl);
    console.log(
      `[limitless-scraper] Found ${results.length} placements for tournament ${tournament.sourceTournamentId}`
    );

    for (const result of results) {
      if (!result.deckListId || !result.deckListUrl) {
        skipped += 1;
        continue;
      }

      processed += 1;
      const legacySourceDeckRef = `limitless-list-${result.deckListId}`;
      const sourceDeckRef = `limitless-${tournament.sourceTournamentId}-${result.deckListId}-${normalizeRefPart(
        result.playerName
      )}-${result.standing ?? "na"}`;

      let playerId: number | null = null;
      const playerSourceId = extractPlayerId(result.playerUrl);
      if (playerSourceId) {
        const playerRecord = await prisma.player.upsert({
          where: {
            source_sourcePlayerId: {
              source: LIMITLESS_SOURCE,
              sourcePlayerId: playerSourceId,
            },
          },
          update: {
            name: result.playerName,
            playerUrl: result.playerUrl,
          },
          create: {
            name: result.playerName,
            playerUrl: result.playerUrl,
            source: LIMITLESS_SOURCE,
            sourcePlayerId: playerSourceId,
          },
          select: { id: true },
        });
        playerId = playerRecord.id;
      }

      let existing = await prisma.tournamentDeck.findUnique({
        where: { sourceDeckRef },
      });

      if (!existing) {
        const legacy = await prisma.tournamentDeck.findUnique({
          where: { sourceDeckRef: legacySourceDeckRef },
        });
        if (legacy && legacy.tournamentId === tournament.id) {
          existing = legacy;
        }
      }

      let deckId = existing?.deckId ?? null;
      let leaderCardId = existing?.leaderCardId ?? null;

      if (!deckId) {
        try {
          console.log(
            `[limitless-scraper] Fetching deck list ${result.deckListId} for player ${result.playerName}`
          );
          const deckListData = await fetchDeckListCards(result.deckListUrl);
          const deckName =
            result.deckName && result.playerName
              ? `${result.deckName} - ${result.playerName}`
              : result.deckName || `${tournament.name} Deck`;

          const description = `${result.playerName} • ${tournament.name} • Placement: ${
            result.standing ?? "?"
          }`;

          const build = await upsertDeckFromList({
            listId: result.deckListId,
            listUrl: result.deckListUrl,
            deckName,
            description,
            playerName: result.playerName,
            tournamentName: tournament.name,
            cards: deckListData.cards,
            leaderCode: deckListData.leaderCode,
          });

          deckId = build.deckId;
          leaderCardId = build.leaderCardId;
        } catch (error) {
          console.error(
            `[limitless-scraper] Failed to build deck for list ${result.deckListId}`,
            error
          );
          skipped += 1;
          continue;
        }
      }

      if (existing) {
        await prisma.tournamentDeck.update({
          where: { id: existing.id },
          data: {
            tournamentId: tournament.id,
            deckId,
            leaderCardId,
            playerId,
            playerName: result.playerName,
            standing: result.standing,
            deckSourceUrl: result.deckListUrl,
            archetypeName: result.deckName,
            sourceDeckRef,
          },
        });
        updated += 1;
      } else {
        await prisma.tournamentDeck.create({
          data: {
            tournamentId: tournament.id,
            deckId,
            leaderCardId,
            playerId,
            playerName: result.playerName,
            standing: result.standing,
            deckSourceUrl: result.deckListUrl,
            archetypeName: result.deckName,
            sourceDeckRef,
          },
        });
        created += 1;
      }
    }
  }

  return {
    processed,
    created,
    updated,
    skipped,
    tournamentsProcessed: tournaments.length,
  };
}
