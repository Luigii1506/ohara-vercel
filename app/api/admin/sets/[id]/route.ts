export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Obtener un set por ID
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;

    try {
        const set = await prisma.set.findUnique({
            where: { id: parseInt(id) },
            include: {
                cards: true, // Relacionar las cartas asociadas al set
                events: true, // Relacionar los eventos asociados al set
            },
        });

        if (!set) {
            return NextResponse.json({ error: "Set no encontrado" }, { status: 404 });
        }

        return NextResponse.json(set, { status: 200 });
    } catch (error: any) {
        console.error("Error en GET /api/sets/[id]:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH - Actualizar un set por ID
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;

    try {
        const body = await req.json();
        const { image, title, code, version, releaseDate, isOpen } = body;

        const updatedSet = await prisma.set.update({
            where: { id: parseInt(id) },
            data: {
                image,
                title,
                code,
                version,
                releaseDate: releaseDate ? new Date(releaseDate) : undefined, // Validar fecha
                isOpen,
            },
        });

        return NextResponse.json(updatedSet, { status: 200 });
    } catch (error: any) {
        console.error("Error en PATCH /api/sets/[id]:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE - Eliminar un set por ID
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;

    try {
        // Primero verificamos si el set existe
        const existingSet = await prisma.set.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existingSet) {
            return NextResponse.json({ error: "Set no encontrado" }, { status: 404 });
        }

        // Eliminamos el set
        await prisma.set.delete({
            where: { id: parseInt(id) },
        });

        return NextResponse.json({ message: "Set eliminado exitosamente" }, { status: 200 });
    } catch (error: any) {
        console.error("Error en DELETE /api/sets/[id]:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}