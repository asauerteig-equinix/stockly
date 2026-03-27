import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck, Warehouse } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";
import { getCurrentUser } from "@/server/auth";

const highlights = [
  {
    icon: ShieldCheck,
    title: "Rollenbasierter Zugriff",
    text: "Master Admins sehen alles, Admins nur ihre freigegebenen Standorte."
  },
  {
    icon: Warehouse,
    title: "Mehrere Standorte",
    text: "Das Datenmodell ist von Beginn an fuer getrennte Lager und Regeln ausgelegt."
  },
  {
    icon: KeyRound,
    title: "Sichere Sessions",
    text: "HTTP-only Cookies und serverseitige Pruefung sorgen fuer robuste Admin-Logins."
  }
];

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.14),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_20%),linear-gradient(180deg,_#fffef7_0%,_#f8fafc_100%)]">
      <div className="page-shell grid min-h-screen items-center gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Interne Warenwirtschaft
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Admin-Zugang fuer Lager, Bestand und operative Reports.
            </h1>
            <p className="max-w-2xl text-lg text-slate-600">
              Stockly verbindet saubere Bestandsfuehrung mit einem klar getrennten Kiosk-Workflow fuer das Lager.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {highlights.map(({ icon: Icon, title, text }) => (
              <Card key={title}>
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Card className="mx-auto w-full max-w-lg border-primary/10 bg-white/90">
          <CardHeader>
            <CardTitle>Admin anmelden</CardTitle>
            <CardDescription>Fuer den Seed ist der Master-Login bereits vorausgefuellt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <LoginForm />
            <div className="rounded-xl bg-secondary/70 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Seed-Zugaenge</p>
              <p>Master Admin: `master@stockly.local` / `Stockly123!`</p>
              <p>Admin Berlin: `lager@stockly.local` / `Admin123!`</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
