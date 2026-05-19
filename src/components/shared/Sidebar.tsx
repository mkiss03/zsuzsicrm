"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconLayoutDashboard,
  IconUsers,
  IconPlane,
  IconCalendarCheck,
  IconReceipt,
  IconMail,
  IconChartBar,
  IconSettings,
  IconLogout,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
  IconX,
  IconMenu2,
  IconGitBranch,
} from "@tabler/icons-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── Navigation ───────────────────────────────────────────────────────────────

const NAV = [
  {
    label: "FŐOLDAL",
    items: [
      { href: "/dashboard", label: "Irányítópult", Icon: IconLayoutDashboard },
    ],
  },
  {
    label: "KEZELÉS",
    items: [
      { href: "/clients",  label: "Ügyfelek",   Icon: IconUsers },
      { href: "/trips",    label: "Utazások",   Icon: IconPlane },
      { href: "/bookings", label: "Foglalások", Icon: IconCalendarCheck, badge: "overdue" as const },
      { href: "/workflow", label: "Workflow",   Icon: IconGitBranch },
    ],
  },
  {
    label: "PÉNZÜGYEK",
    items: [
      { href: "/invoices", label: "Számlák",  Icon: IconReceipt },
      { href: "/emails",   label: "E-mailek", Icon: IconMail    },
    ],
  },
  {
    label: "ELEMZÉS",
    items: [
      { href: "/reports", label: "Riportok", Icon: IconChartBar },
    ],
  },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  userEmail?: string;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleCollapse: () => void;
  onMobileClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Sidebar({ userEmail, isCollapsed, isMobileOpen, onToggleCollapse, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [overdue, setOverdue] = useState(0);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    void supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .lt("payment_deadline", today)
      .not("status", "in", '("fully_paid","completed","cancelled")')
      .then(({ count }) => setOverdue(count ?? 0));
  }, []);

  const active = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const badgeVal = { overdue } as const;

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onMobileClose} aria-hidden />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-full flex-col border-r border-zinc-200 bg-white sidebar-transition",
          isCollapsed ? "w-16" : "w-60",
          "max-md:translate-x-[-100%] max-md:w-full max-md:max-w-[280px]",
          isMobileOpen && "max-md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex h-14 flex-shrink-0 items-center border-b border-zinc-100",
          isCollapsed ? "justify-center" : "justify-between px-4"
        )}>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-zinc-900 tracking-tight">UtazóFotós</span>
              <span className="rounded-sm bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white tracking-wide">CRM</span>
            </div>
          )}
          {isCollapsed && (
            <span className="rounded-sm bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">U</span>
          )}
          {isMobileOpen && (
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 md:hidden"
              onClick={onMobileClose}
            >
              <IconX size={16} stroke={2} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col overflow-y-auto py-3">
          {NAV.map((section) => (
            <div key={section.label}>
              {!isCollapsed && (
                <p className="px-4 pb-1 text-[11px] font-semibold tracking-widest text-zinc-400 uppercase mt-5 first:mt-2">
                  {section.label}
                </p>
              )}
              {isCollapsed && <div className="mt-3" />}

              <div className="space-y-0.5 px-2">
                {section.items.map(({ href, label, Icon, ...rest }) => {
                  const isActive    = active(href);
                  const badgeKey    = (rest as { badge?: "overdue" }).badge;
                  const count       = badgeKey ? (badgeVal[badgeKey] ?? 0) : 0;

                  const el = (
                    <Link
                      href={href}
                      onClick={() => { if (isMobileOpen) onMobileClose(); }}
                      className={cn(
                        "nav-item relative flex h-9 items-center rounded-md text-[14px] font-medium border-l-2",
                        isCollapsed ? "justify-center px-0" : "gap-2.5 px-3",
                        isActive
                          ? "bg-blue-50 text-blue-600 border-blue-600 rounded-l-none pl-[10px]"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 border-transparent"
                      )}
                    >
                      <Icon
                        size={isCollapsed ? 20 : 18}
                        stroke={1.5}
                        className={cn("flex-shrink-0", isActive ? "text-blue-600" : "text-zinc-500")}
                      />
                      {!isCollapsed && <span className="truncate">{label}</span>}
                      {count > 0 && (
                        <span className={cn(
                          "animate-pulse-dot flex items-center justify-center rounded-sm bg-red-500 text-white text-[10px] font-semibold leading-none",
                          isCollapsed
                            ? "absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5"
                            : "ml-auto h-4 min-w-4 px-1"
                        )}>
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </Link>
                  );

                  return isCollapsed ? (
                    <Tooltip key={href}>
                      <TooltipTrigger asChild>{el}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs animate-tooltip">
                        {label}{count > 0 ? ` (${count})` : ""}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div key={href}>{el}</div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Settings — bottom of nav */}
          <div className="mt-auto border-t border-zinc-100 px-2 pt-3 pb-1">
            {(() => {
              const isSettingsActive = active("/settings");
              const el = (
                <Link
                  href="/settings"
                  onClick={() => { if (isMobileOpen) onMobileClose(); }}
                  className={cn(
                    "nav-item flex h-9 items-center rounded-md text-[14px] font-medium border-l-2",
                    isCollapsed ? "justify-center px-0" : "gap-2.5 px-3",
                    isSettingsActive
                      ? "bg-blue-50 text-blue-600 border-blue-600 rounded-l-none pl-[10px]"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 border-transparent"
                  )}
                >
                  <IconSettings
                    size={isCollapsed ? 20 : 18}
                    stroke={1.5}
                    className={cn("flex-shrink-0", isSettingsActive ? "text-blue-600" : "text-zinc-500")}
                  />
                  {!isCollapsed && "Beállítások"}
                </Link>
              );
              return isCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{el}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs animate-tooltip">Beállítások</TooltipContent>
                </Tooltip>
              ) : el;
            })()}
          </div>
        </nav>

        {/* User section */}
        <div className={cn(
          "flex-shrink-0 border-t border-zinc-100 p-3",
          isCollapsed ? "flex flex-col items-center gap-2" : "space-y-2"
        )}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <UserAvatar size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-zinc-900 leading-tight">Zsuzsa</p>
                <p className="text-[12px] text-zinc-400 leading-tight">Utazásszervező</p>
              </div>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default"><UserAvatar size="sm" /></div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs animate-tooltip">Tuza-Göncz Zsuzsanna</TooltipContent>
            </Tooltip>
          )}

          {/* Sign out */}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={async () => { setLoggingOut(true); await supabase.auth.signOut(); router.push("/login"); }}
                  disabled={loggingOut}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-50 hover:text-red-600 nav-item disabled:opacity-50"
                >
                  <IconLogout size={16} stroke={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs animate-tooltip">Kijelentkezés</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={async () => { setLoggingOut(true); await supabase.auth.signOut(); router.push("/login"); }}
              disabled={loggingOut}
              className="nav-item flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-red-600 px-0.5 disabled:opacity-50"
            >
              <IconLogout size={14} stroke={1.5} />
              Kijelentkezés
            </button>
          )}

          {/* Collapse toggle — desktop only */}
          <button
            onClick={onToggleCollapse}
            className={cn(
              "hidden md:flex h-7 w-full items-center rounded-md text-[12px] text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 nav-item",
              isCollapsed ? "justify-center" : "gap-1.5 px-0.5"
            )}
          >
            {isCollapsed
              ? <IconLayoutSidebarRightCollapse size={16} stroke={1.5} />
              : <><IconLayoutSidebarLeftCollapse size={16} stroke={1.5} /><span>Összecsukás</span></>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
