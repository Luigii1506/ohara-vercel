import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth } from "@/lib/auth-helpers";
import {
  BUYLIST_SESSION_INCLUDE,
  validateOwnedOperationalList,
} from "@/lib/buylist/session";

export const dynamic = "force-dynamic";

function mergeNotes(existing: string | null | undefined, incoming: string) {
  const next = incoming.trim();
  if (!next) return existing?.trim() || null;
  if (!existing?.trim()) return next;
  if (existing.includes(next)) return existing.trim();
  return `${existing.trim()}\n${next}`;
}

function getUniqueInventoryName(baseName: string) {
  const trimmed = baseName.trim() || "Inventario";
  return `${trimmed} · Inventario`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessionId = Number(params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }

    const session = await prisma.buylistSession.findFirst({
      where: { id: sessionId, userId: user.id },
      include: { items: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedListResult = await validateOwnedOperationalList(
      body?.targetListId ?? session.resultListId,
      user.id
    );

    if ("error" in requestedListResult) {
      return NextResponse.json(
        {
          error:
            requestedListResult.error === "invalid"
              ? "ID de inventario inválido"
              : "Inventario no encontrado o sin permisos",
        },
        { status: requestedListResult.error === "invalid" ? 400 : 404 }
      );
    }

    if (requestedListResult.list?.isOrdered) {
      return NextResponse.json(
        { error: "El inventario destino no puede ser una carpeta ordenada" },
        { status: 400 }
      );
    }

    const markCompleted = body?.markCompleted === true;
    const cardItems = session.items.filter((item) => item.cardId);

    if (cardItems.length === 0) {
      return NextResponse.json(
        { error: "La compra no tiene cartas para enviar a inventario" },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      let targetList = requestedListResult.list;

      if (!targetList) {
        let desiredName = getUniqueInventoryName(session.title);
        let counter = 2;

        while (
          await tx.userList.findFirst({
            where: { userId: user.id, name: desiredName },
            select: { id: true },
          })
        ) {
          desiredName = `${getUniqueInventoryName(session.title)} ${counter}`;
          counter += 1;
        }

        targetList = await tx.userList.create({
          data: {
            userId: user.id,
            name: desiredName,
            description: `Inventario generado desde buylist #${session.id}`,
            isOrdered: false,
            totalPages: 1,
            isPublic: false,
            isDeletable: true,
            isCollection: false,
            purpose: "INVENTORY",
            displayCurrency: "USD",
          },
          select: {
            id: true,
            name: true,
            purpose: true,
            isOrdered: true,
            userId: true,
            isCollection: true,
          },
        });
      }

      if (!targetList) {
        throw new Error("No se pudo resolver el inventario destino");
      }

      let createdCount = 0;
      let updatedCount = 0;

      for (const item of cardItems) {
        const existing = await tx.userListCard.findFirst({
          where: {
            listId: targetList.id,
            cardId: item.cardId!,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });

        const note = `Buylist #${session.id} · ${item.purchaseCurrency} ${item.purchasePrice} · ${item.condition || "N/A"}`;

        if (existing) {
          await tx.userListCard.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + item.quantity,
              condition: existing.condition || item.condition || null,
              notes: mergeNotes(existing.notes, note),
            },
          });
          updatedCount += 1;
        } else {
          const maxSortOrder = await tx.userListCard.findFirst({
            where: { listId: targetList.id },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
          });

          await tx.userListCard.create({
            data: {
              listId: targetList.id,
              cardId: item.cardId!,
              quantity: item.quantity,
              condition: item.condition || null,
              notes: mergeNotes(item.notes, note),
              sortOrder: (maxSortOrder?.sortOrder || 0) + 10,
            },
          });
          createdCount += 1;
        }
      }

      await tx.buylistSession.update({
        where: { id: session.id },
        data: {
          resultListId: targetList.id,
          ...(markCompleted ? { status: "COMPLETED" } : {}),
        },
      });

      const nextSession = await tx.buylistSession.findUnique({
        where: { id: session.id },
        include: BUYLIST_SESSION_INCLUDE,
      });

      return {
        session: nextSession,
        targetList,
        createdCount,
        updatedCount,
        skippedProducts: session.items.length - cardItems.length,
      };
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return handleAuthError(error);
  }
}
