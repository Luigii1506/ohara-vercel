export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const DOTGG_URL =
  "https://api.dotgg.gg/cgfw/getcards?game=onepiece&mode=indexed";
const CACHE_TTL_MS = 1000 * 60 * 15;

type DotggPayload = {
  names: string[];
  data: Array<Array<string | number | null>>;
};

type DotggCard = {
  id: string;
  code: string;
  name: string;
  rarity: string | null;
  cardType: string | null;
  cost: string | null;
  attribute: string | null;
  power: string | null;
  counter: string | null;
  life: string | null;
  trigger: string | null;
  colors: string[];
  types: string[];
  effect: string | null;
  setCode: string | null;
  setLabel: string | null;
  language: string | null;
  cmurl: string | null;
  slug: string | null;
};

type DotggFilters = {
  sets: string[];
  colors: string[];
};

let cachedCards: DotggCard[] | null = null;
let cachedFilters: DotggFilters | null = null;
let cachedAt = 0;

const normalizeSetCode = (value: string) =>
  value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

const splitList = (value: string | null) =>
  value
    ? value
        .split(/[\/,;]/g)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const extractSetCode = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/\[([A-Za-z0-9-]+)\]/);
  if (!match) return null;
  return normalizeSetCode(match[1]);
};

const buildFilters = (cards: DotggCard[]): DotggFilters => {
  const setCodes = new Set<string>();
  const colors = new Set<string>();

  cards.forEach((card) => {
    if (card.setCode) {
      setCodes.add(card.setCode);
    }
    card.colors.forEach((color) => colors.add(color));
  });

  return {
    sets: Array.from(setCodes).sort(),
    colors: Array.from(colors).sort(),
  };
};

const parsePayload = (payload: DotggPayload): DotggCard[] => {
  return payload.data.map((row) => {
    const record: Record<string, string | number | null> = {};
    payload.names.forEach((name, index) => {
      record[name] = row[index] ?? null;
    });

    const rawCode =
      (record.id_normal as string | null) ||
      (record.id as string | null) ||
      "";
    const cardSets = (record.CardSets as string | null) ?? null;
    const directSet = (record.set as string | null) ?? null;
    const setCode = directSet
      ? normalizeSetCode(directSet)
      : extractSetCode(cardSets);

    return {
      id: (record.id as string | null) || rawCode,
      code: rawCode,
      name: (record.name as string | null) || "Unknown",
      rarity: (record.rarity as string | null) ?? null,
      cardType: (record.cardType as string | null) ?? null,
      cost: (record.Cost as string | null) ?? null,
      attribute: (record.Attribute as string | null) ?? null,
      power: (record.Power as string | null) ?? null,
      counter: (record.Counter as string | null) ?? null,
      life: (record.Life as string | null) ?? null,
      trigger: (record.Trigger as string | null) ?? null,
      colors: splitList((record.Color as string | null) ?? null),
      types: splitList((record.Type as string | null) ?? null),
      effect: (record.Effect as string | null) ?? null,
      setCode,
      setLabel: cardSets,
      language: (record.language as string | null) ?? null,
      cmurl: (record.cmurl as string | null) ?? null,
      slug: (record.slug as string | null) ?? null,
    };
  });
};

const loadDotggCards = async () => {
  const now = Date.now();
  if (cachedCards && cachedFilters && now - cachedAt < CACHE_TTL_MS) {
    return { cards: cachedCards, filters: cachedFilters };
  }

  const response = await fetch(DOTGG_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Dotgg request failed");
  }

  const payload = (await response.json()) as DotggPayload;
  const cards = parsePayload(payload);
  const filters = buildFilters(cards);

  cachedCards = cards;
  cachedFilters = filters;
  cachedAt = now;

  return { cards, filters };
};

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const search = (params.get("search") || "").trim().toLowerCase();
    const setFilter = (params.get("set") || "all").trim().toUpperCase();
    const colorFilter = (params.get("color") || "all").trim().toLowerCase();
    const page = Math.max(Number(params.get("page") || "1"), 1);
    const limit = Math.min(Math.max(Number(params.get("limit") || "60"), 1), 200);

    const { cards, filters } = await loadDotggCards();

    const filtered = cards.filter((card) => {
      if (setFilter !== "ALL" && card.setCode !== setFilter) {
        return false;
      }

      if (
        colorFilter !== "all" &&
        !card.colors.some(
          (color) => color.toLowerCase() === colorFilter.toLowerCase()
        )
      ) {
        return false;
      }

      if (search) {
        const haystack = [
          card.name,
          card.code,
          card.cardType ?? "",
          card.setCode ?? "",
          card.setLabel ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return NextResponse.json(
      {
        items,
        total,
        page,
        pageSize: limit,
        totalPages,
        filters,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching dotgg cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch dotgg cards" },
      { status: 500 }
    );
  }
}
