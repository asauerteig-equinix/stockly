import { Camera, CheckCircle2, Keyboard, ScanLine, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">Kiosk</Badge>
                {kiosk ? <Badge variant="success">Gekoppelt</Badge> : <Badge variant="warning">Nicht gekoppelt</Badge>}
              </div>

              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-tight">Schnelle Buchung im Lager.</h1>
                <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                  Scan oder Eingabe, Menge waehlen, buchen. Der Rest bleibt bewusst schlank.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <div className="flex items-center gap-2 text-cyan-200">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Status</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">{kiosk ? "Geraet verbunden" : "Kopplung noetig"}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <div className="flex items-center gap-2 text-cyan-200">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Standort</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">{kiosk ? kiosk.locationName : "Per PIN waehlen"}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <div className="flex items-center gap-2 text-cyan-200">
                  <Camera className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Scan</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">Kamera wenn verfuegbar</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <div className="flex items-center gap-2 text-cyan-200">
                  <Keyboard className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Fallback</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">Manuelle Eingabe</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
