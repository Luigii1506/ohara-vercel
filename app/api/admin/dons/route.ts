import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  DON_CATEGORY,
  includeDonRelations,
  parseSetIds,
  sanitizeOptionalString,
} from "./utils";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const search = sanitizeOptionalString(searchParams.get("search"));
    const cursorParam = searchParams.get("cursor");
    const limitParam = Number(searchParams.get("limit"));
    const baseCardParam = searchParams.get("baseCardId");
    const baseCardId = baseCardParam ? Number(baseCardParam) : null;

    if (baseCardParam && (!Number.isInteger(baseCardId) || baseCardId! <= 0)) {
      return NextResponse.json(
        { error: "baseCardId must be a positive integer" },
        { status: 400 }
      );
    }

    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const cursor = cursorParam ? Number(cursorParam) : null;

    const where: Prisma.CardWhereInput = {
      category: DON_CATEGORY,
    };

    if (baseCardId && Number.isInteger(baseCardId) && baseCardId > 0) {
      where.baseCardId = baseCardId;
      const dons = await prisma.card.findMany({
        where,
        orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
        include: includeDonRelations,
      });
      return NextResponse.json(dons, { status: 200 });
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { alias: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { setCode: { contains: search, mode: "insensitive" } },
      ];
    }

    const dons = await prisma.card.findMany({
      where,
      orderBy: [
        { updatedAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      include: includeDonRelations,
    });

    const hasMore = dons.length > limit;
    const items = hasMore ? dons.slice(0, -1) : dons;
    const nextCursor = hasMore && items.length ? items[items.length - 1].id : null;

    return NextResponse.json(
      {
        items,
        hasMore,
        nextCursor,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching Don!! cards", error);
    return NextResponse.json(
      { error: "Failed to load Don!! cards" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, code, setCode, src, imageKey } = body;

    if (!name || !code || !setCode || !src) {
      return NextResponse.json(
        { error: "name, code, setCode and src are required" },
        { status: 400 }
      );
    }

    const alias = sanitizeOptionalString(body.alias);
    const tcgUrl = sanitizeOptionalString(body.tcgUrl);
    const order = sanitizeOptionalString(body.order) ?? "0";
    const region = sanitizeOptionalString(body.region);
    const isFirstEdition =
      typeof body.isFirstEdition === "boolean" ? body.isFirstEdition : false;
    const setIds = parseSetIds(body.setIds);
    const baseCardIdValue =
      typeof body.baseCardId === "number"
        ? body.baseCardId
        : body.baseCardId
        ? Number(body.baseCardId)
        : null;

    if (baseCardIdValue && (!Number.isInteger(baseCardIdValue) || baseCardIdValue <= 0)) {
      return NextResponse.json(
        { error: "baseCardId must be a positive integer" },
        { status: 400 }
      );
    }

    if (baseCardIdValue) {
      const baseCardExists = await prisma.card.findUnique({
        where: { id: baseCardIdValue },
        select: { id: true },
      });
      if (!baseCardExists) {
        return NextResponse.json(
          { error: "Base card not found" },
          { status: 400 }
        );
      }
    }

    const newCard = await prisma.card.create({
      data: {
        name,
        code,
        setCode,
        src,
        imageKey: imageKey ?? null,
        alias,
        tcgUrl,
        order,
        region,
        category: DON_CATEGORY,
        isFirstEdition,
        isPro: Boolean(body.isPro),
        ...(baseCardIdValue ? { baseCardId: baseCardIdValue } : {}),
      },
    });

    if (setIds.length) {
      await prisma.cardSet.createMany({
        data: setIds.map((setId) => ({
          cardId: newCard.id,
          setId,
        })),
      });
    }

    const fullCard = await prisma.card.findUnique({
      where: { id: newCard.id },
      include: includeDonRelations,
    });

    return NextResponse.json(fullCard, { status: 201 });
  } catch (error) {
    console.error("Error creating Don!! card", error);
    return NextResponse.json(
      { error: "Failed to create Don!! card" },
      { status: 500 }
    );
  }
}
