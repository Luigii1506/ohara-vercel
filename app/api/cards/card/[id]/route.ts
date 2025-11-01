export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongoose";
import Card from "@/lib/models/card.model";
import UserCollection from "@/lib/models/collection.model";
import mongoose, { set } from "mongoose";

type Params = {
  id: string;
};

export async function GET(req: Request, { params }: { params: Params }) {
  await connectToDB();
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const setCodeUrl = searchParams.get("setCodeUrl");

  try {
    const card = await Card.findOne({ code: id });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // 2. Crear una nueva carta con la misma información, excepto el setCode
    const newCardData = {
      ...card.toObject(), // Copiar todos los campos de la carta original
      _id: new mongoose.Types.ObjectId(), // Generar un nuevo ObjectId para la nueva carta
      setCode: setCodeUrl, // Actualizar el setCode con el valor del parámetro
      set: [], // Limpiar el campo "set" para evitar duplicados
    };

    // 3. Crear y guardar la nueva carta en la base de datos
    const newCard = await Card.create(newCardData);

    // 4. Devolver la nueva carta creada
    return NextResponse.json(newCard, { status: 201 });
  } catch (error) {
    console.log("hehe", error);
    return NextResponse.json(
      { error: "Failed to fetch card" },
      { status: 500 }
    );
  }
}
