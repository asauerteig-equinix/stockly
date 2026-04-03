"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Camera, CheckCircle2, ChevronDown, RotateCcw, ScanLine, Settings2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { normalizeBarcode } from "@/lib/barcodes";
import { cn } from "@/lib/cn";
import { fetchJson } from "@/lib/fetch-json";
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

type FeedbackTone = "success" | "error" | "info";

type BookingSuccess = {
  action: "TAKE" | "RETURN";
  articleId: string;
  articleName: string;
  category: string;
  quantity: number;
  balanceQuantity: number;
  createdAt: number;
};

const PATCH_PATTERNS = [/\bpatch\b/i, /\bpatchkabel\b/i, /\blc[-/ ]?lc\b/i, /\bsc[-/ ]?sc\b/i, /\bcat\d/i];

function isAttention(article: ArticleResult) {
  return article.quantity <= article.minimumStock;
}

function normalizeCategory(category: string) {
  const value = category.trim();
  return value || "Sonstiges";
}

function createPopularityRank(articleIds: string[]) {
  return new Map(articleIds.map((articleId, index) => [articleId, index]));
}

function matchesPatchFocus(value: string) {
  return PATCH_PATTERNS.some((pattern) => pattern.test(value));
}

function isPatchFocusedArticle(article: ArticleResult) {
  const category = normalizeCategory(article.category);

  if (category.toLowerCase() === "kabel") {
    return true;
  }

  return matchesPatchFocus(`${article.name} ${category} ${article.description ?? ""}`);
}

function isPatchFocusedCategory(category: string, categoryArticles: ArticleResult[]) {
  const normalizedCategory = normalizeCategory(category);

  if (normalizedCategory.toLowerCase() === "kabel" || matchesPatchFocus(normalizedCategory)) {
    return true;
  }

  return categoryArticles.some(isPatchFocusedArticle);
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "de", { sensitivity: "base" });
}

function compareArticles(left: ArticleResult, right: ArticleResult, popularityRank: Map<string, number>) {
  const leftPatch = isPatchFocusedArticle(left);
  const rightPatch = isPatchFocusedArticle(right);

  if (leftPatch !== rightPatch) {
    return leftPatch ? -1 : 1;
  }

  const leftRank = popularityRank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
  const rightRank = popularityRank.get(right.id) ?? Number.MAX_SAFE_INTEGER;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return compareText(left.name, right.name);
}

function resolveInitialArticleId(articles: ArticleResult[], popularArticleIds: string[]) {
  if (!articles.length) {
    return null;
  }

  const popularityRank = createPopularityRank(popularArticleIds);
  return [...articles].sort((left, right) => compareArticles(left, right, popularityRank))[0]?.id ?? null;
}

function groupArticlesByCategory(articles: ArticleResult[]) {
  const groups = new Map<string, ArticleResult[]>();

  articles.forEach((article) => {
    const category = normalizeCategory(article.category);
    const currentGroup = groups.get(category);

    if (currentGroup) {
      currentGroup.push(article);
      return;
    }

    groups.set(category, [article]);
  });

  return Array.from(groups.entries()).sort(([leftCategory, leftArticles], [rightCategory, rightArticles]) => {
    const leftPatch = isPatchFocusedCategory(leftCategory, leftArticles);
    const rightPatch = isPatchFocusedCategory(rightCategory, rightArticles);

    if (leftPatch !== rightPatch) {
      return leftPatch ? -1 : 1;
    }

    return compareText(leftCategory, rightCategory);
  });
}

function resolveInitialCategory(articles: ArticleResult[], popularArticleIds: string[]) {
  const popularityRank = createPopularityRank(popularArticleIds);
  const orderedArticles = [...articles].sort((left, right) => compareArticles(left, right, popularityRank));
  return groupArticlesByCategory(orderedArticles)[0]?.[0] ?? null;
}

function getActionLabel(action: "TAKE" | "RETURN") {
  return action === "TAKE" ? "Entnahme" : "Rueckgabe";
}

function getActionPastTense(action: "TAKE" | "RETURN") {
  return action === "TAKE" ? "entnommen" : "zurueckgebucht";
}

export function KioskTerminal({ kiosk, usageReasons, articles, popularArticleIds }: KioskTerminalProps) {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState<ArticleResult[]>(articles);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() =>
    resolveInitialCategory(articles, popularArticleIds)
  );
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(() =>
    resolveInitialArticleId(articles, popularArticleIds)
  );
  const [quantity, setQuantity] = useState(1);
  const [usageReason, setUsageReason] = useState(usageReasons[0] ?? "project");
  const [resetPin, setResetPin] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [servicePanelOpen, setServicePanelOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string | null }>({
    tone: "info",
    message: null
  });
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<BookingSuccess | null>(null);
  const [pendingAction, setPendingAction] = useState<"TAKE" | "RETURN" | null>(null);
  const [isPending, startTransition] = useTransition();

  const popularityRank = useMemo(() => createPopularityRank(popularArticleIds), [popularArticleIds]);

  const orderedArticles = useMemo(
    () => [...catalogue].sort((left, right) => compareArticles(left, right, popularityRank)),
    [catalogue, popularityRank]
  );

  const groupedArticles = useMemo(() => groupArticlesByCategory(orderedArticles), [orderedArticles]);

  const filteredArticles = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }

    return groupedArticles.find(([category]) => category === selectedCategory)?.[1] ?? [];
  }, [groupedArticles, selectedCategory]);

  const selectedArticle = useMemo(
    () => catalogue.find((article) => article.id === selectedArticleId) ?? null,
    [catalogue, selectedArticleId]
  );

  const patchFocusedCount = useMemo(
    () => orderedArticles.filter((article) => isPatchFocusedArticle(article)).length,
    [orderedArticles]
  );

  useEffect(() => {
    if (!groupedArticles.length) {
      if (selectedCategory !== null) {
        setSelectedCategory(null);
      }
      if (selectedArticleId !== null) {
        setSelectedArticleId(null);
      }
      return;
    }

    const activeCategory =
      selectedCategory && groupedArticles.some(([category]) => category === selectedCategory)
        ? selectedCategory
        : groupedArticles[0][0];

    if (activeCategory !== selectedCategory) {
      setSelectedCategory(activeCategory);
      return;
    }

    const visibleArticles = groupedArticles.find(([category]) => category === activeCategory)?.[1] ?? [];

    if (!visibleArticles.length) {
      if (selectedArticleId !== null) {
        setSelectedArticleId(null);
      }
      return;
    }

    if (!selectedArticleId || !visibleArticles.some((article) => article.id === selectedArticleId)) {
      setSelectedArticleId(visibleArticles[0].id);
    }
  }, [groupedArticles, selectedArticleId, selectedCategory]);

  useEffect(() => {
    if (!bookingSuccess) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setBookingSuccess((currentSuccess) =>
        currentSuccess?.createdAt === bookingSuccess.createdAt ? null : currentSuccess
      );
    }, 6500);

    return () => window.clearTimeout(timeout);
  }, [bookingSuccess]);

  function clearSelectionMessages() {
    setFeedback((currentFeedback) =>
      currentFeedback.message ? { tone: "info", message: null } : currentFeedback
    );
    setBookingError(null);
    setBookingSuccess(null);
  }

  function selectCategory(category: string) {
    setSelectedCategory(category);
    setQuantity(1);
    clearSelectionMessages();
  }

  function selectArticle(articleId: string) {
    setSelectedArticleId(articleId);
    setQuantity(1);
    clearSelectionMessages();
  }

  function selectByBarcode(detectedBarcode: string) {
    const normalizedDetectedBarcode = normalizeBarcode(detectedBarcode);
    const resolvedArticle = catalogue.find(
      (article) =>
        normalizeBarcode(article.barcode) === normalizedDetectedBarcode ||
        article.additionalBarcodes.some((barcode) => normalizeBarcode(barcode) === normalizedDetectedBarcode)
    );

    if (!resolvedArticle) {
      setFeedback({
        tone: "error",
        message: `Barcode ${normalizedDetectedBarcode} erkannt, aber keinem Artikel am Standort zugeordnet.`
      });
      setBookingError(null);
      setBookingSuccess(null);
      return false;
    }

    setSelectedCategory(normalizeCategory(resolvedArticle.category));
    setSelectedArticleId(resolvedArticle.id);
    setQuantity(1);
    setBookingError(null);
    setBookingSuccess(null);
    setFeedback({
      tone: "success",
      message: `Barcode ${normalizedDetectedBarcode} erkannt. ${resolvedArticle.name} wurde fuer die Buchung uebernommen.`
    });
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
      setBookingError("Bitte zuerst einen Artikel auswaehlen.");
      setBookingSuccess(null);
      return;
    }

    const articleToBook = selectedArticle;
    const quantityToBook = quantity;
    const usageReasonToBook = usageReason;

    setPendingAction(action);
    setBookingError(null);

    startTransition(async () => {
      try {
        const response = await fetchJson<{ balance: { quantity: number } }>("/api/kiosk/book", {
          method: "POST",
          body: JSON.stringify({
            articleId: articleToBook.id,
            quantity: quantityToBook,
            action,
            usageReason: action === "TAKE" ? usageReasonToBook : null,
            note: null
          })
        });

        updateArticleQuantity(articleToBook.id, response.balance.quantity);
        setQuantity(1);
        setFeedback({ tone: "info", message: null });
        setBookingError(null);
        setBookingSuccess({
          action,
          articleId: articleToBook.id,
          articleName: articleToBook.name,
          category: articleToBook.category,
          quantity: quantityToBook,
          balanceQuantity: response.balance.quantity,
          createdAt: Date.now()
        });
      } catch (error) {
        setBookingSuccess(null);
        setBookingError(error instanceof Error ? error.message : "Buchung fehlgeschlagen.");
      } finally {
        setPendingAction(null);
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
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-white shadow-[0_20px_80px_rgba(2,6,23,0.2)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">{kiosk.locationCode}</Badge>
              <Badge variant="muted" className="bg-white/10 text-slate-100">
                {kiosk.locationName}
              </Badge>
              <Badge variant="success">Kiosk aktiv</Badge>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Kiosk Workflow</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Artikel auswaehlen und direkt buchen</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Manuell ueber Kategorien oder bei Bedarf per Scanner. Die Buchung passiert direkt im gleichen Ablauf und
                der Abschluss wird deutlich bestaetigt.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 shrink-0 border-white/10 bg-white/5 p-0 text-white hover:bg-white/10"
            onClick={() => setServicePanelOpen((currentValue) => !currentValue)}
            aria-label="Service-Menue"
          >
            {servicePanelOpen ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
          </Button>
        </div>
      </section>

      {feedback.message ? <FormFeedback message={feedback.message} tone={feedback.tone} /> : null}

      {servicePanelOpen ? (
        <Card className="ml-auto max-w-md border-white/10 bg-slate-950/88 text-white">
          <CardHeader className="gap-2 border-white/10">
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
              disabled={isPending}
              onClick={resetKiosk}
            >
              {isPending ? "Setzt zurueck..." : "Kiosk zuruecksetzen"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <Card className="border-white/10 bg-slate-950/82 text-white">
        <CardHeader className="gap-4 border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">1. Artikel finden</p>
              <CardTitle className="mt-2 text-xl">Kategorie waehlen oder Scanner oeffnen</CardTitle>
              <CardDescription className="text-slate-400">
                Die manuelle Auswahl bleibt bewusst im Vordergrund. Der Scanner ist als schnelle Zusatzfunktion
                einklappbar.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className="bg-white/10 text-slate-200">
                {formatQuantity(groupedArticles.length)} Kategorien
              </Badge>
              {patchFocusedCount ? (
                <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                  {formatQuantity(patchFocusedCount)} Patchkabel im Fokus
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-medium text-white">Kategorien</p>
            <div className="flex flex-wrap gap-2">
              {groupedArticles.map(([category, categoryArticles]) => {
                const patchCategory = isPatchFocusedCategory(category, categoryArticles);

                return (
                  <Button
                    key={category}
                    type="button"
                    size="sm"
                    variant={selectedCategory === category ? "default" : "outline"}
                    className={
                      selectedCategory === category
                        ? "gap-2"
                        : cn(
                            "gap-2 border-white/10 bg-slate-950/70 text-white hover:bg-white/5",
                            patchCategory ? "border-cyan-400/25 text-cyan-100" : ""
                          )
                    }
                    onClick={() => selectCategory(category)}
                  >
                    <span>{category}</span>
                    <span className="text-[11px] uppercase tracking-[0.12em] opacity-80">
                      {formatQuantity(categoryArticles.length)}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/60">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
              onClick={() => setScannerOpen((currentValue) => !currentValue)}
              aria-expanded={scannerOpen}
              aria-controls="kiosk-scanner-panel"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                    scannerOpen
                      ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 bg-white/5 text-slate-200"
                  )}
                >
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">Scanner verwenden</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Standardmaessig geschlossen. Nur oeffnen, wenn ein Artikel direkt per Barcode uebernommen werden soll.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Badge variant="muted" className={cn("bg-white/10", scannerOpen ? "text-cyan-100" : "text-slate-200")}>
                  {scannerOpen ? "Offen" : "Geschlossen"}
                </Badge>
                <ChevronDown
                  className={cn("h-5 w-5 text-slate-400 transition-transform", scannerOpen ? "rotate-180" : "")}
                />
              </div>
            </button>

            {scannerOpen ? (
              <div id="kiosk-scanner-panel" className="border-t border-white/10 p-5">
                <BarcodeScanner onDetected={selectByBarcode} />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-slate-950/82 text-white">
        <CardHeader className="gap-4 border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">2. Artikel waehlen</p>
              <CardTitle className="mt-2 text-xl">
                {selectedCategory ? `Artikel in ${selectedCategory}` : "Artikel der gewaehlten Kategorie"}
              </CardTitle>
              <CardDescription className="text-slate-400">
                Tippe den passenden Artikel an. Danach erscheint direkt darunter der Buchungsbereich.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className="bg-white/10 text-slate-200">
                {formatQuantity(filteredArticles.length)} Artikel sichtbar
              </Badge>
              {selectedCategory && isPatchFocusedCategory(selectedCategory, filteredArticles) ? (
                <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">Patchkabel Fokus</Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredArticles.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredArticles.map((article) => {
                const isSelected = selectedArticle?.id === article.id;
                const isFreshlyBooked = bookingSuccess?.articleId === article.id;

                return (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => selectArticle(article.id)}
                    className={cn(
                      "rounded-[1.75rem] border px-4 py-4 text-left transition",
                      isSelected
                        ? "border-cyan-400/40 bg-cyan-400/12"
                        : "border-white/10 bg-slate-900/80 hover:border-cyan-400/30 hover:bg-slate-900",
                      isFreshlyBooked ? "border-emerald-300/35 ring-1 ring-emerald-300/30" : ""
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{article.name}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{article.barcode}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isSelected ? (
                          <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">Ausgewaehlt</Badge>
                        ) : null}
                        {isFreshlyBooked ? <Badge variant="success">Gerade gebucht</Badge> : null}
                        {!isFreshlyBooked && isAttention(article) ? <Badge variant="warning">Niedrig</Badge> : null}
                      </div>
                    </div>

                    {article.description ? <p className="mt-3 text-sm text-slate-300">{article.description}</p> : null}

                    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-300">
                      <span>Bestand {formatQuantity(article.quantity)}</span>
                      <span>Min. {formatQuantity(article.minimumStock)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/50 p-8 text-center">
              <p className="text-base font-medium text-white">Keine Artikel in dieser Kategorie.</p>
              <p className="mt-2 text-sm text-slate-400">
                Waehle oben eine andere Kategorie oder oeffne den Scanner fuer die direkte Uebernahme.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-slate-950/88 text-white">
        <CardHeader className="gap-4 border-white/10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">3. Buchung durchfuehren</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ScanLine className="h-4 w-4 text-cyan-200" />
              <CardTitle className="text-xl">Buchung direkt im gleichen Ablauf</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Artikel pruefen, Menge setzen und Entnahme oder Rueckgabe sofort bestaetigen.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {bookingSuccess ? (
            <div className="rounded-[2rem] border border-emerald-300/25 bg-gradient-to-br from-emerald-400/20 via-emerald-400/10 to-slate-950/95 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.12)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Buchung erfolgreich</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {formatQuantity(bookingSuccess.quantity)} Stueck {bookingSuccess.articleName}{" "}
                    {getActionPastTense(bookingSuccess.action)}
                  </h2>
                  <p className="mt-2 text-sm text-emerald-50/90">
                    Neuer Bestand: {formatQuantity(bookingSuccess.balanceQuantity)} Stueck. Der Kiosk ist direkt fuer die
                    naechste Buchung bereit.
                  </p>
                </div>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/25 bg-emerald-300/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-100" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className="border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
                  {getActionLabel(bookingSuccess.action)}
                </Badge>
                <Badge className="border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
                  {normalizeCategory(bookingSuccess.category)}
                </Badge>
                <Badge className="border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
                  Bestand jetzt {formatQuantity(bookingSuccess.balanceQuantity)}
                </Badge>
              </div>
            </div>
          ) : null}

          {bookingError ? <FormFeedback message={bookingError} tone="error" /> : null}

          {selectedArticle ? (
            <div className="rounded-[2rem] border border-cyan-500/20 bg-cyan-500/10 p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                      {normalizeCategory(selectedArticle.category)}
                    </Badge>
                    {isPatchFocusedArticle(selectedArticle) ? (
                      <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">Patchkabel Fokus</Badge>
                    ) : null}
                    {isAttention(selectedArticle) ? <Badge variant="warning">Unter Minimum</Badge> : <Badge variant="success">Im Rahmen</Badge>}
                  </div>
                  <h2 className="mt-3 text-3xl font-semibold text-white">{selectedArticle.name}</h2>
                  {selectedArticle.description ? <p className="mt-2 text-sm text-slate-300">{selectedArticle.description}</p> : null}
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  Artikel ausgewaehlt und bereit zur Buchung
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Bestand</p>
                  <p className="mt-1 text-3xl font-semibold text-white">{formatQuantity(selectedArticle.quantity)}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Mindestbestand</p>
                  <p className="mt-1 text-3xl font-semibold text-white">{formatQuantity(selectedArticle.minimumStock)}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Barcode</p>
                  <p className="mt-1 break-all text-sm font-medium text-white">{selectedArticle.barcode}</p>
                  {selectedArticle.additionalBarcodes.length ? (
                    <p className="mt-2 text-xs text-slate-400">
                      + {formatQuantity(selectedArticle.additionalBarcodes.length)} weitere Scan-Codes
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-white/15 bg-slate-900/50 p-8 text-center text-slate-400">
              Erst einen Artikel auswaehlen oder per Scanner uebernehmen, dann erscheint hier die Buchung.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3 rounded-[1.75rem] border border-white/10 bg-slate-900/55 p-4">
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
                  disabled={!selectedArticle || isPending}
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
                  disabled={!selectedArticle || isPending}
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
                    disabled={!selectedArticle || isPending}
                    onClick={() => setQuantity(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-[1.75rem] border border-white/10 bg-slate-900/55 p-4">
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
                    className={
                      usageReason === reason
                        ? "justify-start"
                        : "justify-start border-white/10 bg-slate-950/70 text-white hover:bg-white/5"
                    }
                    disabled={!selectedArticle || isPending}
                    onClick={() => setUsageReason(reason)}
                  >
                    {reason}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Button size="lg" className="h-16 text-lg" disabled={isPending || !selectedArticle} onClick={() => book("TAKE")}>
              {pendingAction === "TAKE" ? "Entnahme wird gebucht..." : "Entnahme buchen"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-16 border-white/15 bg-transparent text-lg text-white hover:bg-white/5"
              disabled={isPending || !selectedArticle}
              onClick={() => book("RETURN")}
            >
              {pendingAction === "RETURN" ? "Rueckgabe wird gebucht..." : "Rueckgabe buchen"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
