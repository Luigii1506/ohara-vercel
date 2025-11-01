import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas públicas y archivos estáticos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // Proteger todas las rutas que estén dentro de /admin
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Obtener el token que contiene el rol y demás datos
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Si no hay token o no se encontró email, redirige a login
  if (!token || !token.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Para todas las rutas de /admin, solo permitir ADMIN
  if (token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

// Aplicar el middleware a todas las rutas que comiencen con /admin
export const config = {
  matcher: ["/admin/:path*"],
};
