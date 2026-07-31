#!/usr/bin/env ts-node

import "dotenv/config";
import axios from "axios";
import { PrismaClient } from "@prisma/client";

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
    cardNumber: string;
  };
};

const BASE_URL = "https://onepieceserve.windoent.com";
const CARDLIST_PATH = "/cardList/cardlist/weblist";
const CARDINFO_PATH = "/cardList/cardlist/webInfo/";

const OFFER_TYPES = ["宣传卡", "限定商品收录卡牌"];

const prisma = new PrismaClient();

const parseBaseCode = (value: string) => {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return null;
  if (trimmed.includes("_")) {
    const [base] = trimmed.split("_");
    return base || null;
  }
  const match = trimmed.match(/^(.*\d)([A-Z]+)$/);
  if (match) return match[1];
  return trimmed;
};

const fetchCardListPage = async (
  offerType: string,
  page: number,
  limit: number
) => {
  const params: Record<string, string | number> = {
    page,
    limit,
    cardOfferType: offerType,
  };
  const response = await axios.get<CardListResponse>(
    `${BASE_URL}${CARDLIST_PATH}`,
    { params }
  );
  return response.data;
};

const fetchCardInfo = async (id: number) => {
  const response = await axios.get<CardInfoResponse>(
    `${BASE_URL}${CARDINFO_PATH}${id}`
  );
  if (response.data.code !== 0) return null;
  return response.data.info ?? null;
};

const collectBaseCodesForOfferType = async (offerType: string) => {
  const baseCodes = new Set<string>();
  const pageSize = 50;
  let page = 1;
  let totalPage = 1;

  while (page <= totalPage) {
    const listResponse = await fetchCardListPage(offerType, page, pageSize);
    totalPage = listResponse.page?.totalPage ?? 1;
    const ids = listResponse.page?.list?.map((item) => item.id) ?? [];

    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const infos = await Promise.all(batch.map((id) => fetchCardInfo(id)));
      for (const info of infos) {
        if (!info?.cardNumber) continue;
        const baseCode = parseBaseCode(info.cardNumber);
        if (baseCode) baseCodes.add(baseCode);
      }
    }
    page += 1;
  }

  return baseCodes;
};

const chunk = <T>(list: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
};

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");
  const offerTypeFilterArg = process.argv.find((arg) =>
    arg.startsWith("--offer-type=")
  );
  const offerTypes = offerTypeFilterArg
    ? offerTypeFilterArg
        .split("=")[1]
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean) || []
    : OFFER_TYPES;

  if (!offerTypes.length) {
    console.log("[info] No offer types provided.");
    return;
  }

  const prefixArg = process.argv.find((arg) => arg.startsWith("--prefix="));
  const prefixFilter = prefixArg
    ? prefixArg.split("=")[1]?.toUpperCase().trim() || null
    : null;

  const baseCodes = new Set<string>();
  for (const offerType of offerTypes) {
    console.log(`[offer-type] ${offerType}`);
    const codes = await collectBaseCodesForOfferType(offerType);
    console.log(`[offer-type] ${offerType} base codes: ${codes.size}`);
    codes.forEach((code) => baseCodes.add(code));
  }

  const codes = Array.from(baseCodes).filter((code) =>
    prefixFilter ? code.startsWith(prefixFilter) : true
  );
  console.log(
    `[info] Total base codes: ${codes.length}${prefixFilter ? ` (prefix ${prefixFilter})` : ""}`
  );

  if (!codes.length) {
    console.log("[info] No codes found to delete.");
    return;
  }

  if (dryRun) {
    console.log("[dry-run] No deletions performed.");
    return;
  }

  const codeChunks = chunk(codes, 500);
  let deletedCards = 0;
  let deletedCardSets = 0;

  for (const chunkCodes of codeChunks) {
    const cards = await prisma.card.findMany({
      where: {
        region: "CN",
        code: { in: chunkCodes },
      },
      select: { id: true },
    });

    const cardIds = cards.map((card) => card.id);
    if (!cardIds.length) continue;

    const removedCardSets = await prisma.cardSet.deleteMany({
      where: { cardId: { in: cardIds } },
    });
    deletedCardSets += removedCardSets.count;

    const removedCards = await prisma.card.deleteMany({
      where: { id: { in: cardIds } },
    });
    deletedCards += removedCards.count;
  }

  console.log(
    `[delete] cards=${deletedCards} cardSetLinks=${deletedCardSets}`
  );
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
