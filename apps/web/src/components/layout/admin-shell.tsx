"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  TriangleAlert,
  Warehouse
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { LogoutButton } from "@/features/auth/logout-button";
import type { AuthUser } from "@/server/auth";

const navigation = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/articles", label: "Artikel", icon: Boxes },
  { href: "/admin/inventory", label: "Bestand", icon: Warehouse },
  { href: "/admin/orders", label: "Bestellungen", icon: ClipboardList },
  { href: "/admin/movements", label: "Bewegungen", icon: BarChart3 },
  { href: "/admin/warnings", label: "Warnungen", icon: TriangleAlert },
  { href: "/admin/locations", label: "Standorte", icon: Building2 },
  { href: "/admin/admins", label: "Admins", icon: Shield }
];

type AdminShellProps = {
  user: AuthUser;
  children: React.ReactNode;
};

function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname();
  const isOrdersRoute = pathname === "/admin/orders" || pathname.startsWith("/admin/orders/");
  const [isCollapsed, setCollapsed] = useState(isOrdersRoute);
  const userInitials = useMemo(
    () =>
      user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join(""),
    [user.name]
  );

  useEffect(() => {
    setCollapsed(isOrdersRoute);
  }, [isOrdersRoute]);

  return (
    <div className="min-h-screen bg-[#eef1f4] text-slate-900">
      <div
        className={cn(
          "grid min-h-screen w-full transition-[grid-template-columns] duration-300 ease-out",
          isCollapsed ? "lg:grid-cols-[96px_minmax(0,1fr)]" : "lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]"
        )}
      >
        <aside
          className={cn(
            "border-b border-slate-200 bg-[#f7f8fa] py-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r",
            isCollapsed ? "px-3" : "px-5 xl:px-6"
          )}
        >
          <div className={cn("flex gap-3", isCollapsed ? "flex-col items-center" : "items-start justify-between")}>
            <Link href="/admin" className={cn("inline-flex items-center gap-3", isCollapsed && "justify-center")}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Warehouse className="h-6 w-6" />
              </span>
              {isCollapsed ? null : (
                <span>
                  <span className="block text-base font-semibold text-slate-950">Stockly</span>
                  <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">Admin Console</span>
                </span>
              )}
            </Link>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden shrink-0 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950 lg:inline-flex"
              aria-label={isCollapsed ? "Menue ausklappen" : "Menue einklappen"}
              onClick={() => setCollapsed((current) => !current)}
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          <div
            className={cn(
              "mt-6 rounded-xl border border-slate-200 bg-white shadow-sm",
              isCollapsed ? "px-3 py-4 text-center" : "p-4"
            )}
          >
            {isCollapsed ? (
              <>
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {userInitials}
                </div>
                <div className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                  {user.role === "MASTER_ADMIN" ? "MA" : "AD"}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Angemeldet</p>
                <p className="mt-2 font-semibold text-slate-950">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
                <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                  {user.role === "MASTER_ADMIN" ? "Master Admin" : "Admin"}
                </div>
              </>
            )}
          </div>

          <nav className="mt-6 space-y-1.5">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = isNavigationItemActive(pathname, href);

              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={cn(
                    "rounded-lg text-sm font-medium transition",
                    isCollapsed ? "flex justify-center px-2 py-2.5" : "flex items-center gap-3 px-3 py-2.5",
                    active
                      ? "bg-slate-900 text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)]"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {isCollapsed ? null : label}
                </Link>
              );
            })}
          </nav>

          <div className={cn("mt-6", isCollapsed && "flex justify-center")}>
            <LogoutButton compact={isCollapsed} />
          </div>
        </aside>

        <main className="min-w-0 bg-[#eef1f4] text-slate-900">
          <div
            className={cn(
              "w-full px-4 py-6 sm:px-6 lg:py-8",
              isOrdersRoute ? "lg:px-6 xl:px-7 2xl:px-8" : "lg:px-8 xl:px-10 2xl:px-12"
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
