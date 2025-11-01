import { connectToDB } from "@/lib/mongoose";
import Set from "@/lib/models/set.model";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import mongoose from "mongoose";

export async function POST(req: NextRequest, res: NextResponse) {
  if (req.method !== "POST") {
    return NextResponse.json({ message: "Only POST requests are allowed" }, { status: 405 });
  }

  try {
    await connectToDB();

    // Actualizar los documentos que no tienen el campo `type`
    const result = await Set.updateMany(
      { type: { $exists: false } }, // Filtrar los que no tienen el campo `type`
      { $set: { type: "booster pack" } } // Establecer el valor por defecto
    );

    console.log("Sets updated successfully:", result);

    return NextResponse.json({ message: "Sets updated successfully", result }, { status: 200 });
  } catch (error) {
    console.error("Error updating sets:", error);
    return NextResponse.json({ message: "Failed to update sets" }, { status: 500 });
  }
}
