"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/fetch-json";
import { locationSchema } from "@/server/validation";

const locationFormSchema = locationSchema.extend({
  kioskPin: z.union([z.string().min(4).max(20), z.literal("")])
});

type LocationValues = z.infer<typeof locationFormSchema>;

type LocationEntry = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  agingWarningDays: number;
  allowNegativeStock: boolean;
};

type LocationManagementProps = {
  locations: LocationEntry[];
  canManage: boolean;
};

const emptyValues: LocationValues = {
  name: "",
  code: "",
  description: "",
  kioskPin: "",
  agingWarningDays: 30,
  allowNegativeStock: false
};

export function LocationManagement({ locations, canManage }: LocationManagementProps) {
  const router = useRouter();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string | null }>({
    tone: "success",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  const form = useForm<LocationValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: emptyValues
  });

  useEffect(() => {
    if (!selectedLocation) {
      form.reset(emptyValues);
      return;
    }

    form.reset({
      name: selectedLocation.name,
      code: selectedLocation.code,
      description: selectedLocation.description ?? "",
      kioskPin: "",
      agingWarningDays: selectedLocation.agingWarningDays,
      allowNegativeStock: selectedLocation.allowNegativeStock
    });
  }, [form, selectedLocation]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        if (!selectedLocation && !values.kioskPin) {
          setFeedback({ tone: "error", message: "Bitte fuer neue Standorte eine PIN vergeben." });
          return;
        }

        const payload = {
          ...values,
          kioskPin: values.kioskPin || undefined
        };

        if (selectedLocation) {
          await fetchJson(`/api/locations/${selectedLocation.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          });
          setFeedback({ tone: "success", message: "Standort erfolgreich aktualisiert." });
        } else {
          await fetchJson("/api/locations", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          setFeedback({ tone: "success", message: "Standort erfolgreich angelegt." });
        }

        setSelectedLocationId(null);
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Speichern fehlgeschlagen." });
      }
    });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <CardTitle>{selectedLocation ? "Standort bearbeiten" : "Standort anlegen"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormFeedback message={feedback.message} tone={feedback.tone} />

          {!canManage ? (
            <FormFeedback message="Nur Master Admins duerfen Standorte anlegen oder bearbeiten." />
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="locationName">Name</Label>
                <Input id="locationName" {...form.register("name")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationCode">Code</Label>
                <Input id="locationCode" {...form.register("code")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationDescription">Beschreibung</Label>
                <Textarea id="locationDescription" {...form.register("description")} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="locationPin">Kiosk-PIN</Label>
                  <Input id="locationPin" type="password" {...form.register("kioskPin")} />
                  {selectedLocation ? <p className="text-xs text-slate-500">Leer lassen, wenn die PIN unveraendert bleiben soll.</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agingWarningDays">Aging-Schwelle</Label>
                  <Input id="agingWarningDays" type="number" {...form.register("agingWarningDays")} />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm">
                <input type="checkbox" {...form.register("allowNegativeStock")} />
                Negativen Bestand fuer diesen Standort zulassen
              </label>

              <div className="flex gap-3">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Speichert..." : selectedLocation ? "Aktualisieren" : "Anlegen"}
                </Button>
                {selectedLocation ? (
                  <Button type="button" variant="outline" onClick={() => setSelectedLocationId(null)}>
                    Zuruecksetzen
                  </Button>
                ) : null}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standortuebersicht</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Aging</TableHead>
                <TableHead>Negativer Bestand</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell>{location.name}</TableCell>
                  <TableCell>{location.code}</TableCell>
                  <TableCell>{location.agingWarningDays} Tage</TableCell>
                  <TableCell>{location.allowNegativeStock ? "Ja" : "Nein"}</TableCell>
                  <TableCell>{location.isActive ? "Aktiv" : "Inaktiv"}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Button size="sm" variant="outline" onClick={() => setSelectedLocationId(location.id)}>
                        Bearbeiten
                      </Button>
                    ) : (
                      "Nur Ansicht"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
