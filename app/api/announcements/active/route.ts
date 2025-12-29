export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

const normalizeLocale = (value: string | null) => {
  if (!value) return "en";
  const lower = value.toLowerCase();
  return lower.startsWith("es") ? "es" : "en";
};

const resolveContent = (announcement: any, locale: "en" | "es") => {
  const isSpanish = locale === "es";
  return {
    title: isSpanish ? announcement.titleEs || announcement.titleEn : announcement.titleEn,
    body: isSpanish ? announcement.bodyEs || announcement.bodyEn : announcement.bodyEn,
    ctaLabel: isSpanish
      ? announcement.ctaLabelEs || announcement.ctaLabelEn
      : announcement.ctaLabelEn,
  };
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const params = req.nextUrl.searchParams;
    const screen = params.get("screen")?.trim() || null;
    const locale = normalizeLocale(params.get("locale") || params.get("lang"));
    const visitorId = params.get("visitorId")?.trim() || null;

    const now = new Date();
    const isAuthed = Boolean(session?.user?.id);
    const audience = isAuthed ? ["ALL", "AUTH"] : ["ALL", "GUEST"];
    const eventActor = isAuthed
      ? { userId: Number(session?.user?.id) }
      : visitorId
      ? { visitorId }
      : null;

    const where: any = {
      status: "PUBLISHED",
      audience: { in: audience },
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    };

    if (screen) {
      where.AND.push({
        OR: [{ screens: { has: screen } }, { screens: { isEmpty: true } }],
      });
    }

    if (eventActor) {
      where.AND.push({
        OR: [
          { showOnce: false },
          {
            events: {
              none: {
                type: { in: ["DISMISS", "CLICK"] },
                ...eventActor,
              },
            },
          },
        ],
      });
    }

    const announcement = await prisma.announcement.findFirst({
      where,
      orderBy: [{ priority: "desc" }, { startAt: "desc" }, { id: "desc" }],
    });

    if (!announcement) {
      return NextResponse.json({ announcement: null }, { status: 200 });
    }

    const content = resolveContent(announcement, locale);

    return NextResponse.json(
      {
        announcement: {
          id: announcement.id,
          version: announcement.version,
          showOnce: announcement.showOnce,
          ctaUrl: announcement.ctaUrl,
          screens: announcement.screens,
          ...content,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/announcements/active error:", error);
    return NextResponse.json(
      { error: "Failed to fetch announcement." },
      { status: 500 }
    );
  }
}
