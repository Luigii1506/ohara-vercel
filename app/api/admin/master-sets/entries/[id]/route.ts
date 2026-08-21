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

async function resolveCard(value: unknown) {
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

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const forbidden = assertAdmin(user);
    if (forbidden) return forbidden;

    const entryId = Number(context.params.id);
    if (!Number.isInteger(entryId) || entryId <= 0) {
      return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";

    const entry = await db.characterCameoSourceEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        sheetId: true,
        characterId: true,
        relationType: true,
      },
    });

    if (!entry || !entry.characterId) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (action === "ignore") {
      await prisma.$transaction([
        db.characterCameoSourceEntry.update({
          where: { id: entryId },
          data: {
            matchedCardId: null,
            status: "IGNORED",
            notes: "Ignored by admin",
          },
        }),
        db.cardCharacterLink.deleteMany({
          where: { sourceEntryId: entryId },
        }),
      ]);

      return NextResponse.json({ ok: true });
    }

    if (action === "unmatch") {
      await prisma.$transaction([
        db.characterCameoSourceEntry.update({
          where: { id: entryId },
          data: {
            matchedCardId: null,
            status: "UNMATCHED",
            notes: "Reset to unmatched by admin",
          },
        }),
        db.cardCharacterLink.deleteMany({
          where: { sourceEntryId: entryId },
        }),
      ]);

      return NextResponse.json({ ok: true });
    }

    if (action !== "match") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const card = await resolveCard(body?.cardCode ?? body?.cardId);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await (tx as any).characterCameoSourceEntry.update({
        where: { id: entryId },
        data: {
          matchedCardId: card.id,
          status: "MATCHED",
          notes: `Matched manually by admin to ${card.code}`,
        },
      });

      await (tx as any).cardCharacterLink.upsert({
        where: {
          unique_card_character_relation: {
            cardId: card.id,
            characterId: entry.characterId,
            relationType: entry.relationType,
          },
        },
        update: {
          source: "GOOGLE_SHEET",
          sourceSheetId: entry.sheetId,
          sourceEntryId: entry.id,
          notes: `Matched manually from imported row ${entry.id}`,
        },
        create: {
          cardId: card.id,
          characterId: entry.characterId,
          relationType: entry.relationType,
          source: "GOOGLE_SHEET",
          sourceSheetId: entry.sheetId,
          sourceEntryId: entry.id,
          notes: `Matched manually from imported row ${entry.id}`,
        },
      });
    });

    return NextResponse.json({ ok: true, card });
  } catch (error) {
    return handleAuthError(error);
  }
}
