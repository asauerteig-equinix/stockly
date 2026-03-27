"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Boxes, MapPin, Plus, Search, TriangleAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
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

type StatusFilter = "all" | "active" | "archived" | "attention";

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

function isLowStock(article: ArticleEntry) {
  return !article.isArchived && article.quantity <= article.minimumStock;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-white/80 bg-white/85">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="text-sm text-slate-600">{hint}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ArticleManagement({ locations, articles }: ArticleManagementProps) {
  const router = useRouter();
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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

    form.reset(emptyValues(locationFilter !== "all" ? locationFilter : locations[0]?.id ?? ""));
  }, [form, locationFilter, locations, selectedArticle]);

  const categories = useMemo(
    () => Array.from(new Set(articles.map((article) => article.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [articles]
  );

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const haystack = `${article.name} ${article.barcode} ${article.category} ${article.locationName}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesLocation = locationFilter === "all" || article.locationId === locationFilter;
      const matchesCategory = categoryFilter === "all" || article.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !article.isArchived) ||
        (statusFilter === "archived" && article.isArchived) ||
        (statusFilter === "attention" && isLowStock(article));

      return matchesSearch && matchesLocation && matchesCategory && matchesStatus;
    });
  }, [articles, categoryFilter, locationFilter, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: articles.length,
      active: articles.filter((article) => !article.isArchived).length,
      archived: articles.filter((article) => article.isArchived).length,
      lowStock: articles.filter((article) => isLowStock(article)).length
    }),
    [articles]
  );

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

  function startNewArticle() {
    setSelectedArticleId(null);
    form.reset(emptyValues(locationFilter !== "all" ? locationFilter : locations[0]?.id ?? ""));
  }

  function editArticle(article: ArticleEntry) {
    setSelectedArticleId(article.id);
  }

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
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Artikel gesamt"
          value={formatQuantity(stats.total)}
          hint="Alle sichtbaren Artikelstammsaetze."
          icon={Boxes}
        />
        <StatCard
          title="Aktiv im Zugriff"
          value={formatQuantity(stats.active)}
          hint="Fuer Buchung und Pflege verfuegbar."
          icon={Plus}
        />
        <StatCard
          title="Archiviert"
          value={formatQuantity(stats.archived)}
          hint="Aus der aktiven Nutzung genommen."
          icon={Archive}
        />
        <StatCard
          title="Aufmerksamkeit"
          value={formatQuantity(stats.lowStock)}
          hint="Aktive Artikel unter oder auf Mindestbestand."
          icon={TriangleAlert}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/80 bg-white/90">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <CardTitle>Artikelbestand und Pflege</CardTitle>
                <CardDescription>
                  Suche, Filter und Direktwahl in einer Arbeitsflaeche. Ein Klick auf einen Eintrag oeffnet sofort den
                  passenden Editor.
                </CardDescription>
              </div>
              <Button className="shrink-0" onClick={startNewArticle}>
                <Plus className="mr-2 h-4 w-4" />
                Neuer Artikel
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Suche nach Name, Barcode, Kategorie oder Standort"
                />
              </div>

              <Select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                <option value="all">Alle Standorte</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code})
                  </option>
                ))}
              </Select>

              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Alle Stati</option>
                <option value="active">Nur aktiv</option>
                <option value="attention">Aufmerksamkeit</option>
                <option value="archived">Nur archiviert</option>
              </Select>

              <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Alle Kategorien</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <FormFeedback message={feedback.message} tone={feedback.tone} />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-950">{formatQuantity(filteredArticles.length)}</span> Artikel sichtbar
              </p>
              <p>
                <span className="font-semibold text-slate-950">{formatQuantity(categories.length)}</span> Kategorien im Bestand
              </p>
            </div>

            {filteredArticles.length ? (
              <div className="grid gap-3 xl:max-h-[calc(100vh-24rem)] xl:overflow-y-auto xl:pr-1">
                {filteredArticles.map((article) => {
                  const attention = isLowStock(article);
                  const selected = selectedArticleId === article.id;

                  return (
                    <div
                      key={article.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => editArticle(article)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          editArticle(article);
                        }
                      }}
                      className={cn(
                        "rounded-2xl border px-4 py-4 text-left transition",
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-white/80 hover:border-primary/40 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-slate-950">{article.name}</p>
                              {article.isArchived ? <Badge variant="muted">Archiviert</Badge> : <Badge variant="success">Aktiv</Badge>}
                              {attention ? <Badge variant="warning">Unter Minimum</Badge> : null}
                            </div>
                            <p className="text-sm text-slate-500">
                              {article.category} | Barcode {article.barcode}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                            <span className="inline-flex items-center gap-2 rounded-full bg-secondary/70 px-3 py-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {article.locationName}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              Bestand {formatQuantity(article.quantity)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              Mindestbestand {formatQuantity(article.minimumStock)}
                            </span>
                          </div>

                          {article.description ? (
                            <p className="line-clamp-2 max-w-2xl text-sm text-slate-600">{article.description}</p>
                          ) : (
                            <p className="text-sm text-slate-400">Noch keine Beschreibung hinterlegt.</p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              editArticle(article);
                            }}
                          >
                            Bearbeiten
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleArchive(article);
                            }}
                          >
                            {article.isArchived ? "Reaktivieren" : "Archivieren"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-slate-50/80 px-6 py-10 text-center">
                <p className="text-base font-medium text-slate-900">Keine passenden Artikel gefunden.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Passe Suche oder Filter an oder lege direkt einen neuen Artikel an.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/95 xl:sticky xl:top-8">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{selectedArticle ? "Artikel bearbeiten" : "Neuen Artikel anlegen"}</CardTitle>
                  <CardDescription>
                    Klare Felder fuer Identitaet, Lagerregeln und Zusatzinformationen statt eines unstrukturierten
                    Formularblocks.
                  </CardDescription>
                </div>
                {selectedArticle ? <Badge>Bearbeitung</Badge> : <Badge variant="muted">Neu</Badge>}
              </div>

              {selectedArticle ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-secondary/70 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Bestand</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">{formatQuantity(selectedArticle.quantity)}</p>
                  </div>
                  <div className="rounded-2xl bg-secondary/70 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Minimum</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">
                      {formatQuantity(selectedArticle.minimumStock)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-secondary/70 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Status</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">
                      {selectedArticle.isArchived ? "Archiviert" : "Aktiv"}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </CardHeader>

          <CardContent>
            <form className="space-y-5" onSubmit={onSubmit}>
              <section className="space-y-4 rounded-2xl border border-border/70 bg-slate-50/80 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Identitaet und Zuordnung</h3>
                  <p className="text-sm text-slate-500">Name, Barcode und Standort bilden die operative Basis.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locationId">Standort</Label>
                  <Select id="locationId" {...form.register("locationId")}>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name} ({location.code})
                      </option>
                    ))}
                  </Select>
                  <FieldError message={form.formState.errors.locationId?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Kurzname</Label>
                  <Input id="name" placeholder="z. B. SFP Modul 10G" {...form.register("name")} />
                  <FieldError message={form.formState.errors.name?.message} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input id="barcode" placeholder="Eindeutig pro Standort" {...form.register("barcode")} />
                    <FieldError message={form.formState.errors.barcode?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategorie</Label>
                    <Input
                      id="category"
                      list="article-category-options"
                      placeholder="Optik, Kabel, Hardware ..."
                      {...form.register("category")}
                    />
                    <FieldError message={form.formState.errors.category?.message} />
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-border/70 bg-slate-50/80 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Lagerregeln</h3>
                  <p className="text-sm text-slate-500">Der Mindestbestand steuert Warnungen und operative Aufmerksamkeit.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minimumStock">Mindestbestand</Label>
                  <Input id="minimumStock" type="number" min={0} {...form.register("minimumStock")} />
                  <FieldError message={form.formState.errors.minimumStock?.message} />
                </div>

                {selectedArticle ? (
                  <div className="rounded-2xl bg-white/90 px-4 py-3 text-sm text-slate-600">
                    Status aktuell:{" "}
                    <span className="font-medium text-slate-950">
                      {selectedArticle.isArchived ? "Archiviert" : "Aktiv"}
                    </span>
                    . Den Archivstatus kannst du direkt im Listenbereich wechseln.
                  </div>
                ) : null}
              </section>

              <section className="space-y-4 rounded-2xl border border-border/70 bg-slate-50/80 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Lieferant und Beschreibung</h3>
                  <p className="text-sm text-slate-500">Zusatzinfos fuer schnellere Zuordnung im Alltag.</p>
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
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea id="description" placeholder="Kurzbeschreibung fuer Lager und Admins" {...form.register("description")} />
                </div>
              </section>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Speichert..." : selectedArticle ? "Aenderungen speichern" : "Artikel anlegen"}
                </Button>
                <Button type="button" variant="outline" onClick={startNewArticle}>
                  Formular leeren
                </Button>
                {selectedArticle ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      void toggleArchive(selectedArticle);
                    }}
                  >
                    {selectedArticle.isArchived ? "Artikel reaktivieren" : "Artikel archivieren"}
                  </Button>
                ) : null}
              </div>
              <datalist id="article-category-options">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
