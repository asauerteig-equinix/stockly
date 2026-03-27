import { ScanLine, Smartphone, Warehouse } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KioskPairingCard } from "@/features/kiosk/kiosk-pairing-card";
import { KioskTerminal } from "@/features/kiosk/kiosk-terminal";
import { getKioskContext } from "@/server/auth";
import { usageReasonOptions } from "@/server/constants";
import { prisma } from "@/server/db";

export default async function KioskPage() {
  const kiosk = await getKioskContext();

  const usageReasonOrder = kiosk
    ? await prisma.stockMovement.groupBy({
        by: ["usageReason"],
        where: {
          locationId: kiosk.locationId,
          type: "TAKE",
          usageReason: {
            not: null
          }
        },
        _count: {
          usageReason: true
        },
        orderBy: {
          _count: {
            usageReason: "desc"
          }
        }
      })
    : [];

  const sortedUsageReasons = [
    ...usageReasonOrder.map((entry) => entry.usageReason).filter((value): value is string => Boolean(value)),
    ...usageReasonOptions.filter((reason) => !usageReasonOrder.some((entry) => entry.usageReason === reason))
  ];

  const locations = await prisma.location.findMany({
    where: {
      isActive: true
    },
    orderBy: {
      name: "asc"
    }
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.16),_transparent_18%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.18),_transparent_18%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-white">
      <div className="page-shell space-y-8 py-8">
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-4">
            <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Kiosk-Modus
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight">Schnelle Lagerbuchungen direkt am Regal.</h1>
            <p className="max-w-2xl text-lg text-slate-300">
              Touchoptimierter Scanbereich, standortgebundene Buchungen und minimierte Klickwege fuer wiederholte Lagerprozesse.
            </p>
          </section>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Warehouse,
                title: "Standortbindung",
                text: "Kiosk bucht nur fuer den gekoppelten Standort."
              },
              {
                icon: ScanLine,
                title: "Barcode-Scan",
                text: "Kamera-Scan mit manueller Fallback-Eingabe."
              },
              {
                icon: Smartphone,
                title: "Touch-Flow",
                text: "Grosse Buttons, klare Rueckmeldungen, wenig Schritte."
              }
            ].map(({ icon: Icon, title, text }) => (
              <Card key={title} className="border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-300">{text}</CardContent>
              </Card>
            ))}
          </div>
        </div>

        {kiosk ? (
          <KioskTerminal
            kiosk={{
              locationName: kiosk.locationName,
              locationCode: kiosk.locationCode
            }}
            usageReasons={sortedUsageReasons}
          />
        ) : (
          <div className="mx-auto max-w-xl">
            <KioskPairingCard
              locations={locations.map((location) => ({
                id: location.id,
                name: location.name,
                code: location.code
              }))}
            />
          </div>
        )}
      </div>
    </main>
  );
}
