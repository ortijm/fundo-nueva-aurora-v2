"use client";

import { createClient } from "@/lib/supabase/client";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Inicializar el cliente Supabase para manejo de sesión vía cookies
  createClient();
  return <>{children}</>;
}
