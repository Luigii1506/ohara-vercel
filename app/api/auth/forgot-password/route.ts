import { NextResponse } from "next/server";
import { createPasswordResetRequest } from "@/lib/password-reset";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Debes proporcionar un correo válido" },
        { status: 400 }
      );
    }

    await createPasswordResetRequest(email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en forgot-password:", error);
    return NextResponse.json({ success: true });
  }
}
