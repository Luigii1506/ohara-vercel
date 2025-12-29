export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeScreens = (input: unknown) => {
  if (!input) return null;
  if (Array.isArray(input)) {
    const clean = input
      .map((value) => String(value).trim())
      .filter(Boolean);
    return clean.length ? clean : null;
  }
  const raw = String(input)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return raw.length ? raw : null;
};

export async function GET() {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: [{ createdAt: "desc" }],
    });

    const metrics = await prisma.announcementEvent.groupBy({
      by: ["announcementId", "type"],
      _count: { _all: true },
    });

    const metricsByAnnouncement = metrics.reduce(
      (acc, item) => {
        if (!acc[item.announcementId]) {
          acc[item.announcementId] = {
            impressions: 0,
            dismisses: 0,
            clicks: 0,
          };
        }
        if (item.type === "IMPRESSION") {
          acc[item.announcementId].impressions = item._count._all;
        }
        if (item.type === "DISMISS") {
          acc[item.announcementId].dismisses = item._count._all;
        }
        if (item.type === "CLICK") {
          acc[item.announcementId].clicks = item._count._all;
        }
        return acc;
      },
      {} as Record<
        number,
        { impressions: number; dismisses: number; clicks: number }
      >
    );

    const payload = announcements.map((announcement) => ({
      ...announcement,
      metrics: metricsByAnnouncement[announcement.id] || {
        impressions: 0,
        dismisses: 0,
        clicks: 0,
      },
    }));

    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/admin/announcements error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const screens = normalizeScreens(body.screens);

    const announcement = await prisma.announcement.create({
      data: {
        titleEn: body.titleEn,
        bodyEn: body.bodyEn,
        ctaLabelEn: body.ctaLabelEn || null,
        titleEs: body.titleEs || null,
        bodyEs: body.bodyEs || null,
        ctaLabelEs: body.ctaLabelEs || null,
        ctaUrl: body.ctaUrl || null,
        audience: body.audience || "ALL",
        status: body.status || "DRAFT",
        screens,
        startAt: parseDate(body.startAt),
        endAt: parseDate(body.endAt),
        priority: Number(body.priority) || 0,
        version: Number(body.version) || 1,
        showOnce: body.showOnce ?? true,
      },
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/announcements error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
