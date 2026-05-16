"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Inicializa el cliente de Supabase para manejar sesión vía cookies
  const [ready, setReady] = useState(false);

  useEffect(() => {
    createClient();
    setReady(true);
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
