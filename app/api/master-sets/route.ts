import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { getMasterSetSummaries } from "@/lib/master-sets/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const session = await getServerSession(authOptions);
    const user = session?.user?.email
      ? await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true },
        })
      : null;

    const search = searchParams.get("search")?.trim() || undefined;
    const variantMode = searchParams.get("variantMode") === "all" ? "all" : "base";
    const region = searchParams.get("region") || "all";

    const items = await getMasterSetSummaries({
      userId: user?.id ?? null,
      search,
      variantMode,
      region,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[master-sets] failed", error);
    return NextResponse.json(
      { error: "Failed to load master sets" },
      { status: 500 }
    );
  }
}
