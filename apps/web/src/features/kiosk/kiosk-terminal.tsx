"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, RotateCcw, ScanLine, Settings2, TriangleAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { normalizeBarcode } from "@/lib/barcodes";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/cn";
import { formatQuantity } from "@/server/format";

import { BarcodeScanner } from "./barcode-scanner";
import { PinPad } from "./pin-pad";

type KioskContextProps = {
  locationName: string;
  locationCode: string;
};

type ArticleResult = {
  id: string;
  name: string;
  barcode: string;
  additionalBarcodes: string[];
  description: string | null;
  category: string;
  minimumStock: number;
  quantity: number;
};

type KioskTerminalProps = {
  kiosk: KioskContextProps;
  usageReasons: string[];
  articles: ArticleResult[];
  popularArticleIds: string[];
};

function isAttention(article: ArticleResult) {
  return article.quantity <= article.minimumStock;
}

export function KioskTerminal({ kiosk, usageReasons, articles, popularArticleIds }: KioskTerminalProps) {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState<ArticleResult[]>(articles);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(popularArticleIds[0] ?? articles[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [usageReason, setUsageReason] = useState(usageReasons[0] ?? "project");
  const [resetPin, setResetPin] = useState("");
  const [scannerOpen, setScannerOpen] = useState(true);
  const [servicePanelOpen, setServicePanelOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string | null }>({
    tone: "success",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  const categoryOptions = useMemo(
    () => Array.from(new Set(catalogue.map((article) => article.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [catalogue]
  );

  const selectedArticle = useMemo(
    () => catalogue.find((article) => article.id === selectedArticleId) ?? null,
    [catalogue, selectedArticleId]
  );

  const featuredArticles = useMemo(() => {
    const resolved = popularArticleIds
      .map((articleId) => catalogue.find((article) => article.id === articleId) ?? null)
      .filter((article): article is ArticleResult => Boolean(article));

    return resolved.length ? resolved.slice(0, 8) : catalogue.slice(0, 8);
  }, [catalogue, popularArticleIds]);

  const filteredArticles = useMemo(() => {
    if (selectedCategory === "all") {
      return catalogue;
    }

    return catalogue.filter((article) => article.category === selectedCategory);
  }, [catalogue, selectedCategory]);

  function selectArticle(articleId: string) {
    setSelectedArticleId(articleId);
    setQuantity(1);
    setFeedback((currentFeedback) =>
      currentFeedback.message ? { tone: currentFeedback.tone, message: null } : currentFeedback
    );
  }

  function selectByBarcode(detectedBarcode: string) {
    const normalizedBarcode = normalizeBarcode(detectedBarcode);
    const resolvedArticle = catalogue.find(
      (article) =>
        normalizeBarcode(article.barcode) === normalizedBarcode ||
        article.additionalBarcodes.some((barcode) => normalizeBarcode(barcode) === normalizedBarcode)
    );

    if (!resolvedArticle) {
      setFeedback({
        tone: "error",
        message: `Barcode ${normalizedBarcode} erkannt, aber keinem Artikel am Standort zugeordnet.`
      });
      return false;
    }

    setSelectedCategory(resolvedArticle.category);
    setSelectedArticleId(resolvedArticle.id);
    setQuantity(1);
    setFeedback({ tone: "success", message: `Barcode ${normalizedBarcode} erkannt. Artikel wurde uebernommen.` });
    return true;
  }

  function updateArticleQuantity(articleId: string, nextQuantity: number) {
    setCatalogue((currentCatalogue) =>
      currentCatalogue.map((entry) => (entry.id === articleId ? { ...entry, quantity: nextQuantity } : entry))
    );
  }

  function adjustQuantity(step: number) {
    setQuantity((currentQuantity) => Math.max(1, currentQuantity + step));
  }

  function book(action: "TAKE" | "RETURN") {
    if (!selectedArticle) {
      setFeedback({ tone: "error", message: "Bitte zuerst einen Artikel auswaehlen." });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetchJson<{ balance: { quantity: number } }>("/api/kiosk/book", {
          method: "POST",
          body: JSON.stringify({
            articleId: selectedArticle.id,
            quantity,
            action,
            usageReason: action === "TAKE" ? usageReason : null,
            note: null
          })
        });

        updateArticleQuantity(selectedArticle.id, response.balance.quantity);
        setQuantity(1);
        setFeedback({
          tone: "success",
          message: action === "TAKE" ? "Entnahme erfolgreich gebucht." : "Rueckgabe erfolgreich gebucht."
        });
      } catch (error) {
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Buchung fehlgeschlagen." });
      }
    });
  }

  function resetKiosk() {
    startTransition(async () => {
      try {
        await fetchJson("/api/kiosk/reset", {
          method: "POST",
          body: JSON.stringify({ pin: resetPin })
        });
        setFeedback({ tone: "success", message: "Kioskbindung wurde aufgehoben." });
        setServicePanelOpen(false);
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Reset fehlgeschlagen." });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">{kiosk.locationCode}</Badge>
          <Badge variant="muted" className="bg-white/10 text-slate-100">
            {kiosk.locationName}
          </Badge>
          <Badge variant="success">Kiosk aktiv</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => setScannerOpen((currentValue) => !currentValue)}
          >
            <Camera className="mr-2 h-4 w-4" />
            {scannerOpen ? "Scanner ausblenden" : "Scanner anzeigen"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 border-white/10 bg-white/5 p-0 text-white hover:bg-white/10"
            onClick={() => setServicePanelOpen((currentValue) => !currentValue)}
            aria-label="Service-Menue"
          >
            {servicePanelOpen ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {feedback.message ? <FormFeedback message={feedback.message} tone={feedback.tone} /> : null}

      {servicePanelOpen ? (
        <Card className="ml-auto max-w-md border-white/10 bg-slate-950/88 text-white">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-slate-300" />
              <CardTitle className="text-base">Service / Neukopplung</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Nur bei Standortwechsel oder bewusstem Reset verwenden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PinPad label="Reset-PIN" value={resetPin} onChange={setResetPin} maxLength={20} />
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/10 bg-transparent text-white hover:bg-white/5"
              onClick={resetKiosk}
            >
              Kiosk zuruecksetzen
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="space-y-5">
          {scannerOpen ? (
            <Card className="border-white/10 bg-slate-950/82 text-white">
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Scanner</CardTitle>
                    <CardDescription className="text-slate-400">
                      Scannen, Ton bestaetigt das Ergebnis, danach direkt weiterbuchen.
                    </CardDescription>
                  </div>
                  <Badge variant="muted" className="bg-white/10 text-slate-200">
                    Dauerbetrieb
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <BarcodeScanner onDetected={selectByBarcode} />
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-white/10 bg-slate-950/82 text-white">
            <CardHeader className="gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Artikel</CardTitle>
                  <CardDescription className="text-slate-400">
                    Antippen oder scannen und rechts direkt buchen.
                  </CardDescription>
                </div>
                <Badge variant="muted" className="bg-white/10 text-slate-200">
                  {formatQuantity(filteredArticles.length)} sichtbar
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  className={selectedCategory === "all" ? "" : "border-white/10 bg-slate-950/70 text-white hover:bg-white/5"}
                  onClick={() => setSelectedCategory("all")}
                >
                  Alle
                </Button>
                {categoryOptions.map((category) => (
                  <Button
                    key={category}
                    type="button"
                    size="sm"
                    variant={selectedCategory === category ? "default" : "outline"}
                    className={
                      selectedCategory === category ? "" : "border-white/10 bg-slate-950/70 text-white hover:bg-white/5"
                    }
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">Schnellwahl</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Zuletzt genutzt</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {featuredArticles.map((article) => (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => selectArticle(article.id)}
                      className={cn(
                        "rounded-2xl border px-4 py-4 text-left transition",
                        selectedArticle?.id === article.id
                          ? "border-cyan-400/40 bg-cyan-400/12"
                          : "border-white/10 bg-slate-900/80 hover:border-cyan-400/30 hover:bg-slate-900"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{article.name}</p>
                          <p className="mt-1 text-sm text-slate-400">{article.category}</p>
                        </div>
                        {isAttention(article) ? <TriangleAlert className="h-4 w-4 text-amber-300" /> : null}
                      </div>
                      <p className="mt-4 text-sm text-slate-300">Bestand {formatQuantity(article.quantity)}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid max-h-[40rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredArticles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => selectArticle(article.id)}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition",
                      selectedArticle?.id === article.id
                        ? "border-cyan-400/40 bg-cyan-400/12"
                        : "border-white/10 bg-slate-900/80 hover:border-cyan-400/30 hover:bg-slate-900"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{article.name}</p>
                        <p className="mt-1 text-sm text-slate-400">{article.category}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{article.barcode}</p>
                        {article.additionalBarcodes.length ? (
                          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                            + {article.additionalBarcodes.length} weitere
                          </p>
                        ) : null}
                      </div>
                      {isAttention(article) ? <Badge variant="warning">Niedrig</Badge> : <Badge variant="success">OK</Badge>}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-300">
                      <span>Bestand {formatQuantity(article.quantity)}</span>
                      <span>Min. {formatQuantity(article.minimumStock)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-slate-950/88 text-white xl:sticky xl:top-4">
          <CardHeader className="gap-3">
            <div className="flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-cyan-200" />
              <CardTitle>Buchung</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Artikel waehlen, Menge festlegen, direkt buchen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedArticle ? (
              <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">{selectedArticle.category}</Badge>
                  {isAttention(selectedArticle) ? <Badge variant="warning">Unter Minimum</Badge> : <Badge variant="success">Im Rahmen</Badge>}
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-white">{selectedArticle.name}</h2>
                {selectedArticle.description ? <p className="mt-2 text-sm text-slate-300">{selectedArticle.description}</p> : null}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-900/70 p-4">
                    <p className="text-sm text-slate-400">Bestand</p>
                    <p className="mt-1 text-3xl font-semibold text-white">{formatQuantity(selectedArticle.quantity)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/70 p-4">
                    <p className="text-sm text-slate-400">Mindestbestand</p>
                    <p className="mt-1 text-3xl font-semibold text-white">{formatQuantity(selectedArticle.minimumStock)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/50 p-8 text-center text-slate-400">
                Links scannen oder einen Artikel antippen, um die Buchung zu starten.
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">Menge</p>
                <Badge variant="muted" className="bg-white/10 text-slate-200">
                  {formatQuantity(quantity)} Stueck
                </Badge>
              </div>

              <div className="grid grid-cols-[72px_minmax(0,1fr)_72px] gap-3">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="h-16 border-white/10 bg-slate-950/70 text-3xl text-white hover:bg-white/5"
                  onClick={() => adjustQuantity(-1)}
                >
                  -
                </Button>
                <div className="flex h-16 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/80 text-3xl font-semibold text-white">
                  {formatQuantity(quantity)}
                </div>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="h-16 border-white/10 bg-slate-950/70 text-3xl text-white hover:bg-white/5"
                  onClick={() => adjustQuantity(1)}
                >
                  +
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 5, 10].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    className="h-12 border-white/10 bg-slate-950/70 text-white hover:bg-white/5"
                    onClick={() => setQuantity(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">Entnahmegrund</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Nur fuer Entnahme</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {usageReasons.map((reason) => (
                  <Button
                    key={reason}
                    type="button"
                    variant={usageReason === reason ? "default" : "outline"}
                    className={usageReason === reason ? "justify-start" : "justify-start border-white/10 bg-slate-950/70 text-white hover:bg-white/5"}
                    onClick={() => setUsageReason(reason)}
                  >
                    {reason}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="lg" className="h-16 text-lg" disabled={isPending || !selectedArticle} onClick={() => book("TAKE")}>
                Entnahme buchen
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-16 border-white/15 bg-transparent text-lg text-white hover:bg-white/5"
                disabled={isPending || !selectedArticle}
                onClick={() => book("RETURN")}
              >
                Rueckgabe buchen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
