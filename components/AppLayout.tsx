"use client";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide sidebar on the "Nova Fatura" / Edit page to give full space
  const isFullScreen = pathname.startsWith("/faturas/nova");

  if (isFullScreen) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
