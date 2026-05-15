import "next-auth";

declare module "next-auth" {
  interface User {
    username: string;
    rol: string;
  }
  interface Session {
    user: {
      id: string;
      username: string;
      rol: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username: string;
    rol: string;
  }
}
