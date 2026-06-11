export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol === "ADMINISTRADOR") redirect("/admin/dashboard");
  redirect("/propietario/dashboard");
}
