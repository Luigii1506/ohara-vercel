import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { getMasterSetSummariesPage } from "@/lib/master-sets/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session?.user?.email
      ? await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true },
        })
      : null;

    const search = searchParams.get("search")?.trim() || undefined;
    const variantMode = searchParams.get("variantMode") === "all" ? "all" : "base";
    const region = searchParams.get("region") || "all";
    const relationType = searchParams.get("relationType") || "all";
    const limit = Number(searchParams.get("limit") || "24");
    const cursorValue = searchParams.get("cursor");
    const cursor = cursorValue ? Number(cursorValue) : null;

    const page = await getMasterSetSummariesPage({
      userId: user?.id ?? null,
      search,
      variantMode,
      region,
      relationType,
      limit: Number.isFinite(limit) ? limit : 24,
      cursor: Number.isFinite(cursor as number) ? cursor : null,
    });

    return NextResponse.json(page);
  } catch (error) {
    console.error("[master-sets] failed", error);
    return NextResponse.json(
      { error: "Failed to load master sets" },
      { status: 500 }
    );
  }
}
