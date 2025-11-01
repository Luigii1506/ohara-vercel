export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongoose";
import Card from "@/lib/models/card.model";
import UserCollection from "@/lib/models/collection.model";
import mongoose, { set } from "mongoose";
import Set from "@/lib/models/set.model";

type Params = {
    id: string;
};

export async function GET(req: Request, { params }: { params: Params }) {
    await connectToDB();
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (userId === "null") {
        try {
            const card = await Card.findById(id);
            if (!card) {
                return NextResponse.json({ error: 'Card not found' }, { status: 404 });
            }

            const relatedCards = await Card.find({ code: card.code, _id: { $ne: id }, isFirstEdition: false })
                .select('src name _id set') // Seleccionamos también el campo set
                .populate({
                    model: Set,
                    path: 'set',
                    select: 'title', // Seleccionamos solo el campo name de los objetos en el arreglo set
                });


            const relatedCardsWithQuantity = await Promise.all(relatedCards.map(async (relatedCard) => {
                let quantity = 0;
                return {
                    ...relatedCard.toObject(),
                    quantity,
                    set: relatedCard.set[0].title, // Accedemos al primer elemento del arreglo set y seleccionamos el campo title
                };
            }));



            return NextResponse.json({ card: card, relatedCards: relatedCardsWithQuantity });
        } catch (error) {
            return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 });
        }
    } else {
        try {
            const card = await Card.findById(id);
            if (!card) {
                return NextResponse.json({ error: 'Card not found' }, { status: 404 });
            }

            let cardQuantity = 0;

            if (userId) {
                const userCollection = await UserCollection.findOne({ userId: new mongoose.Types.ObjectId(userId), 'cards.cardId': id });
                if (userCollection) {
                    const cardInCollection = userCollection.cards.find((c: { cardId: { toString: () => string; }; }) => c.cardId.toString() === id);
                    cardQuantity = cardInCollection ? cardInCollection.quantity : 0;
                }
            }


            // const relatedCards = await Card.find({ code: card.code, _id: { $ne: id }, isFirstEdition: false })
            //     .select('src name _id');


            const relatedCards = await Card.find({ code: card.code, _id: { $ne: id }, isFirstEdition: false })
                .select('src name _id set') // Seleccionamos también el campo set
                .populate({
                    model: Set,
                    path: 'set',
                    select: 'title', // Seleccionamos solo el campo name de los objetos en el arreglo set
                });


            const cardWithQuantity = {
                ...card.toObject(),
                quantity: cardQuantity,
            };


            const relatedCardsWithQuantity = await Promise.all(relatedCards.map(async (relatedCard) => {
                let quantity = 0;
                if (userId) {
                    const userCollection = await UserCollection.findOne({ userId: new mongoose.Types.ObjectId(userId), 'cards.cardId': relatedCard._id });
                    if (userCollection) {
                        const relatedCardInCollection = userCollection.cards.find((c: { cardId: string }) => c.cardId.toString() === relatedCard._id.toString());
                        quantity = relatedCardInCollection ? relatedCardInCollection.quantity : 0;
                    }
                }
                return {
                    ...relatedCard.toObject(),
                    quantity,
                    set: relatedCard.set[0].title, // Accedemos al primer elemento del arreglo set y seleccionamos el campo title
                };
            }));


            return NextResponse.json({ card: cardWithQuantity, relatedCards: relatedCardsWithQuantity });

        } catch (error) {
            console.log('hehe', error);
            return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 });
        }
    }


}
