import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function PropietarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user.rol !== "PROPIETARIO") {
    redirect("/login");
  }

  const userName =
    session.user.name || session.user.username || "Propietario";

  return (
    <div className="min-h-screen">
      <div className="hidden lg:block">
        <Sidebar rol="PROPIETARIO" userName={userName} />
      </div>
      <Topbar rol="PROPIETARIO" userName={userName} />
      <main className="lg:pl-60 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
