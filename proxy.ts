import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const rol = req.auth?.user?.rol;

  // Login — redirigir si ya está autenticado
  if (pathname.startsWith("/login")) {
    if (isLoggedIn) {
      const dest =
        rol === "ADMINISTRADOR" ? "/admin/dashboard" : "/propietario/dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  // Requiere autenticación
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Protección por rol
  if (pathname.startsWith("/admin") && rol !== "ADMINISTRADOR") {
    return NextResponse.redirect(
      new URL("/propietario/dashboard", req.url)
    );
  }
  if (pathname.startsWith("/propietario") && rol !== "PROPIETARIO") {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  // Ruta raíz → redirigir según rol
  if (pathname === "/") {
    const dest =
      rol === "ADMINISTRADOR" ? "/admin/dashboard" : "/propietario/dashboard";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|forgot-password|reset-password|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
