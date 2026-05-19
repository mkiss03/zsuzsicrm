"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

export function DashboardShell({ user, children }: { user: User; children: React.ReactNode }) {
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <Sidebar
        userEmail={user.email}
        isCollapsed={collapsed}
        isMobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div
        className={cn(
          "flex flex-1 flex-col transition-[margin-left] duration-250 ease-in-out min-w-0",
          collapsed ? "md:ml-16" : "md:ml-60"
        )}
      >
        <Header user={user} onMobileMenuToggle={() => setMobileOpen((v) => !v)} />
        {/* key=pathname remounts main on each route → triggers page-enter animation */}
        <main key={pathname} className="flex-1 overflow-y-auto bg-white px-4 py-5 sm:px-6 page-enter">
          {children}
        </main>
      </div>
    </>
  );
}
