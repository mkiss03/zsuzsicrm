"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Map,
  BookOpen,
  FileText,
  Mail,
  BarChart3,
  Settings,
  Plane,
  GitBranch,
} from "lucide-react";

const nav = [
  { href: "/dashboard",  label: "Irányítópult", icon: LayoutDashboard },
  { href: "/clients",    label: "Ügyfelek",     icon: Users },
  { href: "/trips",      label: "Utak",          icon: Map },
  { href: "/bookings",   label: "Foglalások",    icon: BookOpen },
  { href: "/workflow",   label: "Workflow",      icon: GitBranch },
  { href: "/invoices",   label: "Számlák",       icon: FileText },
  { href: "/emails",     label: "E-mailek",      icon: Mail },
  { href: "/reports",    label: "Riportok",      icon: BarChart3 },
  { href: "/settings",   label: "Beállítások",   icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <Plane className="h-6 w-6 text-sidebar-primary" />
        <span className="text-lg font-bold">ZsuzsiCRM</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
