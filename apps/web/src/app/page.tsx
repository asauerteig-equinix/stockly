import Link from "next/link";
import { Boxes, ScanLine, ShieldCheck, Warehouse } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const highlights = [
  {
    icon: Warehouse,
    title: "Standortfaehig",
    text: "Von Beginn an fuer mehrere Lagerstandorte vorbereitet, auch wenn heute nur ein Lager aktiv ist."
  },
  {
    icon: Boxes,
    title: "Bestandsfuehrung",
    text: "Artikel, Bestaende, Wareneingang, Korrekturen und Bewegungen in einer wartbaren Struktur."
  },
  {
    icon: ScanLine,
    title: "Kiosk-Workflow",
    text: "Touchoptimierter Lagermodus mit Barcode-Scan, manueller Fallback-Eingabe und schneller Buchung."
  },
  {
    icon: ShieldCheck,
    title: "Rollen & Sicherheit",
    text: "Session-basierte Admin-Anmeldung, serverseitige Rechtepruefung und standortgebundene Kiosk-Token."
  }
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 grid-overlay opacity-50" />
      <section className="page-shell py-10 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Stockly MVP
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Schlanke Warenwirtschaft fuer interne Lager- und Kioskprozesse.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Moderne Admin-Oberflaeche, schneller Kiosk-Modus, PostgreSQL-basierte Bestandslogik und klare
                Mehrstandort-Struktur in einem einzigen Next.js-Projekt.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className={buttonVariants({})} href="/login">
                Zum Admin-Login
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/kiosk">
                Kiosk oeffnen
              </Link>
            </div>
          </div>
          <Card className="border-primary/15 bg-white/90">
            <CardHeader>
              <CardTitle>Produktionsnahe Architektur</CardTitle>
              <CardDescription>
                Ein App-Router-Projekt mit Prisma, PostgreSQL, Routen fuer Admin und Kiosk sowie containerfreundlicher
                Struktur.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-xl bg-secondary/60 p-4">
                  <p className="font-medium text-foreground">Admin-Bereich</p>
                  <p>Dashboard, Artikelverwaltung, Bestand, Wareneingang, Korrektur, Warnungen und Auswertungen.</p>
                </div>
                <div className="rounded-xl bg-accent/70 p-4">
                  <p className="font-medium text-foreground">Kiosk-Bereich</p>
                  <p>Standortkopplung per PIN, Barcode-Scan, Entnahmegruende und Rueckgabe direkt im Lager.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="page-shell pb-16">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {highlights.map(({ icon: Icon, title, text }) => (
            <Card key={title}>
              <CardHeader>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
