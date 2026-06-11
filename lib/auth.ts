import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  username: string;
  rol: "ADMINISTRADOR" | "PROPIETARIO";
}

export interface Session {
  user: SessionUser;
}

/**
 * Obtiene la sesión actual usando Supabase Auth.
 * Si Prisma/DB no está disponible, usa los user_metadata de Supabase como fallback.
 */
export async function auth(): Promise<Session | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Intentar buscar usuario en BD por supabaseId o email
    let dbUser: {
      id: string;
      username: string;
      email: string | null;
      firstName: string;
      lastName: string;
      rol: "ADMINISTRADOR" | "PROPIETARIO";
      isActive: boolean;
    } | null = null;

    try {
      dbUser = user.id
        ? await prisma.usuario.findFirst({
            where: {
              OR: [
                { supabaseId: user.id },
                { email: user.email ?? undefined },
              ],
            },
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
              rol: true,
              isActive: true,
            },
          })
        : null;
    } catch {
      // DB no disponible — usar fallback con metadata de Supabase
      const meta = user.user_metadata || {};
      const rol = (meta.rol as "ADMINISTRADOR" | "PROPIETARIO") || "PROPIETARIO";
      return {
        user: {
          id: user.id,
          name: meta.firstName
            ? `${meta.firstName} ${meta.lastName || ""}`.trim()
            : user.email?.split("@")[0] || "Usuario",
          email: user.email ?? null,
          username: meta.username || user.email?.split("@")[0] || "usuario",
          rol,
        },
      };
    }

    if (!dbUser || !dbUser.isActive) return null;

    // Vincular supabaseId si no estaba seteado
    if (!dbUser.id.includes("-")) {
      try {
        await prisma.usuario.update({
          where: { id: dbUser.id },
          data: { supabaseId: user.id },
        });
      } catch {
        // Ignorar si la DB no está disponible
      }
    }

    return {
      user: {
        id: dbUser.id,
        name: `${dbUser.firstName} ${dbUser.lastName}`.trim() || dbUser.username,
        email: dbUser.email ?? null,
        username: dbUser.username,
        rol: dbUser.rol,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Obtiene el usuario actual con su rol.
 * Helper rápido para Server Actions.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ?? null;
}
