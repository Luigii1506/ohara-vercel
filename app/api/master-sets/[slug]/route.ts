import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { getMasterSetDetail } from "@/lib/master-sets/query";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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

    const variantMode = searchParams.get("variantMode") === "all" ? "all" : "base";
    const region = searchParams.get("region") || "all";

    const detail = await getMasterSetDetail(params.slug, {
      userId: user?.id ?? null,
      variantMode,
      region,
    });

    if (!detail) {
      return NextResponse.json(
        { error: "Master set not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[master-sets/detail] failed", error);
    return NextResponse.json(
      { error: "Failed to load master set detail" },
      { status: 500 }
    );
  }
}
