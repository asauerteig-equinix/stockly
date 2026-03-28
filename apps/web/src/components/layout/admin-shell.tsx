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
    <div className="min-h-screen bg-[#eef1f4] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1680px] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-[#f7f8fa] px-5 py-6 lg:border-b-0 lg:border-r">
          <Link href="/admin" className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Warehouse className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-base font-semibold text-slate-950">Stockly</span>
              <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">Admin Console</span>
            </span>
          </Link>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Angemeldet</p>
            <p className="mt-2 font-semibold text-slate-950">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
            <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
              {user.role === "MASTER_ADMIN" ? "Master Admin" : "Admin"}
            </div>
          </div>

          <nav className="mt-6 space-y-1.5">
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-6">
            <LogoutButton />
          </div>
        </aside>

        <main className="bg-[#eef1f4] text-slate-900">
          <div className="page-shell py-6 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
