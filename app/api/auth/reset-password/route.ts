import { NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/password-reset";

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    await consumePasswordResetToken(token, password);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error en reset-password:", error);
    return NextResponse.json(
      { error: error?.message ?? "No fue posible actualizar la contraseña" },
      { status: 400 }
    );
  }
}
