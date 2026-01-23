"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Archive,
  Import,
  FilePlus,
  Settings,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: "Faturas Ativas", href: "/", icon: <LayoutDashboard size={20} /> },
    {
      name: "Histórico Importado",
      href: "/historico",
      icon: <Archive size={20} />,
    },
    { name: "Importar Excel", href: "/import", icon: <Import size={20} /> },
    { name: "Configurações", href: "/settings", icon: <Settings size={20} /> },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-gray-100 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
          S
        </div>
        <span className="text-xl font-bold text-gray-800">Shifaa Fatura</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.icon}
                {item.name}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-gray-100 mt-auto">
        <div className="text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
            Project Invoice Shifaa
          </p>
          <p className="text-[10px] text-gray-500 font-medium">
            developed by{" "}
            <span className="text-gray-900 font-bold">Zakir Abdul Magide</span>
          </p>
          <p className="text-[9px] text-gray-400 mt-1">v1.0</p>
        </div>
      </div>
    </div>
  );
}
