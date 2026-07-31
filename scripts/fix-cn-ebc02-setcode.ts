#!/usr/bin/env ts-node

import "dotenv/config";
import axios from "axios";
import { PrismaClient } from "@prisma/client";

const BASE_URL = "https://onepieceserve.windoent.com";
const CARDLIST_PATH = "/cardList/cardlist/weblist";
const CARDINFO_PATH = "/cardList/cardlist/webInfo/";

type CardListResponse = {
  code: number;
  msg: string;
  page: {
    currPage: number;
    totalPage: number;
    pageSize: number;
    totalCount: number;
    list: { id: number; cardImg: string }[];
  };
};

type CardInfoResponse = {
  code: number;
  msg: string;
  info: {
    id: number;
    cardNumber: string | null;
  };
};

const prisma = new PrismaClient();

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    offerType: "",
    targetSetCode: "EB02",
    dryRun: args.includes("--dry-run"),
    repairBases: args.includes("--repair-bases"),
    onlyRepairBases: args.includes("--only-repair-bases"),
  };

  for (const arg of args) {
    if (arg.startsWith("--offer-type=")) {
      options.offerType = arg.split("=")[1] ?? "";
    } else if (arg.startsWith("--setcode=")) {
      options.targetSetCode = arg.split("=")[1] ?? options.targetSetCode;
    }
  }

  if (!options.offerType) {
    throw new Error("Missing --offer-type");
  }

  return options;
};

const parseCardNumberParts = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized.includes("_")) {
    const [base, variant] = normalized.split("_");
    if (base && variant) {
      return { baseCode: base, variantKey: variant };
    }
  }
  const match = normalized.match(/^(.*\\d)([A-Z]+)$/);
  if (!match) {
    return { baseCode: normalized, variantKey: null };
  }
  return { baseCode: match[1], variantKey: match[2] };
};

const fetchCardListPage = async (
  offerType: string,
  page: number,
  limit: number
): Promise<CardListResponse> => {
  const params: Record<string, string | number> = { page, limit };
  params.cardOfferType = offerType;
  const response = await axios.get<CardListResponse>(
    `${BASE_URL}${CARDLIST_PATH}`,
    { params }
  );
  return response.data;
};

const fetchCardInfo = async (id: number): Promise<CardInfoResponse["info"] | null> => {
  const response = await axios.get<CardInfoResponse>(
    `${BASE_URL}${CARDINFO_PATH}${id}`
  );
  if (response.data.code !== 0) return null;
  return response.data.info ?? null;
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const main = async () => {
  const options = parseArgs();
  const baseCodes = new Set<string>();

  const pageSize = 50;
  let page = 1;
  let totalPage = 1;

  while (page <= totalPage) {
    const listResponse = await fetchCardListPage(
      options.offerType,
      page,
      pageSize
    );
    totalPage = listResponse.page?.totalPage ?? 1;
    const ids = listResponse.page?.list?.map((item) => item.id) ?? [];
    for (const batch of chunkArray(ids, 5)) {
      const infos = await Promise.all(batch.map((id) => fetchCardInfo(id)));
      for (const info of infos) {
        const raw = info?.cardNumber?.trim();
        if (!raw) continue;
        const parsed = parseCardNumberParts(raw);
        if (parsed.baseCode) {
          baseCodes.add(parsed.baseCode);
        }
      }
    }
    page += 1;
  }

  const codes = Array.from(baseCodes);
  if (!codes.length) {
    console.log("[skip] No card codes found for offer type.");
    return;
  }

  const targetSetCode = options.targetSetCode.toUpperCase();
  const targetSet = await prisma.set.findFirst({
    where: {
      code: { equals: targetSetCode, mode: "insensitive" },
    },
    select: { id: true },
  });

  const cardsToProcess: Array<{
    id: number;
    code: string;
    isFirstEdition: boolean;
    baseCardId: number | null;
    setCode: string;
  }> = [];

  for (const chunk of chunkArray(codes, 500)) {
    const cards = await prisma.card.findMany({
      where: {
        region: "CN",
        code: { in: chunk },
      },
      select: {
        id: true,
        code: true,
        isFirstEdition: true,
        baseCardId: true,
        setCode: true,
      },
    });
    cardsToProcess.push(...cards);
  }

  if (!cardsToProcess.length) {
    console.log("[skip] No CN cards found for these codes.");
    return;
  }

  const alternateIds = cardsToProcess
    .filter(
      (card) =>
        (!card.isFirstEdition || card.baseCardId !== null) &&
        card.setCode.toUpperCase() !== targetSetCode
    )
    .map((card) => card.id);

  const baseGroups = new Map<string, number[]>();
  if (options.repairBases) {
    for (const card of cardsToProcess) {
      if (!card.isFirstEdition || card.baseCardId !== null) continue;
      const derived = card.code.split("-")[0]?.trim().toUpperCase();
      if (!derived) continue;
      if (card.setCode.toUpperCase() === derived) continue;
      const bucket = baseGroups.get(derived) ?? [];
      bucket.push(card.id);
      baseGroups.set(derived, bucket);
    }
  }

  console.log(
    `[plan] Alternates to update=${alternateIds.length} targetSet=${targetSetCode}`
  );
  if (options.repairBases) {
    const baseCount = Array.from(baseGroups.values()).reduce(
      (sum, ids) => sum + ids.length,
      0
    );
    console.log(`[plan] Base cards to repair=${baseCount}`);
  }

  if (options.dryRun) {
    return;
  }

  if (!options.onlyRepairBases && alternateIds.length) {
    for (const chunk of chunkArray(alternateIds, 500)) {
      await prisma.card.updateMany({
        where: { id: { in: chunk } },
        data: { setCode: targetSetCode },
      });
    }

    if (targetSet?.id) {
      for (const chunk of chunkArray(alternateIds, 500)) {
        await prisma.cardSet.deleteMany({ where: { cardId: { in: chunk } } });
        await prisma.cardSet.createMany({
          data: chunk.map((cardId) => ({ cardId, setId: targetSet.id })),
          skipDuplicates: true,
        });
      }
    } else {
      console.log(
        `[warn] Set ${targetSetCode} not found; alternate set relations were not updated.`
      );
    }
  }

  if (options.repairBases && baseGroups.size) {
    const setCache = new Map<string, number | null>();
    const resolveSetId = async (code: string) => {
      if (setCache.has(code)) return setCache.get(code) ?? null;
      const set = await prisma.set.findFirst({
        where: { code: { equals: code, mode: "insensitive" } },
        select: { id: true },
      });
      setCache.set(code, set?.id ?? null);
      return set?.id ?? null;
    };

    for (const [derived, ids] of Array.from(baseGroups.entries())) {
      for (const chunk of chunkArray(ids, 500)) {
        await prisma.card.updateMany({
          where: { id: { in: chunk } },
          data: { setCode: derived },
        });
      }

      const setId = await resolveSetId(derived);
      if (setId) {
        for (const chunk of chunkArray(ids, 500)) {
          await prisma.cardSet.deleteMany({ where: { cardId: { in: chunk } } });
          await prisma.cardSet.createMany({
            data: (chunk as number[]).map((cardId) => ({ cardId, setId })),
            skipDuplicates: true,
          });
        }
      } else {
        console.log(
          `[warn] Set ${derived} not found; base set relations were not updated.`
        );
      }
    }
  }

  console.log("[done] setCode corrected.");
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
