"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/emails/send",       label: "Email küldése" },
  { href: "/emails/templates",  label: "Sablonok" },
  { href: "/emails/logs",       label: "Előzmények" },
];

export default function EmailsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Sub-navigation tab bar */}
      <div className="flex border-b border-zinc-200 mb-6 gap-0">
        {TABS.map((tab) => {
          const active =
            tab.href === "/emails/send"
              ? pathname === "/emails" || pathname.startsWith("/emails/send")
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center px-4 pb-3 pt-0 text-sm font-medium border-b-2 mr-4 transition-colors",
                active
                  ? "border-blue-600 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-900",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
