import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isLoggedIn = !!user;
  const rol = user?.user_metadata?.rol as string | undefined;

  // Rutas públicas que no requieren auth
  const publicRoutes = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/api/auth/",
  ];
  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r));
  const isStaticFile =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/);

  if (isStaticFile) return supabaseResponse;

  // Login — redirigir si ya está autenticado
  if (pathname.startsWith("/login")) {
    if (isLoggedIn) {
      const dest =
        rol === "ADMINISTRADOR" ? "/admin/dashboard" : "/propietario/dashboard";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return supabaseResponse;
  }

  // Requiere autenticación
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protección por rol
  if (pathname.startsWith("/admin") && rol !== "ADMINISTRADOR") {
    return NextResponse.redirect(
      new URL("/propietario/dashboard", request.url)
    );
  }
  if (pathname.startsWith("/propietario") && rol !== "PROPIETARIO") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  // Ruta raíz → redirigir según rol
  if (pathname === "/") {
    const dest =
      rol === "ADMINISTRADOR" ? "/admin/dashboard" : "/propietario/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
