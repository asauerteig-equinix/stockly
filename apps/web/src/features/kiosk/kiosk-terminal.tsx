"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fetchJson } from "@/lib/fetch-json";
import { formatQuantity } from "@/server/format";

import { BarcodeScanner } from "./barcode-scanner";

type KioskContextProps = {
  locationName: string;
  locationCode: string;
};

type ArticleResult = {
  id: string;
  name: string;
  barcode: string;
  description: string | null;
  category: string;
  minimumStock: number;
  quantity: number;
};

type KioskTerminalProps = {
  kiosk: KioskContextProps;
  usageReasons: string[];
};

export function KioskTerminal({ kiosk, usageReasons }: KioskTerminalProps) {
  const router = useRouter();
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [usageReason, setUsageReason] = useState(usageReasons[0] ?? "project");
  const [note, setNote] = useState("");
  const [resetPin, setResetPin] = useState("");
  const [article, setArticle] = useState<ArticleResult | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string | null }>({
    tone: "success",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  const usageReasonOptions = useMemo(() => usageReasons, [usageReasons]);

  function lookupArticle(resolvedBarcode?: string) {
    const nextBarcode = resolvedBarcode ?? barcode;

    if (!nextBarcode) {
      setFeedback({ tone: "error", message: "Bitte zuerst einen Barcode erfassen." });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetchJson<{ article: ArticleResult }>(
          `/api/kiosk/lookup?barcode=${encodeURIComponent(nextBarcode)}`
        );
        setArticle(response.article);
        setBarcode(nextBarcode);
        setFeedback({ tone: "success", message: "Artikel erfolgreich geladen." });
      } catch (error) {
        setArticle(null);
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Artikel nicht gefunden." });
      }
    });
  }

  function book(action: "TAKE" | "RETURN") {
    if (!article) {
      setFeedback({ tone: "error", message: "Es ist noch kein Artikel geladen." });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetchJson<{ balance: { quantity: number } }>("/api/kiosk/book", {
          method: "POST",
          body: JSON.stringify({
            articleId: article.id,
            quantity,
            action,
            usageReason: action === "TAKE" ? usageReason : null,
            note
          })
        });

        setArticle({
          ...article,
          quantity: response.balance.quantity
        });
        setNote("");
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
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Reset fehlgeschlagen." });
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>{kiosk.locationName}</CardTitle>
            <CardDescription className="text-slate-400">
              Kiosk gekoppelt an Standort {kiosk.locationCode}. Buchungen sind nur fuer diesen Standort erlaubt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormFeedback message={feedback.message} tone={feedback.tone} />

            <div className="space-y-2">
              <Label htmlFor="barcode" className="text-slate-100">
                Barcode
              </Label>
              <div className="flex gap-3">
                <Input id="barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} />
                <Button size="lg" onClick={() => lookupArticle()}>
                  Suchen
                </Button>
              </div>
            </div>

            <BarcodeScanner
              onDetected={(detectedBarcode) => {
                setBarcode(detectedBarcode);
                lookupArticle(detectedBarcode);
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Geschuetzter Reset</CardTitle>
            <CardDescription className="text-slate-400">
              Fuer eine Neuverbindung muss der Standort-PIN erneut bestaetigt werden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resetPin" className="text-slate-100">
                Standort-PIN
              </Label>
              <Input id="resetPin" type="password" value={resetPin} onChange={(event) => setResetPin(event.target.value)} />
            </div>
            <Button variant="outline" className="w-full border-white/10 bg-transparent text-white hover:bg-white/5" onClick={resetKiosk}>
              Kioskbindung aufheben
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-slate-950/80 text-white">
        <CardHeader>
          <CardTitle>Lagerbuchung</CardTitle>
          <CardDescription className="text-slate-400">
            Touchoptimierte Entnahme- und Rueckgabeerfassung mit dynamisch sortierten Entnahmegruenden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {article ? (
            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Erfasster Artikel</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{article.name}</h2>
              <p className="text-slate-300">
                Barcode {article.barcode} • Kategorie {article.category}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Aktueller Bestand</p>
                  <p className="mt-1 text-3xl font-semibold text-white">{formatQuantity(article.quantity)}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Mindestbestand</p>
                  <p className="mt-1 text-3xl font-semibold text-white">{formatQuantity(article.minimumStock)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/50 p-8 text-center text-slate-400">
              Nach Scan oder manueller Eingabe erscheint hier der zugehoerige Artikel.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-slate-100">
                Menge
              </Label>
              <Input id="quantity" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usageReason" className="text-slate-100">
                Entnahmegrund
              </Label>
              <Select id="usageReason" value={usageReason} onChange={(event) => setUsageReason(event.target.value)}>
                {usageReasonOptions.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note" className="text-slate-100">
              Notiz
            </Label>
            <Input id="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" className="h-16 text-lg" disabled={isPending} onClick={() => book("TAKE")}>
              Entnahme buchen
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-16 border-white/15 bg-transparent text-lg text-white hover:bg-white/5"
              disabled={isPending}
              onClick={() => book("RETURN")}
            >
              Rueckgabe buchen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
