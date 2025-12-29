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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }

    const body = await req.json();
    const screens = normalizeScreens(body.screens) ?? [];

    const announcement = await prisma.announcement.update({
      where: { id },
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

    return NextResponse.json(announcement, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/admin/announcements/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }

    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error("DELETE /api/admin/announcements/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
