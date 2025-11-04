export const dynamic = 'force-dynamic';

// api/cards/rulings/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  try {
    // Recibir el archivo desde el FormData
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No se proporcionó un archivo válido." },
        { status: 400 }
      );
    }

    // Convertir el archivo a ArrayBuffer y leerlo con XLSX
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convertir la hoja a JSON (se respetan los encabezados del Excel)
    const data: Array<Record<string, any>> = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    //Iterar por cada fila del Excel
    for (const row of data) {
      // Extraer y limpiar los datos de cada columna
      const cardNo = row["Card No"]?.toString().trim();
      const cardName = row["Card Name"]?.toString().trim();
      const question = row["Question"]?.toString().trim();
      const answer = row["Answer"]?.toString().trim();

      // Validar que todos los campos requeridos estén presentes
      if (!cardNo || !cardName || !question || !answer) {
        console.warn("Fila incompleta, omitiendo:", row);
        continue;
      }

      // Buscar la carta usando "Card No" (asumido como el campo "code")
      const card = await prisma.card.findFirst({
        where: { code: cardNo, isFirstEdition: true },
      });

      if (!card) {
        console.warn(
          `No se encontró la carta con Card No: ${cardNo}, omitiendo fila.`
        );
        continue;
      }

      // (Opcional) Verificar que el nombre de la carta coincida con el Excel
      // if (card.name.toLowerCase() !== cardName.toLowerCase()) {
      //   console.warn(`El nombre de la carta no coincide: ${cardName} vs ${card.name}, omitiendo fila.`);
      //   continue;
      // }

      // Verificar si ya existe un ruling con la misma pregunta para esta carta
      const rulingExistente = await prisma.cardRuling.findFirst({
        where: {
          cardId: card.id,
          question: question,
        },
      });

      if (rulingExistente) {
        console.info(
          `Ruling ya existe para la carta ${cardNo} con la pregunta "${question}", omitiendo fila.`
        );
        continue;
      }

      // Crear el nuevo ruling
      await prisma.cardRuling.create({
        data: {
          cardId: card.id,
          question: question,
          answer: answer,
        },
      });
    }

    return NextResponse.json(
      { message: "Archivo procesado correctamente." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error al procesar el archivo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
