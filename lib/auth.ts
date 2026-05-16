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
 * Reemplaza el antiguo auth() de NextAuth.
 */
export async function auth(): Promise<Session | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Buscar usuario en BD por supabaseId o email
    const dbUser = user.id
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

    if (!dbUser || !dbUser.isActive) return null;

    // Vincular supabaseId si no estaba seteado
    if (!dbUser.id.includes("-")) {
      // Es un cuid, no un UUID de Supabase — actualizar
      await prisma.usuario.update({
        where: { id: dbUser.id },
        data: { supabaseId: user.id },
      });
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
