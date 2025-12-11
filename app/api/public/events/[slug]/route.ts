export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;

    const event = await prisma.event.findFirst({
      where: {
        slug,
        isApproved: true, // Solo eventos aprobados
      },
      include: {
        sets: {
          include: {
            set: {
              include: {
                attachments: {
                  orderBy: {
                    id: "asc",
                  },
                },
                cards: {
                  include: {
                    card: true,
                  },
                  take: 20,
                  orderBy: {
                    cardId: "asc",
                  },
                },
              },
            },
          },
          orderBy: {
            setId: "asc",
          },
        },
        cards: {
          include: {
            card: {
              include: {
                sets: {
                  include: {
                    set: true,
                  },
                },
              },
            },
          },
          orderBy: {
            cardId: "asc",
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event, { status: 200 });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}
