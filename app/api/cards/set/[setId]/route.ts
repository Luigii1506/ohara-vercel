export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongoose";
import Card from "@/lib/models/card.model";
import UserCollection from "@/lib/models/collection.model";

import mongoose from "mongoose";

type Params = {
  setId: string;
};

export async function GET(req: Request, { params }: { params: Params }) {
  await connectToDB();

  const { setId } = params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (userId === "null") {
    try {
      const cards = await Card.find({ setCode: setId, isFirstEdition: true });
      return NextResponse.json({ cards: cards });
    } catch (error) {
      console.log("error", error);
      return NextResponse.json(
        { error: "Failed to fetch cards" },
        { status: 500 }
      );
    }
  } else {
    try {
      const [cards, cardCounts, collectionCountMap] = await Promise.all([
        // 1. Buscar las cartas por set y edición
        Card.find({ setCode: setId, isFirstEdition: true }),

        // 2. Obtener el total de cartas por código
        Card.aggregate([
          {
            $group: {
              _id: "$code",
              total: { $sum: 1 },
            },
          },
        ]),

        // 3. Obtener las cartas del usuario, si se proporcionó un userId
        userId
          ? UserCollection.aggregate([
              { $match: { userId: new mongoose.Types.ObjectId(userId) } },
              { $unwind: "$cards" },
              {
                $lookup: {
                  from: "cards",
                  localField: "cards.cardId",
                  foreignField: "_id",
                  as: "cardDetails",
                },
              },
              { $unwind: "$cardDetails" },
              // Eliminar el `$match` si no es necesario filtrar por `setId`
              {
                $group: {
                  _id: "$cardDetails.code", // Agrupamos por el código de la carta
                  cards: {
                    // Agrupamos un array de objetos que contenga el id y la cantidad
                    $push: {
                      id: "$cardDetails._id", // El id de la carta en la colección
                      quantity: { $sum: "$cards.quantity" }, // Contamos cuántas veces aparece
                    },
                  },
                },
              },
            ])
          : Promise.resolve([]),
      ]);

      // 4. Mapa para contar cuántas veces aparece cada carta en el set
      const countMap = cardCounts.reduce((acc, item) => {
        acc[item._id] = item.total;
        return acc;
      }, {});

      // 5. Mapa para las cartas de la colección del usuario, agrupadas por código y con un array de objetos (id, cantidad)
      const collectionCountMapObj = collectionCountMap.reduce((acc, item) => {
        acc[item._id] = item.cards; // Ahora almacenamos el array de objetos
        return acc;
      }, {});

      // 6. Mapeamos las cartas, agregando el total y el array de objetos con el id y la cantidad
      const cardsWithQuantities = cards.map((card) => ({
        ...card.toObject(),
        totalQuantity: countMap[card.code] || 0, // Total de la carta en el set
        totalInCollection: collectionCountMapObj[card.code] || [], // Ahora es un array de objetos
      }));

      return NextResponse.json({ cards: cardsWithQuantities });
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to fetch cards" },
        { status: 500 }
      );
    }
  }
}

// export async function GET(req: Request, { params }: { params: Params }) {
//     await connectToDB();

//     const { setId } = params;
//     const { searchParams } = new URL(req.url);
//     const userId = searchParams.get('userId');

//     try {
//         const [cards, cardCounts, collectionCountMap] = await Promise.all([
//             // 1. Buscar las cartas por set y edición
//             Card.find({ setCode: setId, isFirstEdition: true }),

//             // 2. Obtener el total de cartas por código
//             Card.aggregate([
//                 {
//                     $group: {
//                         _id: "$code",
//                         total: { $sum: 1 }
//                     }
//                 }
//             ]),

//             // 3. Obtener las cartas del usuario, si se proporcionó un userId
//             userId ? UserCollection.aggregate([
//                 { $match: { userId: new mongoose.Types.ObjectId(userId) } },
//                 { $unwind: "$cards" },
//                 {
//                     $lookup: {
//                         from: "cards",
//                         localField: "cards.cardId",
//                         foreignField: "_id",
//                         as: "cardDetails"
//                     }
//                 },
//                 { $unwind: "$cardDetails" },
//                 // Eliminar el `$match` si no es necesario filtrar por `setId`
//                 {
//                     $group: {
//                         _id: "$cardDetails.code", // Agrupamos por el código de la carta
//                         cards: { // Agrupamos un array de objetos que contenga el id y la cantidad
//                             $push: {
//                                 id: "$cardDetails._id", // El id de la carta en la colección
//                                 quantity: { $sum: "$cards.quantity" } // Contamos cuántas veces aparece
//                             }
//                         },
//                     }
//                 }
//             ]) : Promise.resolve([])
//         ]);

//         // 4. Mapa para contar cuántas veces aparece cada carta en el set
//         const countMap = cardCounts.reduce((acc, item) => {
//             acc[item._id] = item.total;
//             return acc;
//         }, {});

//         // 5. Mapa para las cartas de la colección del usuario, agrupadas por código y con un array de objetos (id, cantidad)
//         const collectionCountMapObj = collectionCountMap.reduce((acc, item) => {
//             acc[item._id] = item.cards; // Ahora almacenamos el array de objetos
//             return acc;
//         }, {});

//         // 6. Mapeamos las cartas, agregando el total y el array de objetos con el id y la cantidad
//         const cardsWithQuantities = cards.map(card => ({
//             ...card.toObject(),
//             totalQuantity: countMap[card.code] || 0, // Total de la carta en el set
//             totalInCollection: collectionCountMapObj[card.code] || []
//         }));

//         return NextResponse.json({ cards: cardsWithQuantities });

//     } catch (error) {
//         return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
//     }
// }

// const firstEditionCards = await Card.find({ setCode: setId, isFirstEdition: true });

// const userCollection = await UserCollection.aggregate([
//     {
//         $match: { userId: new mongoose.Types.ObjectId(userId) }
//     },
//     {
//         $unwind: "$cards"
//     },
//     {
//         $lookup: {
//             from: "cards",
//             localField: "cards.cardId",
//             foreignField: "_id",
//             as: "cardDetails"
//         }
//     },
//     {
//         $unwind: "$cardDetails"
//     },
//     {
//         $match: { "cardDetails.setCode": setId }
//     },
//     {
//         $group: {
//             _id: "$cardDetails.code",
//             quantity: { $sum: "$cards.quantity" },
//         }
//     }
// ]);

// const quantityMap = userCollection.reduce((acc, item) => {
//     acc[item._id] = item.quantity;
//     return acc;
// }, {});

// const cardsWithQuantities = firstEditionCards.map(card => {
//     const cardObject = card.toObject();
//     return {
//         ...cardObject,
//         quantity: quantityMap[cardObject.code] || 0
//     };
// });
