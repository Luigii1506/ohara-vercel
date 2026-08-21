import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const db = prisma as any;

function assertAdmin(user: { role?: string | null }) {
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function DELETE(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const forbidden = assertAdmin(user);
    if (forbidden) return forbidden;

    const linkId = Number(context.params.id);
    if (!Number.isInteger(linkId) || linkId <= 0) {
      return NextResponse.json({ error: "Invalid link id" }, { status: 400 });
    }

    const link = await db.cardCharacterLink.findUnique({
      where: { id: linkId },
      select: { id: true, source: true, sourceEntryId: true },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await (tx as any).cardCharacterLink.delete({
        where: { id: linkId },
      });

      if (link.source === "GOOGLE_SHEET" && link.sourceEntryId) {
        await (tx as any).characterCameoSourceEntry.update({
          where: { id: link.sourceEntryId },
          data: {
            matchedCardId: null,
            status: "UNMATCHED",
            notes: "Link removed by admin",
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
