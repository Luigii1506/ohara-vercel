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
  const match = normalized.match(/^(.*\d)([A-Z]+)$/);
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

const fetchCardInfo = async (
  id: number
): Promise<CardInfoResponse["info"] | null> => {
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

const buildAlternateKey = (code: string, variantKey: string | null) =>
  `${code.toUpperCase()}__${(variantKey || "").toUpperCase()}`;

const main = async () => {
  const options = parseArgs();
  const baseCodes = new Set<string>();
  const allowedAlternateKeys = new Set<string>();

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
        if (!parsed.baseCode) continue;
        baseCodes.add(parsed.baseCode);
        if (parsed.variantKey) {
          allowedAlternateKeys.add(
            buildAlternateKey(parsed.baseCode, parsed.variantKey)
          );
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

  const alternates = await prisma.card.findMany({
    where: {
      region: "CN",
      code: { in: codes },
      isFirstEdition: false,
    },
    select: {
      id: true,
      code: true,
      alias: true,
      order: true,
      baseCardId: true,
      setCode: true,
    },
  });

  if (!alternates.length) {
    console.log("[skip] No alternates found for these codes.");
    return;
  }

  const baseCards = await prisma.card.findMany({
    where: {
      region: "CN",
      code: { in: codes },
      isFirstEdition: true,
    },
    select: { id: true, code: true, setCode: true },
  });
  const baseSetByCode = new Map<string, string>();
  for (const base of baseCards) {
    baseSetByCode.set(base.code.toUpperCase(), base.setCode.toUpperCase());
  }

  const toEB02: number[] = [];
  const toBaseSet: Array<{ id: number; setCode: string }> = [];
  const missingBase: number[] = [];

  for (const alt of alternates) {
    const variantKey = (alt.alias || alt.order || "").toUpperCase() || null;
    const key = buildAlternateKey(alt.code, variantKey);
    if (allowedAlternateKeys.has(key)) {
      if (alt.setCode.toUpperCase() !== targetSetCode) {
        toEB02.push(alt.id);
      }
      continue;
    }
    const baseSetCode = baseSetByCode.get(alt.code.toUpperCase());
    if (!baseSetCode) {
      missingBase.push(alt.id);
      continue;
    }
    if (alt.setCode.toUpperCase() !== baseSetCode) {
      toBaseSet.push({ id: alt.id, setCode: baseSetCode });
    }
  }

  console.log(
    `[plan] Alternates to EB02=${toEB02.length} alternates to base set=${toBaseSet.length} missing base=${missingBase.length}`
  );

  if (options.dryRun) {
    return;
  }

  if (toEB02.length) {
    for (const chunk of chunkArray(toEB02, 500)) {
      await prisma.card.updateMany({
        where: { id: { in: chunk } },
        data: { setCode: targetSetCode },
      });
      if (targetSet?.id) {
        await prisma.cardSet.deleteMany({ where: { cardId: { in: chunk } } });
        await prisma.cardSet.createMany({
          data: chunk.map((cardId) => ({ cardId, setId: targetSet.id })),
          skipDuplicates: true,
        });
      }
    }
  }

  if (toBaseSet.length) {
    const bySet = new Map<string, number[]>();
    for (const entry of toBaseSet) {
      const bucket = bySet.get(entry.setCode) ?? [];
      bucket.push(entry.id);
      bySet.set(entry.setCode, bucket);
    }

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

    for (const [setCode, ids] of Array.from(bySet.entries())) {
      for (const chunk of chunkArray(ids, 500)) {
        await prisma.card.updateMany({
          where: { id: { in: chunk } },
          data: { setCode },
        });
      }

      const setId = await resolveSetId(setCode);
      if (setId) {
        for (const chunk of chunkArray(ids, 500)) {
          await prisma.cardSet.deleteMany({ where: { cardId: { in: chunk } } });
          await prisma.cardSet.createMany({
            data: chunk.map((cardId) => ({ cardId, setId })),
            skipDuplicates: true,
          });
        }
      } else {
        console.log(
          `[warn] Set ${setCode} not found; set relations not updated.`
        );
      }
    }
  }

  console.log("[done] alternate setCode corrected.");
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
