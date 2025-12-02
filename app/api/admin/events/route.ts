export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

// * GET: Obtener todos los eventos, incluyendo los sets asociados
export async function GET(req: NextRequest) {
    try {
        const events = await prisma.event.findMany({
            include: {
                sets: {
                    include: {
                        set: true, // Incluir información completa de cada set relacionado
                    },
                },
            },
        });

        return NextResponse.json(events, { status: 200 });
    } catch (error: any) {
        console.error("Error en GET /api/events:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// * POST: Crear un nuevo evento, incluyendo sets asociados
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, eventDate, location, setIds } = body; // setIds: Array con IDs de sets a asociar

        if (!name || !eventDate) {
            return NextResponse.json(
                { error: "name y eventDate son obligatorios" },
                { status: 400 }
            );
        }

        const baseSlug = slugify(name);
        let slug = baseSlug || `event-${Date.now()}`;
        let suffix = 1;
        while (await prisma.event.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${suffix++}`;
        }

        // Crear el nuevo evento junto con las relaciones en EventSet
        const newEvent = await prisma.event.create({
            data: {
                slug,
                title: name,
                startDate: new Date(eventDate),
                location,
                sets: setIds && Array.isArray(setIds)
                    ? {
                        create: setIds.map((setId: number) => ({
                            setId: setId,
                        })),
                    }
                    : undefined,
            },
        });

        return NextResponse.json(newEvent, { status: 201 });
    } catch (error: any) {
        console.error("Error en POST /api/events:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
