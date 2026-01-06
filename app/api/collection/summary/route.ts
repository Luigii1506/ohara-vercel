import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : null;
    if (!userId) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const collection = await prisma.collection.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!collection?.id) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const items = await prisma.collectionCard.findMany({
      where: { collectionId: collection.id },
      select: {
        cardId: true,
        quantity: true,
      },
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("Error fetching collection summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection summary" },
      { status: 500 }
    );
  }
}
