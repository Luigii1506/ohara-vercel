export const dynamic = 'force-dynamic';

// Importar el modelo de UserCollection y conectarse a la base de datos
import { connectToDB } from "@/lib/mongoose";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import UserCollection from "@/lib/models/collection.model";
import Card from "@/lib/models/card.model";

// Obtener todas las colecciones de todos los usuarios
export async function GET() {
    try {
        await connectToDB();

        const collections = await UserCollection.find().populate({
            path: "cards.cardId",
            model: Card,
        });

        return NextResponse.json({ collections }, { status: 200 });
    } catch (error) {
        console.error("Error obteniendo colecciones:", error);
        return NextResponse.json({ message: "Error al obtener colecciones." }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json();

        await connectToDB();

        const existingCollection = await UserCollection.findOne({ userId });

        if (existingCollection) {
            return NextResponse.json({ message: "El usuario ya tiene una colección." }, { status: 400 });
        }

        const newCollection = new UserCollection({ userId, cards: [] });

        await newCollection.save();

        return NextResponse.json({ message: "Colección creada exitosamente, sin cartas aún." }, { status: 201 });
    } catch (error) {
        console.error("Error creando la colección:", error);
        return NextResponse.json({ message: "Error al crear la colección." }, { status: 500 });
    }
}