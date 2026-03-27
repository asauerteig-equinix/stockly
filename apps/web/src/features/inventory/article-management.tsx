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
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/fetch-json";
import { formatQuantity } from "@/server/format";
import { articleSchema } from "@/server/validation";

type ArticleFormValues = z.infer<typeof articleSchema>;

type LocationOption = {
  id: string;
  name: string;
  code: string;
};

type ArticleEntry = {
  id: string;
  locationId: string;
  name: string;
  barcode: string;
  description: string | null;
  manufacturerNumber: string | null;
  supplierNumber: string | null;
  category: string;
  minimumStock: number;
  isArchived: boolean;
  locationName: string;
  quantity: number;
};

type ArticleManagementProps = {
  locations: LocationOption[];
  articles: ArticleEntry[];
};

const emptyValues = (locationId: string): ArticleFormValues => ({
  locationId,
  name: "",
  barcode: "",
  description: "",
  manufacturerNumber: "",
  supplierNumber: "",
  category: "",
  minimumStock: 0,
  isArchived: false
});

export function ArticleManagement({ locations, articles }: ArticleManagementProps) {
  const router = useRouter();
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string | null }>({
    tone: "success",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedArticleId) ?? null,
    [articles, selectedArticleId]
  );

  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: emptyValues(locations[0]?.id ?? "")
  });

  useEffect(() => {
    if (selectedArticle) {
      form.reset({
        id: selectedArticle.id,
        locationId: selectedArticle.locationId,
        name: selectedArticle.name,
        barcode: selectedArticle.barcode,
        description: selectedArticle.description ?? "",
        manufacturerNumber: selectedArticle.manufacturerNumber ?? "",
        supplierNumber: selectedArticle.supplierNumber ?? "",
        category: selectedArticle.category,
        minimumStock: selectedArticle.minimumStock,
        isArchived: selectedArticle.isArchived
      });
      return;
    }

    form.reset(emptyValues(locations[0]?.id ?? ""));
  }, [form, locations, selectedArticle]);

  const filteredArticles = articles.filter((article) => {
    const haystack = `${article.name} ${article.barcode} ${article.category} ${article.locationName}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        if (selectedArticle) {
          await fetchJson(`/api/articles/${selectedArticle.id}`, {
            method: "PATCH",
            body: JSON.stringify(values)
          });
          setFeedback({ tone: "success", message: "Artikel erfolgreich aktualisiert." });
        } else {
          await fetchJson("/api/articles", {
            method: "POST",
            body: JSON.stringify(values)
          });
          setFeedback({ tone: "success", message: "Artikel erfolgreich angelegt." });
        }

        setSelectedArticleId(null);
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Artikel konnte nicht gespeichert werden."
        });
      }
    });
  });

  async function toggleArchive(article: ArticleEntry) {
    startTransition(async () => {
      try {
        await fetchJson(`/api/articles/${article.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            isArchived: !article.isArchived
          })
        });
        setFeedback({
          tone: "success",
          message: article.isArchived ? "Artikel wurde reaktiviert." : "Artikel wurde archiviert."
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Archivstatus konnte nicht geaendert werden."
        });
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <CardTitle>{selectedArticle ? "Artikel bearbeiten" : "Neuen Artikel anlegen"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormFeedback message={feedback.message} tone={feedback.tone} />

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="locationId">Standort</Label>
              <Select id="locationId" {...form.register("locationId")}>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register("name")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" {...form.register("barcode")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Kategorie</Label>
              <Input id="category" {...form.register("category")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manufacturerNumber">Hersteller-Nr.</Label>
                <Input id="manufacturerNumber" {...form.register("manufacturerNumber")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierNumber">Lieferanten-Nr.</Label>
                <Input id="supplierNumber" {...form.register("supplierNumber")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimumStock">Mindestbestand</Label>
              <Input id="minimumStock" type="number" {...form.register("minimumStock")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea id="description" {...form.register("description")} />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Speichert..." : selectedArticle ? "Aktualisieren" : "Anlegen"}
              </Button>
              {selectedArticle ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedArticleId(null);
                    form.reset(emptyValues(locations[0]?.id ?? ""));
                  }}
                >
                  Zuruecksetzen
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Artikelverwaltung</CardTitle>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Suche nach Name, Barcode, Kategorie oder Standort"
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artikel</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Standort</TableHead>
                <TableHead>Bestand</TableHead>
                <TableHead>Minimum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredArticles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">{article.name}</p>
                      <p className="text-xs text-slate-500">{article.category}</p>
                    </div>
                  </TableCell>
                  <TableCell>{article.barcode}</TableCell>
                  <TableCell>{article.locationName}</TableCell>
                  <TableCell>{formatQuantity(article.quantity)}</TableCell>
                  <TableCell>{formatQuantity(article.minimumStock)}</TableCell>
                  <TableCell>{article.isArchived ? "Archiviert" : "Aktiv"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedArticleId(article.id)}>
                        Bearbeiten
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void toggleArchive(article)}>
                        {article.isArchived ? "Reaktivieren" : "Archivieren"}
                      </Button>
                    </div>
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
