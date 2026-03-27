import Link from "next/link";
import { BarChart3, Boxes, Building2, Shield, TriangleAlert, Warehouse } from "lucide-react";

import { LogoutButton } from "@/features/auth/logout-button";
import type { AuthUser } from "@/server/auth";

const navigation = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/articles", label: "Artikel", icon: Boxes },
  { href: "/admin/inventory", label: "Bestand", icon: Warehouse },
  { href: "/admin/movements", label: "Bewegungen", icon: BarChart3 },
  { href: "/admin/warnings", label: "Warnungen", icon: TriangleAlert },
  { href: "/admin/locations", label: "Standorte", icon: Building2 },
  { href: "/admin/admins", label: "Admins", icon: Shield }
];

type AdminShellProps = {
  user: AuthUser;
  children: React.ReactNode;
};

export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-800 bg-slate-950/95 px-6 py-8 lg:border-b-0 lg:border-r">
          <Link href="/admin" className="inline-flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
              <Warehouse className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-lg font-semibold">Stockly</span>
              <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Admin Console</span>
            </span>
          </Link>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm text-slate-400">Angemeldet als</p>
            <p className="mt-1 font-semibold">{user.name}</p>
            <p className="text-sm text-slate-400">{user.email}</p>
            <div className="mt-3 inline-flex rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              {user.role === "MASTER_ADMIN" ? "Master Admin" : "Admin"}
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-8">
            <LogoutButton />
          </div>
        </aside>

        <main className="bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] text-slate-900">
          <div className="page-shell py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
