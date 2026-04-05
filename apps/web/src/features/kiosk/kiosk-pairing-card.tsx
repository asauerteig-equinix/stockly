"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fetchJson } from "@/lib/fetch-json";

import { PinPad } from "./pin-pad";

type LocationOption = {
  id: string;
  name: string;
  code: string;
};

type KioskPairingCardProps = {
  locations: LocationOption[];
};

export function KioskPairingCard({ locations }: KioskPairingCardProps) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string | null }>({
    tone: "success",
    message: null
  });
  const [isPending, startTransition] = useTransition();
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === locationId) ?? null,
    [locationId, locations]
  );
  const label = selectedLocation ? `Kiosk ${selectedLocation.code}` : "Lagerterminal";

  return (
    <Card className="border-white/10 bg-slate-900/88 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
      <CardHeader className="gap-4">
        <div className="flex items-center gap-2">
          <Badge className="border border-white/15 bg-white/[0.08] text-slate-100">PIN</Badge>
          <Badge variant="muted" className="bg-white/[0.1] text-slate-200">
            Erster Start
          </Badge>
        </div>
        <CardTitle>Kiosk koppeln</CardTitle>
        <CardDescription className="text-slate-300/80">
          Standort waehlen, PIN antippen, fertig. Ein Terminalname wird automatisch vergeben.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <FormFeedback message={feedback.message} tone={feedback.tone} />

        <div className="grid gap-5">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-800/60 p-4">
            <div className="flex items-center gap-2 text-slate-200">
              <MapPin className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Standort</span>
            </div>
            <Label htmlFor="locationId" className="text-slate-100">
              Standort
            </Label>
            <Select id="locationId" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.code})
                </option>
              ))}
            </Select>

            <div className="rounded-2xl bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
              <div className="flex items-center gap-2 text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium text-white">Terminalname</span>
              </div>
              <p className="mt-2">{label}</p>
            </div>
          </div>

          <PinPad
            label="PIN"
            value={pin}
            onChange={setPin}
            maxLength={20}
            description="Die Standort-PIN direkt auf dem Touchscreen eingeben."
          />
        </div>

        <Button
          className="w-full bg-slate-100 text-slate-950 hover:bg-white"
          size="lg"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                await fetchJson("/api/kiosk/register", {
                  method: "POST",
                  body: JSON.stringify({ locationId, pin, label })
                });
                setFeedback({ tone: "success", message: "Kiosk erfolgreich gekoppelt." });
                router.refresh();
              } catch (error) {
                setFeedback({
                  tone: "error",
                  message: error instanceof Error ? error.message : "Kopplung fehlgeschlagen."
                });
              }
            })
          }
        >
          {isPending ? "Koppelt..." : "Kiosk koppeln"}
        </Button>
      </CardContent>
    </Card>
  );
}
