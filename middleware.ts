import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isMasterSetsPage =
    pathname === "/master-sets" || pathname.startsWith("/master-sets/");
  const isMasterSetsApi =
    pathname === "/api/master-sets" || pathname.startsWith("/api/master-sets/");

  // Permitir rutas públicas y archivos estáticos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // Solo interceptar rutas protegidas
  if (!isAdminRoute && !isMasterSetsPage && !isMasterSetsApi) {
    return NextResponse.next();
  }

  // Obtener el token que contiene el rol y demás datos
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Si no hay token o no se encontró email, redirige a login o responde 401 en API
  if (!token || !token.email) {
    if (isMasterSetsApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    if (isMasterSetsPage) {
      const callbackUrl = `${pathname}${request.nextUrl.search}`;
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Para todas las rutas de /admin, solo permitir ADMIN
  if (isAdminRoute && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/master-sets/:path*", "/api/master-sets/:path*"],
};
