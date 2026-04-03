"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Camera, CheckCircle2, ChevronDown, RotateCcw, ScanLine, Settings2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { articlePlaceholderImage } from "@/lib/article-images";
import { normalizeBarcode } from "@/lib/barcodes";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { fetchJson } from "@/lib/fetch-json";
import { formatQuantity } from "@/server/format";

import { BarcodeScanner } from "./barcode-scanner";
import { PinPad } from "./pin-pad";
import { playKioskTone, primeKioskAudio } from "./kiosk-audio";

type KioskContextProps = {
  locationName: string;
  locationCode: string;
};

type ArticleResult = {
  id: string;
  name: string;
  barcode: string;
  additionalBarcodes: string[];
  imageUrl: string | null;
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

type WorkflowStep = "categories" | "articles" | "booking" | "success";

type BookingSuccess = {
  action: "TAKE" | "RETURN";
  articleId: string;
  articleName: string;
  category: string;
  quantity: number;
  balanceQuantity: number;
};

const SUCCESS_STAGE_MS = 1800;
const IDLE_RESET_MS = 10000;
const PATCH_PATTERNS = [/\bpatch\b/i, /\bpatchkabel\b/i, /\blc[-/ ]?lc\b/i, /\bsc[-/ ]?sc\b/i, /\bcat\d/i];

function normalizeCategory(category: string) {
  return category.trim() || "Sonstiges";
}

function matchesPatchFocus(value: string) {
  return PATCH_PATTERNS.some((pattern) => pattern.test(value));
}

function isPatchFocusedArticle(article: ArticleResult) {
  const category = normalizeCategory(article.category);
  return category.toLowerCase() === "kabel" || matchesPatchFocus(`${article.name} ${category} ${article.description ?? ""}`);
}

function isAttention(article: ArticleResult) {
  return article.quantity <= article.minimumStock;
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "de", { sensitivity: "base" });
}

function createPopularityRank(articleIds: string[]) {
  return new Map(articleIds.map((articleId, index) => [articleId, index]));
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

function getArticleImageSrc(imageUrl: string | null | undefined) {
  return withBasePath(imageUrl || articlePlaceholderImage);
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
    const leftPatch = leftCategory.toLowerCase() === "kabel" || leftArticles.some(isPatchFocusedArticle);
    const rightPatch = rightCategory.toLowerCase() === "kabel" || rightArticles.some(isPatchFocusedArticle);

    if (leftPatch !== rightPatch) {
      return leftPatch ? -1 : 1;
    }

    return compareText(leftCategory, rightCategory);
  });
}

function getActionLabel(action: "TAKE" | "RETURN") {
  return action === "TAKE" ? "Entnahme" : "Rueckgabe";
}

function getActionPastTense(action: "TAKE" | "RETURN") {
  return action === "TAKE" ? "entnommen" : "zurueckgebucht";
}

function resolveArticlePageSize(width: number, height: number) {
  if (width >= 1500 && height >= 850) {
    return 8;
  }

  if (width >= 1100 && height >= 700) {
    return 6;
  }

  return 4;
}

export function KioskTerminal({ kiosk, usageReasons, articles, popularArticleIds }: KioskTerminalProps) {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState<ArticleResult[]>(articles);
  const [step, setStep] = useState<WorkflowStep>("categories");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [articlePage, setArticlePage] = useState(0);
  const [articlePageSize, setArticlePageSize] = useState(6);
  const [quantity, setQuantity] = useState(1);
  const [usageReason, setUsageReason] = useState(usageReasons[0] ?? "project");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [servicePanelOpen, setServicePanelOpen] = useState(false);
  const [resetPin, setResetPin] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<BookingSuccess | null>(null);
  const [pendingAction, setPendingAction] = useState<"TAKE" | "RETURN" | null>(null);
  const [isPending, startTransition] = useTransition();
  const idleResetTimeoutRef = useRef<number | null>(null);

  const popularityRank = useMemo(() => createPopularityRank(popularArticleIds), [popularArticleIds]);

  const orderedArticles = useMemo(
    () => [...catalogue].sort((left, right) => compareArticles(left, right, popularityRank)),
    [catalogue, popularityRank]
  );

  const groupedArticles = useMemo(() => groupArticlesByCategory(orderedArticles), [orderedArticles]);
  const defaultCategory = groupedArticles[0]?.[0] ?? null;
  const activeCategory = selectedCategory ?? defaultCategory;
  const categoryArticles = groupedArticles.find(([category]) => category === activeCategory)?.[1] ?? [];
  const totalArticlePages = Math.max(1, Math.ceil(categoryArticles.length / articlePageSize));
  const visibleArticles = categoryArticles.slice(
    articlePage * articlePageSize,
    articlePage * articlePageSize + articlePageSize
  );
  const selectedArticle = catalogue.find((article) => article.id === selectedArticleId) ?? null;

  useEffect(() => {
    if (articlePage > totalArticlePages - 1) {
      setArticlePage(0);
    }
  }, [articlePage, totalArticlePages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updatePageSize = () => {
      setArticlePageSize(resolveArticlePageSize(window.innerWidth, window.innerHeight));
    };

    updatePageSize();
    window.addEventListener("resize", updatePageSize);

    return () => {
      window.removeEventListener("resize", updatePageSize);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (idleResetTimeoutRef.current) {
        window.clearTimeout(idleResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (step !== "success" || !bookingSuccess) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStep("articles");
    }, SUCCESS_STAGE_MS);

    return () => window.clearTimeout(timeout);
  }, [bookingSuccess, step]);

  function clearIdleResetTimer() {
    if (idleResetTimeoutRef.current) {
      window.clearTimeout(idleResetTimeoutRef.current);
      idleResetTimeoutRef.current = null;
    }
  }

  function resetToDefault() {
    clearIdleResetTimer();
    setStep("categories");
    setSelectedCategory(defaultCategory);
    setSelectedArticleId(null);
    setArticlePage(0);
    setQuantity(1);
    setUsageReason(usageReasons[0] ?? "project");
    setScannerOpen(false);
    setServicePanelOpen(false);
    setBookingError(null);
    setBookingSuccess(null);
    setFeedback(null);
  }

  function scheduleIdleReset() {
    clearIdleResetTimer();
    idleResetTimeoutRef.current = window.setTimeout(() => {
      resetToDefault();
    }, IDLE_RESET_MS);
  }

  function handleInteractionCapture() {
    if (bookingSuccess) {
      scheduleIdleReset();
    }
  }

  function openCategory(category: string) {
    setSelectedCategory(category);
    setSelectedArticleId(null);
    setArticlePage(0);
    setStep("articles");
    setScannerOpen(false);
    setBookingError(null);
    setFeedback(null);
  }

  function openArticle(article: ArticleResult) {
    setSelectedArticleId(article.id);
    setQuantity(1);
    setStep("booking");
    setBookingError(null);
    setFeedback(null);
  }

  function resolveArticlePage(category: string, articleId: string) {
    const articlesInCategory = groupedArticles.find(([entryCategory]) => entryCategory === category)?.[1] ?? [];
    const articleIndex = articlesInCategory.findIndex((article) => article.id === articleId);
    return articleIndex >= 0 ? Math.floor(articleIndex / articlePageSize) : 0;
  }

  function selectByBarcode(detectedBarcode: string) {
    const normalizedDetectedBarcode = normalizeBarcode(detectedBarcode);
    const article = catalogue.find(
      (entry) =>
        normalizeBarcode(entry.barcode) === normalizedDetectedBarcode ||
        entry.additionalBarcodes.some((barcode) => normalizeBarcode(barcode) === normalizedDetectedBarcode)
    );

    if (!article) {
      setFeedback({
        tone: "error",
        message: `Barcode ${normalizedDetectedBarcode} ist keinem Artikel am Standort zugeordnet.`
      });
      return false;
    }

    const category = normalizeCategory(article.category);
    setSelectedCategory(category);
    setArticlePage(resolveArticlePage(category, article.id));
    setSelectedArticleId(article.id);
    setQuantity(1);
    setScannerOpen(false);
    setStep("booking");
    setBookingError(null);
    setFeedback(null);
    return true;
  }

  function updateArticleQuantity(articleId: string, nextQuantity: number) {
    setCatalogue((currentCatalogue) =>
      currentCatalogue.map((entry) => (entry.id === articleId ? { ...entry, quantity: nextQuantity } : entry))
    );
  }

  function adjustQuantity(stepOffset: number) {
    setQuantity((currentQuantity) => Math.max(1, currentQuantity + stepOffset));
  }

  function book(action: "TAKE" | "RETURN") {
    if (!selectedArticle || !activeCategory) {
      setBookingError("Bitte zuerst einen Artikel auswaehlen.");
      return;
    }

    const articleToBook = selectedArticle;
    const quantityToBook = quantity;
    const usageReasonToBook = usageReason;

    void primeKioskAudio();
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
        playKioskTone("booking-success");
        setQuantity(1);
        setStep("success");
        setBookingSuccess({
          action,
          articleId: articleToBook.id,
          articleName: articleToBook.name,
          category: articleToBook.category,
          quantity: quantityToBook,
          balanceQuantity: response.balance.quantity
        });
        setBookingError(null);
        setFeedback(null);
        scheduleIdleReset();
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
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Reset fehlgeschlagen."
        });
      }
    });
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 overflow-hidden" onPointerDownCapture={handleInteractionCapture}>
      <section className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">{kiosk.locationCode}</Badge>
          <Badge variant="muted" className="bg-white/10 text-slate-100">
            {kiosk.locationName}
          </Badge>
          <Badge variant="success">Kiosk aktiv</Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-11 border-white/10 bg-white/5 p-0 text-white hover:bg-white/10"
          onClick={() => setServicePanelOpen((currentValue) => !currentValue)}
          aria-label="Service-Menue"
        >
          {servicePanelOpen ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
        </Button>
      </section>

      {servicePanelOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => setServicePanelOpen(false)}
        >
          <Card className="w-full max-w-sm border-white/10 bg-slate-950/96 text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-slate-300" />
                  <p className="font-medium text-white">Neukopplung</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-10 border-white/10 bg-white/5 p-0 text-white hover:bg-white/10"
                  onClick={() => setServicePanelOpen(false)}
                  aria-label="Modal schliessen"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
        </div>
      ) : null}

      {feedback ? <FormFeedback message={feedback.message} tone={feedback.tone} /> : null}

      <Card className="flex-1 overflow-hidden border-white/10 bg-slate-950/88 text-white">
        <CardContent className="h-full p-4">
          {step === "categories" ? (
            <div className="flex h-full min-h-0 flex-col gap-4">
              <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/60">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Scanner</p>
                      <p className="text-sm text-slate-400">Standardmaessig geschlossen</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={scannerOpen ? "secondary" : "outline"}
                    className={scannerOpen ? "text-slate-950" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}
                    onClick={() => setScannerOpen((currentValue) => !currentValue)}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {scannerOpen ? "Scanner schliessen" : "Scanner oeffnen"}
                    <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", scannerOpen ? "rotate-180" : "")} />
                  </Button>
                </div>

                {scannerOpen ? (
                  <div className="border-t border-white/10 p-4">
                    <BarcodeScanner compact onDetected={selectByBarcode} />
                  </div>
                ) : null}
              </section>

              <section className="flex min-h-0 flex-1 flex-col rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <Badge variant="muted" className="bg-white/10 text-slate-200">
                    {formatQuantity(groupedArticles.length)} Kategorien
                  </Badge>
                  {defaultCategory ? <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">{defaultCategory}</Badge> : null}
                </div>

                <div className="grid flex-1 content-start justify-center gap-3 [grid-template-columns:repeat(auto-fit,minmax(15rem,18rem))]">
                  {groupedArticles.map(([category, categoryItems]) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => openCategory(category)}
                      className={cn(
                        "min-h-[clamp(6.75rem,13vh,8.5rem)] rounded-[1.5rem] border px-4 py-4 text-left transition",
                        selectedCategory === category
                          ? "border-cyan-400/35 bg-cyan-400/10"
                          : "border-white/10 bg-slate-950/80 hover:border-cyan-400/30 hover:bg-slate-900"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-white">{category}</p>
                          <p className="mt-2 text-sm text-slate-400">{formatQuantity(categoryItems.length)} Artikel</p>
                        </div>
                        {category.toLowerCase() === "kabel" || categoryItems.some(isPatchFocusedArticle) ? (
                          <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">Fokus</Badge>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {step === "articles" ? (
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => setStep("categories")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Kategorien
                  </Button>
                  {activeCategory ? <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">{activeCategory}</Badge> : null}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="muted" className="bg-white/10 text-slate-200">
                    {formatQuantity(categoryArticles.length)} Artikel
                  </Badge>
                  {totalArticlePages > 1 ? (
                    <Badge variant="muted" className="bg-white/10 text-slate-200">
                      {articlePage + 1}/{totalArticlePages}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid flex-1 min-h-0 content-start justify-center gap-3 [grid-template-columns:repeat(auto-fit,minmax(14rem,17rem))]">
                {visibleArticles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => openArticle(article)}
                    className={cn(
                      "min-h-[clamp(6.5rem,12vh,8rem)] rounded-[1.5rem] border px-4 py-4 text-left transition",
                      bookingSuccess?.articleId === article.id
                        ? "border-emerald-300/35 bg-emerald-400/10"
                        : "border-white/10 bg-slate-900/80 hover:border-cyan-400/30 hover:bg-slate-900"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={getArticleImageSrc(article.imageUrl)}
                        alt={article.name}
                        className="h-16 w-16 rounded-2xl border border-white/10 bg-white/10 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">{article.name}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{article.barcode}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {bookingSuccess?.articleId === article.id ? <Badge variant="success">Zuletzt</Badge> : null}
                        {bookingSuccess?.articleId !== article.id && isAttention(article) ? <Badge variant="warning">Niedrig</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-300">
                      <span>Bestand {formatQuantity(article.quantity)}</span>
                      <span>Min. {formatQuantity(article.minimumStock)}</span>
                    </div>
                  </button>
                ))}
              </div>

              {totalArticlePages > 1 ? (
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    disabled={articlePage === 0}
                    onClick={() => setArticlePage((currentValue) => currentValue - 1)}
                  >
                    Vorherige
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    disabled={articlePage >= totalArticlePages - 1}
                    onClick={() => setArticlePage((currentValue) => currentValue + 1)}
                  >
                    Naechste
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "booking" && selectedArticle ? (
            <div className="flex h-full min-h-0 flex-col gap-4">
              <section className="rounded-[1.75rem] border border-cyan-400/20 bg-cyan-500/10 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => setStep("articles")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Artikel
                  </Button>
                  <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                    {normalizeCategory(selectedArticle.category)}
                  </Badge>
                  {isPatchFocusedArticle(selectedArticle) ? (
                    <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">Fokus</Badge>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <img
                      src={getArticleImageSrc(selectedArticle.imageUrl)}
                      alt={selectedArticle.name}
                      className="h-24 w-24 rounded-[1.5rem] border border-white/10 bg-white/10 object-cover"
                    />
                    <div className="min-w-0">
                      <h2 className="text-[clamp(1.75rem,4vh,2.4rem)] font-semibold text-white">{selectedArticle.name}</h2>
                      <p className="mt-2 text-sm text-slate-300">{selectedArticle.barcode}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="min-w-[8rem] rounded-2xl bg-slate-950/60 px-4 py-3">
                      <p className="text-sm text-slate-400">Bestand</p>
                      <p className="mt-1 text-2xl font-semibold text-white">{formatQuantity(selectedArticle.quantity)}</p>
                    </div>
                    <div className="min-w-[8rem] rounded-2xl bg-slate-950/60 px-4 py-3">
                      <p className="text-sm text-slate-400">Minimum</p>
                      <p className="mt-1 text-2xl font-semibold text-white">{formatQuantity(selectedArticle.minimumStock)}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-4">
                {bookingError ? <FormFeedback message={bookingError} tone="error" /> : null}

                <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">Menge</p>
                    <Badge variant="muted" className="bg-white/10 text-slate-200">
                      {formatQuantity(quantity)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="h-[clamp(4.5rem,10vh,5.5rem)] rounded-[1.5rem] border-white/10 bg-white/5 text-[clamp(2rem,5vh,2.75rem)] text-white hover:bg-white/10"
                      onClick={() => adjustQuantity(-1)}
                    >
                      -
                    </Button>
                    <div className="flex h-[clamp(4.5rem,10vh,5.5rem)] items-center justify-center rounded-[1.5rem] border border-cyan-400/20 bg-cyan-400/10 text-[clamp(2rem,5vh,2.75rem)] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                      {formatQuantity(quantity)}
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="h-[clamp(4.5rem,10vh,5.5rem)] rounded-[1.5rem] border-white/10 bg-white/5 text-[clamp(2rem,5vh,2.75rem)] text-white hover:bg-white/10"
                      onClick={() => adjustQuantity(1)}
                    >
                      +
                    </Button>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Schnellmengen</p>
                    <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 5, 10].map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          variant={quantity === preset ? "secondary" : "outline"}
                          className={
                            quantity === preset
                              ? "h-14 rounded-2xl text-base"
                              : "h-14 rounded-2xl border-white/10 bg-white/5 text-base text-white hover:bg-white/10"
                          }
                          onClick={() => setQuantity(preset)}
                        >
                          {preset}x
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <p className="text-sm font-medium text-white">Entnahmegrund</p>
                    <Badge variant="muted" className="bg-white/10 text-slate-200">
                      TAKE
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {usageReasons.map((reason) => (
                      <Button
                        key={reason}
                        type="button"
                        variant={usageReason === reason ? "default" : "outline"}
                        className={usageReason === reason ? "" : "justify-start border-white/10 bg-white/5 text-white hover:bg-white/10"}
                        onClick={() => setUsageReason(reason)}
                      >
                        {reason}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto grid gap-3 md:grid-cols-2">
                  <Button size="lg" className="h-16 text-lg" disabled={isPending} onClick={() => book("TAKE")}>
                    {pendingAction === "TAKE" ? "Bucht..." : "Entnahme buchen"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-16 border-white/15 bg-transparent text-lg text-white hover:bg-white/5"
                    disabled={isPending}
                    onClick={() => book("RETURN")}
                  >
                    {pendingAction === "RETURN" ? "Bucht..." : "Rueckgabe buchen"}
                  </Button>
                </div>
              </section>
            </div>
          ) : null}

          {step === "success" && bookingSuccess ? (
            <div className="flex h-full min-h-0 items-center justify-center">
              <section className="w-full max-w-3xl rounded-[2rem] border border-emerald-300/25 bg-gradient-to-br from-emerald-400/20 via-emerald-400/10 to-slate-950/95 p-8 text-center shadow-[0_24px_60px_rgba(16,185,129,0.12)]">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-200/25 bg-emerald-300/10">
                  <CheckCircle2 className="h-10 w-10 text-emerald-100" />
                </div>
                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-100">{getActionLabel(bookingSuccess.action)}</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">
                  {formatQuantity(bookingSuccess.quantity)} Stueck {bookingSuccess.articleName} {getActionPastTense(bookingSuccess.action)}
                </h2>
                <p className="mt-3 text-lg text-emerald-50/90">
                  Neuer Bestand: {formatQuantity(bookingSuccess.balanceQuantity)}
                </p>
                <div className="mt-6 flex justify-center gap-2">
                  <Badge className="border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
                    {normalizeCategory(bookingSuccess.category)}
                  </Badge>
                  <Badge className="border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
                    Naechste Auswahl bleibt in der Kategorie
                  </Badge>
                </div>
              </section>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
