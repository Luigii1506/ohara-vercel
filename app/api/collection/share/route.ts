import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import { createCollectionShareToken } from "@/lib/collection-share";

// POST /api/collection/share - Crear token para compartir
export async function POST() {
  try {
    const user = await requireAuth();

    let collection = await prisma.collection.findUnique({
      where: { userId: user.id },
    });

    if (!collection) {
      collection = await prisma.collection.create({
        data: { userId: user.id },
      });
    }

    if (!collection.isPublic) {
      collection = await prisma.collection.update({
        where: { id: collection.id },
        data: { isPublic: true },
      });
    }

    const token = createCollectionShareToken(collection.id);
    return NextResponse.json({ token });
  } catch (error) {
    console.error("[api/collection/share] Error:", error);
    return handleAuthError(error);
  }
}
