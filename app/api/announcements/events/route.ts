export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

const VALID_TYPES = new Set(["IMPRESSION", "DISMISS", "CLICK"]);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const announcementId = Number(body.announcementId);
    const type = String(body.type || "").toUpperCase();
    const visitorId = body.visitorId ? String(body.visitorId) : null;
    const screen = body.screen ? String(body.screen) : null;
    const locale = body.locale ? String(body.locale) : null;

    if (!announcementId || Number.isNaN(announcementId)) {
      return NextResponse.json(
        { error: "announcementId is required." },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    }

    const userId = session?.user?.id ? Number(session.user.id) : null;
    if (!userId && !visitorId) {
      return NextResponse.json(
        { error: "visitorId is required for guests." },
        { status: 400 }
      );
    }

    if (type !== "IMPRESSION") {
      const existing = await prisma.announcementEvent.findFirst({
        where: {
          announcementId,
          type: type as any,
          ...(userId ? { userId } : { visitorId }),
        },
      });

      if (existing) {
        return NextResponse.json({ ok: true }, { status: 200 });
      }
    }

    await prisma.announcementEvent.create({
      data: {
        announcementId,
        type: type as any,
        userId: userId || undefined,
        visitorId: userId ? undefined : visitorId || undefined,
        screen: screen || undefined,
        locale: locale || undefined,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("POST /api/announcements/events error:", error);
    return NextResponse.json(
      { error: "Failed to record event." },
      { status: 500 }
    );
  }
}
