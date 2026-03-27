"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchJson } from "@/lib/fetch-json";
import { createAdminSchema } from "@/server/validation";

type AdminFormValues = z.infer<typeof createAdminSchema>;

type UserEntry = {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedLocations: string[];
};

type LocationOption = {
  id: string;
  name: string;
};

type AdminManagementProps = {
  users: UserEntry[];
  locations: LocationOption[];
  canManage: boolean;
};

export function AdminManagement({ users, locations, canManage }: AdminManagementProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string | null }>({
    tone: "success",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  const form = useForm<AdminFormValues>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "ADMIN",
      locationIds: []
    }
  });

  const selectedLocationIds = form.watch("locationIds");

  function toggleLocation(locationId: string) {
    const current = form.getValues("locationIds");
    form.setValue(
      "locationIds",
      current.includes(locationId) ? current.filter((id) => id !== locationId) : [...current, locationId]
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        await fetchJson("/api/admins", {
          method: "POST",
          body: JSON.stringify(values)
        });
        setFeedback({ tone: "success", message: "Admin erfolgreich angelegt." });
        form.reset({
          name: "",
          email: "",
          password: "",
          role: "ADMIN",
          locationIds: []
        });
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Admin konnte nicht angelegt werden." });
      }
    });
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Admin anlegen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormFeedback message={feedback.message} tone={feedback.tone} />

          {!canManage ? (
            <FormFeedback message="Nur Master Admins duerfen weitere Admins verwalten." />
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="adminName">Name</Label>
                <Input id="adminName" {...form.register("name")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminEmail">E-Mail</Label>
                <Input id="adminEmail" type="email" {...form.register("email")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPassword">Passwort</Label>
                <Input id="adminPassword" type="password" {...form.register("password")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminRole">Rolle</Label>
                <Select id="adminRole" {...form.register("role")}>
                  <option value="ADMIN">Admin</option>
                  <option value="MASTER_ADMIN">Master Admin</option>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Standortzuweisung</Label>
                <div className="grid gap-2">
                  {locations.map((location) => (
                    <label key={location.id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedLocationIds.includes(location.id)}
                        onChange={() => toggleLocation(location.id)}
                      />
                      {location.name}
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={isPending}>
                {isPending ? "Speichert..." : "Admin anlegen"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bestehende Nutzer</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Standorte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{user.assignedLocations.length ? user.assignedLocations.join(", ") : "Keine Zuweisung"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
