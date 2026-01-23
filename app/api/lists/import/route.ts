export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListAccess,
} from "@/lib/auth-helpers";

const parseListId = (value: string | number | undefined | null) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/lists\/(\d+)/);
    if (match?.[1]) return Number.parseInt(match[1], 10);
  } catch {
    const match = trimmed.match(/\/lists\/(\d+)/);
    if (match?.[1]) return Number.parseInt(match[1], 10);
  }

  return null;
};

const getUniqueListName = async (userId: number, baseName: string) => {
  const trimmed = baseName.trim() || "Lista importada";
  const baseCandidate = `${trimmed} (Import)`;

  const existingBase = await prisma.userList.findFirst({
    where: { userId, name: baseCandidate },
    select: { id: true },
  });
  if (!existingBase) return baseCandidate;

  let counter = 2;
  while (counter < 50) {
    const candidate = `${trimmed} (Import ${counter})`;
    const exists = await prisma.userList.findFirst({
      where: { userId, name: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    counter += 1;
  }

  return `${trimmed} (Import ${Date.now()})`;
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const listId = parseListId(body?.listId ?? body?.url);

    if (!listId) {
      return NextResponse.json(
        { error: "URL o ID de lista inválido" },
        { status: 400 }
      );
    }

    const access = await validateListAccess(listId, user.id);
    if (!access.hasAccess || !access.list) {
      return NextResponse.json(
        { error: "Lista no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    const sourceList = await prisma.userList.findUnique({
      where: { id: listId },
      include: {
        cards: true,
        backcards: true,
      },
    });

    if (!sourceList) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    const newListName = await getUniqueListName(user.id, sourceList.name);

    const result = await prisma.$transaction(async (tx) => {
      const createdList = await tx.userList.create({
        data: {
          userId: user.id,
          name: newListName,
          description: sourceList.description,
          isOrdered: sourceList.isOrdered,
          maxRows: sourceList.maxRows,
          maxColumns: sourceList.maxColumns,
          totalPages: sourceList.totalPages,
          color: sourceList.color,
          isPublic: false,
          isDeletable: true,
          isCollection: false,
        },
      });

      if (sourceList.cards.length) {
        await tx.userListCard.createMany({
          data: sourceList.cards.map((card) => ({
            listId: createdList.id,
            cardId: card.cardId,
            quantity: card.quantity,
            sortOrder: card.sortOrder ?? null,
            page: card.page ?? null,
            row: card.row ?? null,
            column: card.column ?? null,
            notes: card.notes ?? null,
            condition: card.condition ?? null,
            customPrice: card.customPrice ?? null,
            customCurrency: card.customCurrency ?? null,
          })),
        });
      }

      if (sourceList.backcards.length) {
        await tx.userListBackcard.createMany({
          data: sourceList.backcards.map((backcard) => ({
            listId: createdList.id,
            page: backcard.page,
            row: backcard.row,
            column: backcard.column,
          })),
        });
      }

      return createdList;
    });

    return NextResponse.json({ list: result }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
