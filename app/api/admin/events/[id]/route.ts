export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// * GET: Obtener un evento por ID, incluyendo los sets asociados
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;

    try {
        const event = await prisma.event.findUnique({
            where: { id: parseInt(id) },
            include: {
                sets: {
                    include: {
                        set: true, // Incluir información completa de cada set relacionado
                    },
                },
            },
        });

        if (!event) {
            return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
        }

        return NextResponse.json(event, { status: 200 });
    } catch (error: any) {
        console.error("Error en GET /api/events/[id]:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// * PUT: Actualizar un evento por ID, incluyendo sets asociados
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;

    try {
        const body = await req.json();
        const { name, eventDate, location, setIds } = body; // setIds: Array con IDs de sets a asociar o reemplazar

        // Actualizamos la información básica del evento
        const updatedEvent = await prisma.event.update({
            where: { id: parseInt(id) },
            data: {
                name,
                eventDate: new Date(eventDate),
                location,
            },
        });

        // Actualizamos las relaciones con sets en la tabla pivote EventSet
        if (setIds && Array.isArray(setIds)) {
            // 1. Eliminar las relaciones existentes en EventSet
            await prisma.eventSet.deleteMany({
                where: { eventId: parseInt(id) },
            });

            // 2. Crear las nuevas relaciones
            const setRelations = setIds.map((setId: number) => ({
                eventId: updatedEvent.id,
                setId: setId,
            }));

            if (setRelations.length > 0) {
                await prisma.eventSet.createMany({
                    data: setRelations,
                });
            }
        }

        return NextResponse.json(updatedEvent, { status: 200 });
    } catch (error: any) {
        console.error("Error en PUT /api/events/[id]:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// * DELETE: Eliminar un evento por ID, incluyendo sus relaciones con sets
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;

    try {
        // Eliminar relaciones existentes en EventSet
        await prisma.eventSet.deleteMany({
            where: { eventId: parseInt(id) },
        });

        // Eliminar el evento
        await prisma.event.delete({
            where: { id: parseInt(id) },
        });

        return NextResponse.json(
            { message: "Evento y sus relaciones eliminados exitosamente" },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Error en DELETE /api/events/[id]:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}