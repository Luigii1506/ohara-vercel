export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  mergeSetAliases,
  normalizeSetTitle,
  parseLimitlessSlug,
} from "@/lib/sets/normalization";

// GET - Obtener un set por ID
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;

    try {
        const set = await prisma.set.findUnique({
            where: { id: parseInt(id) },
            include: {
                cards: true, // Relacionar las cartas asociadas al set
                events: true, // Relacionar los eventos asociados al set
                setSources: true,
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
        const { image, code, version, releaseDate, isOpen } = body;
        const title = typeof body?.title === "string" ? body.title.trim() : undefined;
        const limitlessUrl =
            typeof body?.limitlessUrl === "string" ? body.limitlessUrl.trim() : undefined;
        const targetId = parseInt(id);

        const existingSet = await prisma.set.findUnique({
            where: { id: targetId },
            select: { id: true, title: true, aliasesJson: true },
        });

        if (!existingSet) {
            return NextResponse.json({ error: "Set no encontrado" }, { status: 404 });
        }

        if (title && normalizeSetTitle(title) !== normalizeSetTitle(existingSet.title)) {
            const allSets = await prisma.set.findMany({
                select: { id: true, title: true },
            });

            const duplicate = allSets.find(
                (set) =>
                    set.id !== targetId &&
                    normalizeSetTitle(set.title) === normalizeSetTitle(title)
            );

            if (duplicate) {
                return NextResponse.json(
                    {
                        error: "Ya existe un set equivalente con ese nombre",
                        existingSetId: duplicate.id,
                        existingSetTitle: duplicate.title,
                    },
                    { status: 409 }
                );
            }
        }

        await prisma.set.update({
            where: { id: targetId },
            data: {
                image,
                title,
                code,
                version,
                releaseDate: releaseDate ? new Date(releaseDate) : undefined, // Validar fecha
                isOpen,
                aliasesJson: title
                    ? mergeSetAliases(existingSet.aliasesJson, [existingSet.title, title])
                    : undefined,
            },
        });

        if (limitlessUrl !== undefined) {
            if (limitlessUrl === "") {
                await prisma.setSource.deleteMany({
                    where: { setId: targetId, source: "limitless" },
                });
            } else {
                await prisma.setSource.upsert({
                    where: { setId_source: { setId: targetId, source: "limitless" } },
                    create: {
                        setId: targetId,
                        source: "limitless",
                        sourceUrl: limitlessUrl,
                        sourceSlug: parseLimitlessSlug(limitlessUrl),
                    },
                    update: {
                        sourceUrl: limitlessUrl,
                        sourceSlug: parseLimitlessSlug(limitlessUrl),
                    },
                });
            }
        }

        const updatedSet = await prisma.set.findUnique({
            where: { id: targetId },
            include: { setSources: true },
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
