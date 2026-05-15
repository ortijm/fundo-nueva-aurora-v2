import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, resetRateLimit } from "@/lib/ratelimit";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Rate limiting por IP
        const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const rateCheck = await checkRateLimit(`login:${ip}`, "login");
        if (!rateCheck.allowed) {
          return null;
        }

        const user = await prisma.usuario.findUnique({
          where: { username: parsed.data.username },
        });

        if (!user || !user.password || !user.isActive) return null;

        const passwordMatch = await bcrypt.compare(
          parsed.data.password,
          user.password
        );
        if (!passwordMatch) return null;

        // Login exitoso — resetear contador
        await resetRateLimit(`login:${ip}`, "login");

        return {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim() || user.username,
          email: user.email ?? undefined,
          username: user.username,
          rol: user.rol,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.username = (user as { username: string }).username;
        token.rol = (user as { rol: string }).rol;
      }

      // Verificar isActive en cada request (si el usuario ya existe)
      if (token.id && trigger !== "signIn") {
        const dbUser = await prisma.usuario.findUnique({
          where: { id: token.id as string },
          select: { isActive: true },
        });
        if (!dbUser || !dbUser.isActive) {
          return {}; // Token vacío → logout forzado
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.rol = token.rol as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },
});
