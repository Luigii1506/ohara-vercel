export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const title = params.get("title")?.trim();
    const code = params.get("code")?.trim();
    const version = params.get("version")?.trim();
    const limitParam = parseInt(params.get("limit") ?? "5", 10);
    const limit = Number.isNaN(limitParam)
      ? 5
      : Math.min(Math.max(limitParam, 1), 25);

    if (!title && !code && !version) {
      return NextResponse.json(
        { error: "title, code or version query param is required" },
        { status: 400 }
      );
    }

    const orConditions: Prisma.SetWhereInput[] = [];
    if (title) {
      orConditions.push({
        title: {
          contains: title,
          mode: "insensitive",
        },
      });
    }
    if (code) {
      orConditions.push({
        code: {
          equals: code,
          mode: "insensitive",
        },
      });
    }
    if (version) {
      orConditions.push({
        version: {
          equals: version,
          mode: "insensitive",
        },
      });
    }

    const sets = await prisma.set.findMany({
      where: { OR: orConditions },
      orderBy: [{ createdAt: "desc" }],
      take: limit,
    });

    return NextResponse.json(sets, { status: 200 });
  } catch (error) {
    console.error("Error searching sets:", error);
    return NextResponse.json(
      { error: "Failed to search sets" },
      { status: 500 }
    );
  }
}
