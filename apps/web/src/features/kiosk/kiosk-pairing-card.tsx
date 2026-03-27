"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fetchJson } from "@/lib/fetch-json";

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
  const [label, setLabel] = useState("Lagerterminal");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string | null }>({
    tone: "success",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="border-white/10 bg-slate-950/80 text-white">
      <CardHeader className="gap-4">
        <div className="flex items-center gap-2">
          <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">PIN</Badge>
          <Badge variant="muted" className="bg-white/10 text-slate-200">
            Erster Start
          </Badge>
        </div>
        <CardTitle>Kiosk koppeln</CardTitle>
        <CardDescription className="text-slate-400">
          Standort waehlen, PIN eingeben, fertig.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <FormFeedback message={feedback.message} tone={feedback.tone} />

        <div className="grid gap-4">
          <div className="space-y-2">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin" className="text-slate-100">
              PIN
            </Label>
            <Input id="pin" type="password" value={pin} onChange={(event) => setPin(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kioskLabel" className="text-slate-100">
              Terminalname
            </Label>
            <Input id="kioskLabel" value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>
        </div>

        <Button
          className="w-full"
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
