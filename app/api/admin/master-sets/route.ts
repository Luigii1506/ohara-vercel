import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { normalizeCardCode } from "@/lib/master-sets/google-sheet";

export const dynamic = "force-dynamic";

const db = prisma as any;

function assertAdmin(user: { role?: string | null }) {
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

async function resolveCardByCodeOrId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return prisma.card.findUnique({
      where: { id: value },
      select: { id: true, code: true, name: true },
    });
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalizedCode = normalizeCardCode(value);
  if (!normalizedCode) return null;

  const cards = await prisma.card.findMany({
    where: { code: normalizedCode },
    select: {
      id: true,
      code: true,
      name: true,
      region: true,
      baseCardId: true,
      isFirstEdition: true,
    },
  });

  return [...cards].sort((left, right) => {
    const leftScore =
      (left.region === "US" ? 100 : 0) +
      (left.baseCardId === null ? 10 : 0) +
      (left.isFirstEdition ? 1 : 0);
    const rightScore =
      (right.region === "US" ? 100 : 0) +
      (right.baseCardId === null ? 10 : 0) +
      (right.isFirstEdition ? 1 : 0);

    return rightScore - leftScore || left.id - right.id;
  })[0];
}

export async function GET(_request: NextRequest) {
  try {
    const user = await requireAuth();
    const forbidden = assertAdmin(user);
    if (forbidden) return forbidden;

    const [
      charactersCount,
      sourceSheetsCount,
      sourceRowsCount,
      unresolvedRowsCount,
      linksCount,
      manualLinksCount,
      characters,
      sheets,
      unresolvedEntries,
      recentManualLinks,
    ] = await Promise.all([
      db.characterEntity.count({ where: { isActive: true } }),
      db.characterSourceSheet.count({ where: { isActive: true } }),
      db.characterCameoSourceEntry.count({ where: { isActive: true } }),
      db.characterCameoSourceEntry.count({
        where: {
          isActive: true,
          status: "UNMATCHED",
        },
      }),
      db.cardCharacterLink.count(),
      db.cardCharacterLink.count({ where: { source: "MANUAL" } }),
      db.characterEntity.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      }),
      db.characterSourceSheet.findMany({
        where: { isActive: true },
        orderBy: [{ lastSyncedAt: "desc" }, { sheetName: "asc" }],
        take: 80,
        select: {
          id: true,
          gid: true,
          sheetName: true,
          lastSyncedAt: true,
          lastRowCount: true,
          syncNotes: true,
          character: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      db.characterCameoSourceEntry.findMany({
        where: {
          isActive: true,
          status: "UNMATCHED",
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 60,
        select: {
          id: true,
          rowNumber: true,
          sourceCardName: true,
          sourceCardCode: true,
          sourceCardType: true,
          sourceVariant: true,
          specialSet: true,
          notes: true,
          sheet: {
            select: { id: true, sheetName: true, gid: true },
          },
          character: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      db.cardCharacterLink.findMany({
        where: { source: "MANUAL" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 40,
        select: {
          id: true,
          relationType: true,
          notes: true,
          updatedAt: true,
          character: {
            select: { id: true, name: true, slug: true },
          },
          card: {
            select: {
              id: true,
              code: true,
              name: true,
              src: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      stats: {
        charactersCount,
        sourceSheetsCount,
        sourceRowsCount,
        unresolvedRowsCount,
        linksCount,
        manualLinksCount,
      },
      characters,
      sheets,
      unresolvedEntries,
      recentManualLinks,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const forbidden = assertAdmin(user);
    if (forbidden) return forbidden;

    const body = await request.json().catch(() => ({}));
    const characterId = Number(body?.characterId);
    const relationType =
      typeof body?.relationType === "string" ? body.relationType : null;
    const notes =
      typeof body?.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null;

    if (!Number.isInteger(characterId) || characterId <= 0) {
      return NextResponse.json(
        { error: "characterId is required" },
        { status: 400 }
      );
    }

    if (
      relationType !== "DEPICTED_IN_ART" &&
      relationType !== "THEME_OF_CARD" &&
      relationType !== "MENTIONED_IN_NAME" &&
      relationType !== "MENTIONED_IN_TEXT" &&
      relationType !== "MENTIONED_IN_TRIGGER"
    ) {
      return NextResponse.json(
        { error: "Invalid relationType" },
        { status: 400 }
      );
    }

    const [character, card] = await Promise.all([
      db.characterEntity.findUnique({
        where: { id: characterId },
        select: { id: true, name: true, slug: true },
      }),
      resolveCardByCodeOrId(body?.cardCode ?? body?.cardId),
    ]);

    if (!character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const link = await db.cardCharacterLink.upsert({
      where: {
        unique_card_character_relation: {
          cardId: card.id,
          characterId: character.id,
          relationType,
        },
      },
      update: {
        source: "MANUAL",
        sourceSheetId: null,
        sourceEntryId: null,
        notes,
      },
      create: {
        cardId: card.id,
        characterId: character.id,
        relationType,
        source: "MANUAL",
        notes,
      },
      select: {
        id: true,
        relationType: true,
        notes: true,
        updatedAt: true,
        character: {
          select: { id: true, name: true, slug: true },
        },
        card: {
          select: { id: true, code: true, name: true, src: true },
        },
      },
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
