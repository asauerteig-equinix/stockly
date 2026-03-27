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
import { formatQuantity } from "@/server/format";
import { correctionSchema, goodsReceiptSchema } from "@/server/validation";

type GoodsReceiptValues = z.infer<typeof goodsReceiptSchema>;
type CorrectionValues = z.infer<typeof correctionSchema>;

type ArticleOption = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
};

type BalanceEntry = {
  id: string;
  locationName: string;
  articleName: string;
  quantity: number;
  minimumStock: number;
  lastMovementAt: string | null;
};

type InventoryManagementProps = {
  articles: ArticleOption[];
  balances: BalanceEntry[];
};

export function InventoryManagement({ articles, balances }: InventoryManagementProps) {
  const router = useRouter();
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

  const syncLocation = (formName: "goodsReceipt" | "correction", articleId: string) => {
    const article = articles.find((entry) => entry.id === articleId);
    if (!article) {
      return;
    }

    if (formName === "goodsReceipt") {
      goodsReceiptForm.setValue("locationId", article.locationId);
      return;
    }

    correctionForm.setValue("locationId", article.locationId);
  };

  const submitGoodsReceipt = goodsReceiptForm.handleSubmit((values) => {
    startTransition(async () => {
      try {
        await fetchJson("/api/inventory/goods-receipt", {
          method: "POST",
          body: JSON.stringify(values)
        });
        setFeedback({ tone: "success", message: "Wareneingang erfolgreich gebucht." });
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
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Korrektur fehlgeschlagen." });
      }
    });
  });

  return (
    <div className="space-y-6">
      <FormFeedback message={feedback.message} tone={feedback.tone} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Wareneingang</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitGoodsReceipt}>
              <div className="space-y-2">
                <Label htmlFor="receiptArticle">Artikel</Label>
                <Select
                  id="receiptArticle"
                  {...goodsReceiptForm.register("articleId")}
                  onChange={(event) => {
                    goodsReceiptForm.setValue("articleId", event.target.value);
                    syncLocation("goodsReceipt", event.target.value);
                  }}
                >
                  {articles.map((article) => (
                    <option key={article.id} value={article.id}>
                      {article.name} ({article.locationName})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiptQuantity">Menge</Label>
                <Input id="receiptQuantity" type="number" {...goodsReceiptForm.register("quantity")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiptNote">Bemerkung</Label>
                <Input id="receiptNote" {...goodsReceiptForm.register("note")} />
              </div>

              <Button type="submit" disabled={isPending}>
                {isPending ? "Bucht..." : "Wareneingang buchen"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Korrektur</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitCorrection}>
              <div className="space-y-2">
                <Label htmlFor="correctionArticle">Artikel</Label>
                <Select
                  id="correctionArticle"
                  {...correctionForm.register("articleId")}
                  onChange={(event) => {
                    correctionForm.setValue("articleId", event.target.value);
                    syncLocation("correction", event.target.value);
                  }}
                >
                  {articles.map((article) => (
                    <option key={article.id} value={article.id}>
                      {article.name} ({article.locationName})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="correctionQuantity">Korrekturmenge</Label>
                <Input id="correctionQuantity" type="number" {...correctionForm.register("quantity")} />
                <p className="text-xs text-slate-500">Positive Werte erhoehen den Bestand, negative Werte reduzieren ihn.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="correctionNote">Begruendung</Label>
                <Input id="correctionNote" {...correctionForm.register("note")} />
              </div>

              <Button type="submit" disabled={isPending}>
                {isPending ? "Bucht..." : "Korrektur buchen"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktuelle Bestandsuebersicht</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artikel</TableHead>
                <TableHead>Standort</TableHead>
                <TableHead>Bestand</TableHead>
                <TableHead>Mindestbestand</TableHead>
                <TableHead>Letzte Bewegung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((balance) => (
                <TableRow key={balance.id}>
                  <TableCell>{balance.articleName}</TableCell>
                  <TableCell>{balance.locationName}</TableCell>
                  <TableCell>{formatQuantity(balance.quantity)}</TableCell>
                  <TableCell>{formatQuantity(balance.minimumStock)}</TableCell>
                  <TableCell>{balance.lastMovementAt ?? "Keine Bewegung"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
