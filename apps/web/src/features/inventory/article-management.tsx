"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Boxes, FileUp, ImagePlus, Images, MapPin, Plus, Search, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ArticleImagePickerModal } from "@/features/inventory/article-image-picker-modal";
import { ArticleImportTools } from "@/features/inventory/article-import-tools";
import { ArticleMediaTools } from "@/features/inventory/article-media-tools";
import { articlePlaceholderImage } from "@/lib/article-images";
import { formatBarcodeListInput, parseBarcodeListInput } from "@/lib/barcodes";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { fetchJson } from "@/lib/fetch-json";
import { formatQuantity } from "@/server/format";
import { articleSchema } from "@/server/validation";

const articleFormSchema = articleSchema.omit({ additionalBarcodes: true }).extend({
  additionalBarcodesInput: z.string().default("")
});

type ArticleFormValues = z.infer<typeof articleFormSchema>;

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
  additionalBarcodes: string[];
  imageUrl: string | null;
  description: string | null;
  manufacturerNumber: string | null;
  supplierNumber: string | null;
  category: string;
  sortOrder: number;
  minimumStock: number;
  isArchived: boolean;
  locationName: string;
  quantity: number;
};

type ArticleManagementProps = {
  locations: LocationOption[];
  articles: ArticleEntry[];
  images: Array<{
    fileName: string;
    name: string;
    url: string;
  }>;
};

type StatusFilter = "all" | "active" | "archived" | "attention";

const minimumStockPresets = [0, 1, 5, 10, 25] as const;

const emptyValues = (locationId: string): ArticleFormValues => ({
  locationId,
  name: "",
  barcode: "",
  additionalBarcodesInput: "",
  imageUrl: articlePlaceholderImage,
  description: "",
  manufacturerNumber: "",
  supplierNumber: "",
  category: "",
  sortOrder: 0,
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

function getArticleImageSrc(imageUrl: string | null | undefined) {
  return withBasePath(imageUrl || articlePlaceholderImage);
}

export function ArticleManagement({ locations, articles, images }: ArticleManagementProps) {
  const router = useRouter();
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isMediaModalOpen, setMediaModalOpen] = useState(false);
  const [isImagePickerOpen, setImagePickerOpen] = useState(false);
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
    resolver: zodResolver(articleFormSchema),
    defaultValues: emptyValues(locations[0]?.id ?? "")
  });
  const currentLocationId = form.watch("locationId");
  const selectedImageUrl = form.watch("imageUrl");
  const defaultFormLocationId = locationFilter !== "all" ? locationFilter : locations[0]?.id ?? "";

  useEffect(() => {
    if (selectedArticle) {
      form.reset({
        id: selectedArticle.id,
        locationId: selectedArticle.locationId,
        name: selectedArticle.name,
        barcode: selectedArticle.barcode,
        additionalBarcodesInput: formatBarcodeListInput(selectedArticle.additionalBarcodes),
        imageUrl: selectedArticle.imageUrl ?? articlePlaceholderImage,
        description: selectedArticle.description ?? "",
        manufacturerNumber: selectedArticle.manufacturerNumber ?? "",
        supplierNumber: selectedArticle.supplierNumber ?? "",
        category: selectedArticle.category,
        sortOrder: selectedArticle.sortOrder,
        minimumStock: selectedArticle.minimumStock,
        isArchived: selectedArticle.isArchived
      });
      return;
    }

    form.reset(emptyValues(defaultFormLocationId));
  }, [defaultFormLocationId, form, selectedArticle]);

  const categories = useMemo(
    () => Array.from(new Set(articles.map((article) => article.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [articles]
  );

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const haystack =
        `${article.name} ${article.barcode} ${article.additionalBarcodes.join(" ")} ${article.category} ${article.locationName} ${article.manufacturerNumber ?? ""} ${article.supplierNumber ?? ""}`.toLowerCase();
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

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === currentLocationId) ?? null,
    [currentLocationId, locations]
  );

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        const payload = articleSchema.parse({
          ...values,
          additionalBarcodes: parseBarcodeListInput(values.additionalBarcodesInput)
        });

        if (selectedArticle) {
          await fetchJson(`/api/articles/${selectedArticle.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          });
          setFeedback({ tone: "success", message: "Artikel erfolgreich aktualisiert." });
        } else {
          await fetchJson("/api/articles", {
            method: "POST",
            body: JSON.stringify(payload)
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

  function focusFormWorkspace() {
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startNewArticle() {
    setSelectedArticleId(null);
    form.reset(emptyValues(defaultFormLocationId));
    focusFormWorkspace();
  }

  function editArticle(article: ArticleEntry) {
    setSelectedArticleId(article.id);
    focusFormWorkspace();
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

  async function deleteArticle(article: ArticleEntry) {
    startTransition(async () => {
      try {
        await fetchJson(`/api/articles/${article.id}`, {
          method: "DELETE"
        });
        setFeedback({
          tone: "success",
          message: "Artikel wurde geloescht."
        });
        if (selectedArticleId === article.id) {
          setSelectedArticleId(null);
          form.reset(emptyValues(defaultFormLocationId));
        }
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Artikel konnte nicht geloescht werden."
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
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

      <Card className="border-white/80 bg-white/95 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-950">Werkzeuge kompakt halten</p>
            <p className="text-sm text-slate-500">
              Import und Bildbibliothek liegen jetzt bewusst in Modals, damit die Artikelpflege auf der Seite selbst ruhiger und schneller bleibt.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setImportModalOpen(true)}>
              <FileUp className="mr-2 h-4 w-4" />
              Artikel importieren
            </Button>
            <Button type="button" variant="outline" onClick={() => setMediaModalOpen(true)}>
              <Images className="mr-2 h-4 w-4" />
              Bildbibliothek
            </Button>
            <Button onClick={startNewArticle}>
              <Plus className="mr-2 h-4 w-4" />
              Neuer Artikel
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)]">
        <div ref={formCardRef} className="order-2 2xl:order-2">
          <Card className="border-white/80 bg-white/95 shadow-sm 2xl:sticky 2xl:top-6">
          <CardHeader className="gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-primary/10 bg-primary/10 text-primary">
                    {selectedArticle ? "Bearbeitungsmodus" : "Schnellerfassung"}
                  </Badge>
                  {selectedLocation ? (
                    <Badge variant="muted">
                      Standort {selectedLocation.name} ({selectedLocation.code})
                    </Badge>
                  ) : null}
                </div>
                <CardTitle>{selectedArticle ? `Artikel bearbeiten: ${selectedArticle.name}` : "Artikel schnell und sauber anlegen"}</CardTitle>
                <CardDescription>
                  Die wichtigsten Felder stehen jetzt direkt im Fokus. Zusatzinfos bleiben sichtbar, aber nicht mehr im Weg.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={startNewArticle}>
                  <Plus className="mr-2 h-4 w-4" />
                  Neuer Artikel
                </Button>
                {selectedArticle ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void toggleArchive(selectedArticle);
                    }}
                  >
                    {selectedArticle.isArchived ? "Artikel reaktivieren" : "Artikel archivieren"}
                  </Button>
                ) : null}
                {selectedArticle ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      void deleteArticle(selectedArticle);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Artikel loeschen
                  </Button>
                ) : null}
              </div>
            </div>

            {selectedArticle ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Bild</p>
                  <img
                    src={getArticleImageSrc(selectedArticle.imageUrl)}
                    alt={selectedArticle.name}
                    className="mt-3 h-20 w-full rounded-2xl border border-white bg-white object-cover"
                  />
                </div>
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Standort</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{selectedArticle.locationName}</p>
                </div>
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Bestand</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatQuantity(selectedArticle.quantity)}</p>
                </div>
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Minimum</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatQuantity(selectedArticle.minimumStock)}</p>
                </div>
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Status</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    {selectedArticle.isArchived ? "Archiviert" : isLowStock(selectedArticle) ? "Aufmerksamkeit" : "Aktiv"}
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Zusatz-Barcodes</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    {formatQuantity(selectedArticle.additionalBarcodes.length)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-5 2xl:max-h-[calc(100vh-15rem)] 2xl:overflow-auto 2xl:pr-2">
            <FormFeedback message={feedback.message} tone={feedback.tone} />

            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_380px]">
                <section className="space-y-4 rounded-2xl border border-border/70 bg-slate-50/80 p-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Stammdaten</h3>
                    </div>
                    <p className="text-sm text-slate-500">Name, Bild, Hauptbarcode, Zusatz-Barcodes, Standort und Kategorie bilden die Basis fuer Suche, Scanner, Bestellung und Kiosk.</p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-3 xl:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Label>Bild</Label>
                          <p className="text-xs text-slate-500">Ein Klick auf das Bild oeffnet die Auswahl als Modal.</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setImagePickerOpen(true)}>
                            <ImagePlus className="mr-2 h-4 w-4" />
                            Bild waehlen
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              form.setValue("imageUrl", articlePlaceholderImage, {
                                shouldDirty: true,
                                shouldValidate: true
                              })
                            }
                          >
                            Platzhalter
                          </Button>
                        </div>
                      </div>

                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full rounded-2xl border border-border/70 bg-white/90 p-4 text-left transition hover:border-primary/30 hover:bg-white"
                        onClick={() => setImagePickerOpen(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setImagePickerOpen(true);
                          }
                        }}
                      >
                        <img
                          src={getArticleImageSrc(selectedImageUrl)}
                          alt="Vorschau des gewaehlten Artikelbildes"
                          className="h-36 w-full rounded-2xl border border-slate-200 bg-white object-cover"
                        />
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-950">
                              {selectedImageUrl === articlePlaceholderImage ? "Platzhalter aktiv" : "Bild ausgewaehlt"}
                            </p>
                            <p className="text-xs text-slate-500">Zum Aendern einfach antippen oder anklicken.</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              setMediaModalOpen(true);
                            }}
                          >
                            <Images className="mr-2 h-4 w-4" />
                            Bibliothek
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="name">Artikelname</Label>
                      <Input id="name" placeholder="z. B. SFP Modul 10G Single-Mode" {...form.register("name")} />
                      <FieldError message={form.formState.errors.name?.message} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="barcode">Hauptbarcode</Label>
                      <Input id="barcode" placeholder="Standard-Barcode fuer diesen Artikel" {...form.register("barcode")} />
                      <FieldError message={form.formState.errors.barcode?.message} />
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

                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="additionalBarcodesInput">Weitere Barcodes</Label>
                      <Textarea
                        id="additionalBarcodesInput"
                        className="min-h-[110px]"
                        placeholder={"Optional, z. B. ein Barcode pro Zeile\n1234567890123\n998877665544"}
                        {...form.register("additionalBarcodesInput")}
                      />
                      <p className="text-xs text-slate-500">
                        Optional. Sinnvoll, wenn verschiedene Hersteller fuer denselben Artikel unterschiedliche Barcodes nutzen.
                      </p>
                    </div>

                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="category">Kategorie</Label>
                      <Input
                        id="category"
                        list="article-category-options"
                        placeholder="Optik, Kabel, Hardware ..."
                        {...form.register("category")}
                      />
                      <FieldError message={form.formState.errors.category?.message} />
                      {categories.length ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {categories.slice(0, 10).map((category) => (
                            <Button
                              key={category}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 border-white bg-white text-slate-700 hover:bg-slate-100"
                              onClick={() =>
                                form.setValue("category", category, {
                                  shouldDirty: true,
                                  shouldValidate: true
                                })
                              }
                            >
                              {category}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sortOrder">Reihenfolge</Label>
                      <Input id="sortOrder" type="number" min={0} {...form.register("sortOrder")} />
                      <FieldError message={form.formState.errors.sortOrder?.message} />
                      <p className="text-xs text-slate-500">Steuert die Reihenfolge innerhalb der Kategorie.</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-border/70 bg-slate-50/80 p-5">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900">Lagerregeln</h3>
                    <p className="text-sm text-slate-500">Hier steuerst du, ab wann der Artikel in Warnungen auftaucht.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minimumStock">Mindestbestand</Label>
                    <Input id="minimumStock" type="number" min={0} {...form.register("minimumStock")} />
                    <FieldError message={form.formState.errors.minimumStock?.message} />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Schnellwerte</p>
                    <div className="grid grid-cols-5 gap-2">
                      {minimumStockPresets.map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-white bg-white text-slate-700 hover:bg-slate-100"
                          onClick={() =>
                            form.setValue("minimumStock", preset, {
                              shouldDirty: true,
                              shouldValidate: true
                            })
                          }
                        >
                          {preset}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/90 px-4 py-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-950">Hinweis zum Archivstatus</p>
                    <p className="mt-1">
                      Archivieren laesst Historie und Buchungen intakt. Fuer den Alltag ist das meist besser als Loeschen.
                    </p>
                  </div>
                </section>
              </div>

              <section className="space-y-4 rounded-2xl border border-border/70 bg-slate-50/80 p-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">Zusatzinformationen</h3>
                  <p className="text-sm text-slate-500">Alles, was im Tagesgeschaeft bei Einkauf, Identifikation und Rueckfragen hilft.</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="manufacturerNumber">Hersteller-Nr.</Label>
                    <Input id="manufacturerNumber" placeholder="Optional" {...form.register("manufacturerNumber")} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supplierNumber">Lieferanten-Nr.</Label>
                    <Input id="supplierNumber" placeholder="Optional" {...form.register("supplierNumber")} />
                  </div>

                  <div className="space-y-2 xl:col-span-3">
                    <Label htmlFor="description">Beschreibung</Label>
                    <Textarea
                      id="description"
                      placeholder="Kurzbeschreibung fuer Lager, Admins oder Scanner-zuordnung"
                      className="min-h-[120px]"
                      {...form.register("description")}
                    />
                  </div>
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-1">
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
                      setSelectedArticleId(null);
                      form.reset(emptyValues(defaultFormLocationId));
                    }}
                  >
                    Bearbeitung verlassen
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

        <Card className="order-1 border-white/80 bg-white/90 shadow-sm 2xl:order-1">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <CardTitle>Artikelbestand und Pflege</CardTitle>
              <CardDescription>
                Die verfuegbaren Artikel stehen bewusst frueher im Fokus. Ein Klick auf einen Eintrag oeffnet ihn direkt rechts oder darunter zur Bearbeitung.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-950">{formatQuantity(filteredArticles.length)}</span> Artikel sichtbar
              </p>
              <p>
                <span className="font-semibold text-slate-950">{formatQuantity(categories.length)}</span> Kategorien im Bestand
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_240px_200px_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Suche nach Name, Barcode, Zusatz-Barcode, Kategorie oder Standort"
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

            <Button className="xl:min-w-[180px]" onClick={startNewArticle}>
              <Plus className="mr-2 h-4 w-4" />
              Neuer Artikel
            </Button>
          </div>
        </CardHeader>

          <CardContent className="space-y-4">
          {filteredArticles.length ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="max-h-[min(70vh,54rem)] overflow-auto 2xl:max-h-[calc(100vh-18rem)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artikel</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Reihenfolge</TableHead>
                      <TableHead>Standort</TableHead>
                      <TableHead>Bestand</TableHead>
                      <TableHead>Minimum</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArticles.map((article) => {
                      const attention = isLowStock(article);
                      const selected = selectedArticleId === article.id;

                      return (
                        <TableRow
                          key={article.id}
                          className={cn("cursor-pointer transition", selected ? "bg-primary/5" : "hover:bg-slate-50")}
                          onClick={() => editArticle(article)}
                        >
                          <TableCell className="min-w-[260px]">
                            <div className="flex items-start gap-3">
                              <img
                                src={getArticleImageSrc(article.imageUrl)}
                                alt={article.name}
                                className="h-14 w-14 rounded-2xl border border-white bg-white object-cover shadow-sm"
                              />
                              <div className="space-y-1">
                                <p className="font-medium text-slate-950">{article.name}</p>
                                <p className="text-xs text-slate-500">Barcode {article.barcode}</p>
                                {article.additionalBarcodes.length ? (
                                  <p className="text-xs text-slate-500">
                                    + {formatQuantity(article.additionalBarcodes.length)} weitere Barcodes
                                  </p>
                                ) : null}
                                {article.description ? <p className="line-clamp-1 text-xs text-slate-500">{article.description}</p> : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{article.category}</TableCell>
                          <TableCell>{formatQuantity(article.sortOrder)}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {article.locationName}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{formatQuantity(article.quantity)}</TableCell>
                          <TableCell>{formatQuantity(article.minimumStock)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {article.isArchived ? <Badge variant="muted">Archiviert</Badge> : <Badge variant="success">Aktiv</Badge>}
                              {attention ? <Badge variant="warning">Unter Minimum</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
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
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void deleteArticle(article);
                                }}
                              >
                                Loeschen
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
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
      </div>

      <Modal
        open={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Artikel importieren"
        description="Importe liegen bewusst ausserhalb der Hauptseite, damit die Artikelliste schnell sichtbar bleibt."
      >
        <ArticleImportTools />
      </Modal>

      <Modal
        open={isMediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        title="Bildbibliothek"
        description="Bilder werden zentral hochgeladen, geloescht und danach ueberall wiederverwendet."
        className="max-w-6xl"
      >
        <ArticleMediaTools images={images} />
      </Modal>

      <ArticleImagePickerModal
        open={isImagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        images={images}
        selectedImageUrl={selectedImageUrl}
        onSelect={(imageUrl) =>
          form.setValue("imageUrl", imageUrl, {
            shouldDirty: true,
            shouldValidate: true
          })
        }
        onOpenLibrary={() => {
          setImagePickerOpen(false);
          setMediaModalOpen(true);
        }}
      />
    </div>
  );
}
