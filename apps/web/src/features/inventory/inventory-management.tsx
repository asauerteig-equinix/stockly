"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownToLine, ClipboardPenLine, PackageSearch, Search, TriangleAlert, Warehouse } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { fetchJson } from "@/lib/fetch-json";
import { formatQuantity } from "@/server/format";
import { correctionSchema, goodsReceiptSchema } from "@/server/validation";

type GoodsReceiptValues = z.infer<typeof goodsReceiptSchema>;
type CorrectionValues = z.infer<typeof correctionSchema>;

type ArticleOption = {
  id: string;
  name: string;
  category: string;
  locationId: string;
  locationName: string;
  quantity: number;
  minimumStock: number;
  lastMovementAt: string | null;
};

type BalanceEntry = {
  id: string;
  articleId: string;
  locationId: string;
  locationName: string;
  articleName: string;
  category: string;
  quantity: number;
  minimumStock: number;
  lastMovementAt: string | null;
};

type InventoryManagementProps = {
  articles: ArticleOption[];
  balances: BalanceEntry[];
};

type InventoryMode = "receipt" | "correction";
type StockFilter = "all" | "attention" | "quiet";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

function isAttention(balance: { quantity: number; minimumStock: number }) {
  return balance.quantity <= balance.minimumStock;
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

export function InventoryManagement({ articles, balances }: InventoryManagementProps) {
  const router = useRouter();
  const [mode, setMode] = useState<InventoryMode>("receipt");
  const [search, setSearch] = useState("");
  const [articleSearch, setArticleSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string | null }>({
    tone: "success",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  const goodsReceiptForm = useForm<GoodsReceiptValues>({
    resolver: zodResolver(goodsReceiptSchema),
    defaultValues: {
      articleId: articles[0]?.id ?? "",
      locationId: articles[0]?.locationId ?? "",
      quantity: 1,
      note: ""
    }
  });

  const correctionForm = useForm<CorrectionValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      articleId: articles[0]?.id ?? "",
      locationId: articles[0]?.locationId ?? "",
      quantity: 1,
      note: ""
    }
  });

  const receiptArticleId = goodsReceiptForm.watch("articleId");
  const correctionArticleId = correctionForm.watch("articleId");

  const selectedArticle = useMemo(() => {
    const selectedId = mode === "receipt" ? receiptArticleId : correctionArticleId;
    return articles.find((article) => article.id === selectedId) ?? null;
  }, [articles, correctionArticleId, mode, receiptArticleId]);

  const stats = useMemo(
    () => ({
      positions: balances.length,
      totalQuantity: balances.reduce((sum, balance) => sum + balance.quantity, 0),
      attention: balances.filter((balance) => isAttention(balance)).length,
      withoutMovement: balances.filter((balance) => !balance.lastMovementAt).length
    }),
    [balances]
  );

  const locationOptions = useMemo(() => {
    return Array.from(new Map(articles.map((article) => [article.locationId, article.locationName])).entries()).map(
      ([id, name]) => ({
        id,
        name
      })
    );
  }, [articles]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(articles.map((article) => article.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [articles]
  );

  const filteredArticleOptions = useMemo(() => {
    const currentArticleId = mode === "receipt" ? receiptArticleId : correctionArticleId;
    const normalizedSearch = articleSearch.trim().toLowerCase();
    const options = articles.filter((article) => {
      if (!normalizedSearch) {
        return true;
      }

      const haystack = `${article.name} ${article.category} ${article.locationName}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
    const currentArticle = articles.find((article) => article.id === currentArticleId);

    if (currentArticle && !options.some((article) => article.id === currentArticle.id)) {
      return [currentArticle, ...options];
    }

    return options;
  }, [articleSearch, articles, correctionArticleId, mode, receiptArticleId]);

  const filteredBalances = useMemo(() => {
    return balances.filter((balance) => {
      const haystack = `${balance.articleName} ${balance.category} ${balance.locationName}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesLocation = locationFilter === "all" || balance.locationId === locationFilter;
      const matchesCategory = categoryFilter === "all" || balance.category === categoryFilter;
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "attention" && isAttention(balance)) ||
        (stockFilter === "quiet" && !balance.lastMovementAt);

      return matchesSearch && matchesLocation && matchesCategory && matchesStock;
    });
  }, [balances, categoryFilter, locationFilter, search, stockFilter]);

  function syncLocation(formName: InventoryMode, articleId: string) {
    const article = articles.find((entry) => entry.id === articleId);

    if (!article) {
      return;
    }

    goodsReceiptForm.setValue("articleId", article.id);
    goodsReceiptForm.setValue("locationId", article.locationId);
    correctionForm.setValue("articleId", article.id);
    correctionForm.setValue("locationId", article.locationId);

    if (formName !== mode) {
      setMode(formName);
    }
  }

  function applyPreset(quantity: number) {
    if (mode === "receipt") {
      goodsReceiptForm.setValue("quantity", Math.max(1, quantity));
      return;
    }

    correctionForm.setValue("quantity", quantity);
  }

  const submitGoodsReceipt = goodsReceiptForm.handleSubmit((values) => {
    startTransition(async () => {
      try {
        await fetchJson("/api/inventory/goods-receipt", {
          method: "POST",
          body: JSON.stringify(values)
        });
        setFeedback({ tone: "success", message: "Wareneingang erfolgreich gebucht." });
        goodsReceiptForm.setValue("quantity", 1);
        goodsReceiptForm.setValue("note", "");
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Buchung fehlgeschlagen." });
      }
    });
  });

  const submitCorrection = correctionForm.handleSubmit((values) => {
    startTransition(async () => {
      try {
        await fetchJson("/api/inventory/correction", {
          method: "POST",
          body: JSON.stringify(values)
        });
        setFeedback({ tone: "success", message: "Korrektur erfolgreich gebucht." });
        correctionForm.setValue("quantity", 1);
        correctionForm.setValue("note", "");
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Korrektur fehlgeschlagen." });
      }
    });
  });

  const activeForm = mode === "receipt" ? goodsReceiptForm : correctionForm;

  return (
    <div className="space-y-6">
      <FormFeedback message={feedback.message} tone={feedback.tone} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Bestandspositionen"
          value={formatQuantity(stats.positions)}
          hint="Aktuell gefuehrte Artikel im sichtbaren Lagerbereich."
          icon={Warehouse}
        />
        <StatCard
          title="Gesamtmenge"
          value={formatQuantity(stats.totalQuantity)}
          hint="Summierter Bestand ueber alle sichtbaren Positionen."
          icon={ArrowDownToLine}
        />
        <StatCard
          title="Unter Minimum"
          value={formatQuantity(stats.attention)}
          hint="Positionen mit unmittelbarem Handlungsbedarf."
          icon={TriangleAlert}
        />
        <StatCard
          title="Ohne Bewegung"
          value={formatQuantity(stats.withoutMovement)}
          hint="Noch nie oder lange nicht gebuchte Positionen."
          icon={PackageSearch}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <Card className="border-white/80 bg-white/95 xl:sticky xl:top-8">
          <CardHeader className="gap-4">
            <div className="space-y-2">
              <CardTitle>Buchungsarbeitsplatz</CardTitle>
              <CardDescription>
                Eine fokussierte Arbeitsflaeche fuer Wareneingang und Korrekturen mit direktem Artikelkontext.
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant={mode === "receipt" ? "default" : "outline"} onClick={() => setMode("receipt")}>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Wareneingang
              </Button>
              <Button variant={mode === "correction" ? "default" : "outline"} onClick={() => setMode("correction")}>
                <ClipboardPenLine className="mr-2 h-4 w-4" />
                Korrektur
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {mode === "receipt" ? "Wareneingang buchen" : "Bestand korrigieren"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {mode === "receipt"
                  ? "Neue Lieferung oder Rueckfuehrung aus dem Einkauf schnell als positive Lagerbewegung buchen."
                  : "Bestandsabweichungen kontrolliert ausgleichen. Positive Werte erhoehen, negative Werte senken den Bestand."}
              </p>
            </div>

            <form className="space-y-4" onSubmit={mode === "receipt" ? submitGoodsReceipt : submitCorrection}>
              <div className="space-y-2">
                <Label htmlFor="inventoryArticleSearch">Artikel suchen</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="inventoryArticleSearch"
                    className="pl-9"
                    value={articleSearch}
                    onChange={(event) => setArticleSearch(event.target.value)}
                    placeholder="Name, Kategorie oder Standort eingeben"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {formatQuantity(filteredArticleOptions.length)} Artikel in der aktuellen Auswahl.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inventoryArticle">Artikel</Label>
                <Select
                  id="inventoryArticle"
                  value={mode === "receipt" ? receiptArticleId : correctionArticleId}
                  onChange={(event) => syncLocation(mode, event.target.value)}
                >
                  {filteredArticleOptions.length ? (
                    filteredArticleOptions.map((article) => (
                      <option key={article.id} value={article.id}>
                        {article.name} ({article.locationName} | {article.category})
                      </option>
                    ))
                  ) : (
                    <option value="">Keine Artikel passend zur Suche</option>
                  )}
                </Select>
                <FieldError
                  message={
                    mode === "receipt"
                      ? goodsReceiptForm.formState.errors.articleId?.message
                      : correctionForm.formState.errors.articleId?.message
                  }
                />
              </div>

              {selectedArticle ? (
                <div className="space-y-4 rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Ausgewaehlter Artikel</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">{selectedArticle.name}</h3>
                    <p className="text-sm text-slate-600">
                      {selectedArticle.locationName} | {selectedArticle.category}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/90 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Bestand</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-950">
                        {formatQuantity(selectedArticle.quantity)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/90 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Minimum</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-950">
                        {formatQuantity(selectedArticle.minimumStock)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/90 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Letzte Bewegung</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {selectedArticle.lastMovementAt ?? "Keine Bewegung"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="inventoryQuantity">{mode === "receipt" ? "Menge" : "Korrekturmenge"}</Label>
                <Input
                  id="inventoryQuantity"
                  type="number"
                  {...activeForm.register("quantity")}
                />
                <FieldError message={activeForm.formState.errors.quantity?.message} />
                <div className="flex flex-wrap gap-2 pt-1">
                  {(mode === "receipt" ? [1, 5, 10, 25] : [1, -1, 5, -5]).map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyPreset(preset)}
                    >
                      {preset > 0 ? `+${preset}` : preset}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inventoryNote">{mode === "receipt" ? "Bemerkung" : "Begruendung"}</Label>
                <Input
                  id="inventoryNote"
                  placeholder={mode === "receipt" ? "z. B. Lieferung 24/03" : "z. B. Zaehldifferenz"}
                  {...activeForm.register("note")}
                />
                <FieldError message={activeForm.formState.errors.note?.message} />
              </div>

              <Button type="submit" disabled={isPending} className="w-full">
                {isPending
                  ? "Buchung wird verarbeitet..."
                  : mode === "receipt"
                    ? "Wareneingang jetzt buchen"
                    : "Korrektur jetzt buchen"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/90">
          <CardHeader className="gap-4">
            <div className="space-y-2">
              <CardTitle>Bestandsmonitor</CardTitle>
              <CardDescription>
                Suche und uebernehme Artikel direkt in den Buchungsbereich. Auffaellige Positionen sind sofort
                sichtbar.
              </CardDescription>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Suche nach Artikel, Kategorie oder Standort"
                />
              </div>

              <Select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                <option value="all">Alle Standorte</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>

              <Select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as StockFilter)}>
                <option value="all">Alle Positionen</option>
                <option value="attention">Unter Minimum</option>
                <option value="quiet">Ohne Bewegung</option>
              </Select>

              <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Alle Kategorien</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-950">{formatQuantity(filteredBalances.length)}</span> Positionen sichtbar
              </p>
              <p>
                <span className="font-semibold text-slate-950">{formatQuantity(categoryOptions.length)}</span> Kategorien im Bestand
              </p>
            </div>

            {filteredBalances.length ? (
              <div className="space-y-3 xl:max-h-[calc(100vh-24rem)] xl:overflow-y-auto xl:pr-1">
                {filteredBalances.map((balance) => {
                  const selected = selectedArticle?.id === balance.articleId;
                  const attention = isAttention(balance);

                  return (
                    <button
                      key={balance.id}
                      type="button"
                      onClick={() => syncLocation(mode, balance.articleId)}
                      className={cn(
                        "w-full rounded-2xl border px-4 py-4 text-left transition",
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-white/80 hover:border-primary/40 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-slate-950">{balance.articleName}</p>
                            {attention ? <Badge variant="warning">Unter Minimum</Badge> : <Badge variant="success">Im Rahmen</Badge>}
                            {!balance.lastMovementAt ? <Badge variant="muted">Ohne Bewegung</Badge> : null}
                          </div>
                          <p className="text-sm text-slate-500">
                            {balance.locationName} | {balance.category}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-secondary/70 px-3 py-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Bestand</p>
                            <p className="mt-1 font-semibold text-slate-950">{formatQuantity(balance.quantity)}</p>
                          </div>
                          <div className="rounded-2xl bg-secondary/70 px-3 py-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Minimum</p>
                            <p className="mt-1 font-semibold text-slate-950">
                              {formatQuantity(balance.minimumStock)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-secondary/70 px-3 py-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Letzte Bewegung</p>
                            <p className="mt-1 font-semibold text-slate-950">
                              {balance.lastMovementAt ?? "Keine"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-slate-50/80 px-6 py-10 text-center">
                <p className="text-base font-medium text-slate-900">Keine Bestandsposition passend zu den Filtern.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Passe Suchbegriff oder Filter an, um wieder Artikel fuer Buchungen auszuwaehlen.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
