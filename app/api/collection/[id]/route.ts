export const dynamic = 'force-dynamic';

// Importar el modelo de UserCollection y conectarse a la base de datos
import { connectToDB } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import UserCollection from "@/lib/models/collection.model";
import { IUserCollection, ICard } from "@/app/types/types"; // Ajusta la ruta según donde hayas creado el archivo
import Card from "@/lib/models/card.model";
import mongoose from "mongoose";

type Params = {
  id: string;
};

export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = params;
    await connectToDB();

    const userCollection = await UserCollection.findOne({
      userId: id,
    }).populate({
      path: "cards.cardId",
      model: Card,
    });

    if (!userCollection) {
      return NextResponse.json(
        { message: "No se encontró la colección para este usuario." },
        { status: 404 }
      );
    }

    return NextResponse.json({ collection: userCollection }, { status: 200 });
  } catch (error) {
    console.error("Error obteniendo la colección:", error);
    return NextResponse.json(
      { message: "Error al obtener la colección." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = params;
    const { cardId, quantity, setCode } = await req.json();

    await connectToDB();

    const userCollection = await UserCollection.findOne({ userId: id });

    if (!userCollection) {
      return NextResponse.json({ message: "No se encontró la colección del usuario." }, { status: 404 });
    }

    // Buscar si la carta ya existe en la colección del usuario
    const existingCard = userCollection.cards.find((c: ICard) => c.cardId.toString() === cardId);

    if (quantity > 0) {
      // Si la cantidad es mayor que 0
      if (existingCard) {
        // Si la carta ya existe, sobrescribir la cantidad
        existingCard.quantity = quantity;
      } else {
        // Si la carta no existe, agregarla con la cantidad proporcionada
        const newCard = { cardId, quantity };
        userCollection.cards.push(newCard);
      }
    } else if (quantity === 0 && existingCard) {
      // Si la cantidad es 0 y la carta existe, eliminarla de la colección
      userCollection.cards = userCollection.cards.filter((c: ICard) => c.cardId.toString() !== cardId);
    }

    // Guardar los cambios en la colección del usuario
    await userCollection.save();

    return NextResponse.json({
      message: "Colección actualizada exitosamente.",
    }, { status: 200 });
  } catch (error) {
    console.error("Error al actualizar la colección:", error);
    return NextResponse.json({ message: "Error al actualizar la colección." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = params;
    const { cardId } = await req.json();

    await connectToDB();

    const userCollection = await UserCollection.findOne({ userId: id });

    if (!userCollection) {
      return NextResponse.json(
        { message: "No se encontró la colección del usuario." },
        { status: 404 }
      );
    }

    userCollection.cards = userCollection.cards.filter(
      (c: ICard) => c.cardId.toString() !== cardId
    );

    await userCollection.save();

    return NextResponse.json(
      { message: "Carta eliminada de la colección." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error eliminando la carta de la colección:", error);
    return NextResponse.json(
      { message: "Error al eliminar la carta de la colección." },
      { status: 500 }
    );
  }
}
