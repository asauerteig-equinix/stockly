"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, Layers3, PackagePlus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { articlePlaceholderImage } from "@/lib/article-images";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { fetchJson } from "@/lib/fetch-json";
import { formatQuantity } from "@/server/format";

type LocationOption = {
  id: string;
  name: string;
  code: string;
};

type ArticleOption = {
  id: string;
  locationId: string;
  name: string;
  barcode: string;
  category: string;
  sortOrder: number;
  imageUrl: string | null;
  quantity: number;
  minimumStock: number;
};

type LowStockEntry = {
  articleId: string;
  locationId: string;
  articleName: string;
  category: string;
  imageUrl: string | null;
  quantity: number;
  minimumStock: number;
  suggestedQuantity: number;
};

type DraftOrder = {
  id: string;
  orderNumber: string;
  locationId: string;
  note: string | null;
  updatedAtLabel: string;
  items: Array<{
    id: string;
    articleId: string;
    quantity: number;
    suggestedQuantity: number;
    articleName: string;
    category: string;
    imageUrl: string | null;
    currentQuantity: number;
    minimumStock: number;
  }>;
};

type OrderHistoryEntry = {
  id: string;
  orderNumber: string;
  status: "DRAFT" | "ORDERED";
  locationName: string;
  itemCount: number;
  createdAtLabel: string;
  submittedAtLabel: string;
};

type OrderWorkspaceProps = {
  locations: LocationOption[];
  articles: ArticleOption[];
  lowStock: LowStockEntry[];
  drafts: DraftOrder[];
  history: OrderHistoryEntry[];
};

const collator = new Intl.Collator("de-DE", {
  numeric: true,
  sensitivity: "base"
});

function getImageSrc(imageUrl: string | null | undefined) {
  return withBasePath(imageUrl || articlePlaceholderImage);
}

export function OrderWorkspace({ locations, articles, lowStock, drafts, history }: OrderWorkspaceProps) {
  const router = useRouter();
  const [selectedLocationId, setSelectedLocationId] = useState(
    lowStock[0]?.locationId ?? drafts[0]?.locationId ?? articles[0]?.locationId ?? locations[0]?.id ?? ""
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; message: string | null }>({
    tone: "info",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedLocationId && locations[0]?.id) {
      setSelectedLocationId(locations[0].id);
      return;
    }

    if (selectedLocationId && !locations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId(locations[0]?.id ?? "");
    }
  }, [locations, selectedLocationId]);

  const locationArticles = useMemo(() => {
    return articles
      .filter((article) => article.locationId === selectedLocationId)
      .sort((left, right) => {
        if (left.category !== right.category) {
          return collator.compare(left.category, right.category);
        }

        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return collator.compare(left.name, right.name);
      });
  }, [articles, selectedLocationId]);

  const categories = useMemo(() => {
    return Array.from(new Set(locationArticles.map((article) => article.category))).sort((left, right) =>
      collator.compare(left, right)
    );
  }, [locationArticles]);

  const manualArticles = useMemo(() => {
    return locationArticles.filter((article) => selectedCategory === "all" || article.category === selectedCategory);
  }, [locationArticles, selectedCategory]);

  const locationLowStock = useMemo(() => {
    return lowStock
      .filter((entry) => entry.locationId === selectedLocationId)
      .sort((left, right) => left.quantity - right.quantity || collator.compare(left.articleName, right.articleName));
  }, [lowStock, selectedLocationId]);

  const activeDraft = useMemo(() => {
    return drafts.find((draft) => draft.locationId === selectedLocationId) ?? null;
  }, [drafts, selectedLocationId]);

  useEffect(() => {
    setNote(activeDraft?.note ?? "");
  }, [activeDraft?.id, activeDraft?.note]);

  const totalDraftQuantity = activeDraft?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const activeDraftItemCount = activeDraft?.items.length ?? 0;

  async function addArticles(articleIds: string[]) {
    if (!selectedLocationId || articleIds.length === 0) {
      return;
    }

    setFeedback({ tone: "info", message: null });
    await fetchJson("/api/purchase-orders/draft-items", {
      method: "POST",
      body: JSON.stringify({
        locationId: selectedLocationId,
        articleIds,
        mode: articleIds.length > 1 ? "low-stock" : "single"
      })
    });
  }

  function handleAddArticles(articleIds: string[], successMessage: string) {
    startTransition(async () => {
      try {
        await addArticles(articleIds);
        setFeedback({ tone: "success", message: successMessage });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Artikel konnten nicht zur Bestellung hinzugefuegt werden."
        });
      }
    });
  }

  function handleUpdateQuantity(itemId: string, quantity: number) {
    if (!activeDraft) {
      return;
    }

    startTransition(async () => {
      try {
        await fetchJson(`/api/purchase-orders/${activeDraft.id}/items/${itemId}`, {
          method: "PATCH",
          body: JSON.stringify({
            quantity: Math.max(1, quantity)
          })
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Menge konnte nicht angepasst werden."
        });
      }
    });
  }

  function handleRemoveItem(itemId: string) {
    if (!activeDraft) {
      return;
    }

    startTransition(async () => {
      try {
        await fetchJson(`/api/purchase-orders/${activeDraft.id}/items/${itemId}`, {
          method: "DELETE"
        });
        setFeedback({ tone: "success", message: "Artikel wurde aus dem Entwurf entfernt." });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Artikel konnte nicht entfernt werden."
        });
      }
    });
  }

  function handleSubmitOrder() {
    if (!activeDraft) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetchJson<{ ok: boolean; orderId: string }>(`/api/purchase-orders/${activeDraft.id}/submit`, {
          method: "POST",
          body: JSON.stringify({
            note
          })
        });
        setFeedback({ tone: "success", message: "Bestellung wurde abgeschlossen. Die Detailansicht wird geoeffnet." });
        setNote("");
        router.push(`/admin/orders/${response.orderId}`);
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Bestellung konnte nicht abgeschlossen werden."
        });
      }
    });
  }

  function handleDeleteOrder() {
    if (!activeDraft) {
      return;
    }

    if (!window.confirm(`Entwurf ${activeDraft.orderNumber} wirklich loeschen?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await fetchJson(`/api/purchase-orders/${activeDraft.id}`, {
          method: "DELETE"
        });
        setFeedback({ tone: "success", message: "Der Bestellentwurf wurde geloescht." });
        setNote("");
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Bestellung konnte nicht geloescht werden."
        });
      }
    });
  }

  if (!selectedLocationId) {
    return (
      <Card className="border-white/80 bg-white/90">
        <CardContent className="p-8 text-center text-sm text-slate-500">
          Fuer die aktuelle Ansicht ist kein Standort verfuegbar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <FormFeedback message={feedback.message} tone={feedback.tone} />

      <Card className="border-white/80 bg-white/95">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap gap-3">
            {locations.map((location) => (
              <Button
                key={location.id}
                variant={selectedLocationId === location.id ? "default" : "outline"}
                onClick={() => {
                  setSelectedLocationId(location.id);
                  setSelectedCategory("all");
                  setFeedback({ tone: "info", message: null });
                }}
              >
                {location.name} ({location.code})
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-secondary/60 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Low Stock</p>
              <p className="mt-1 text-3xl font-semibold text-slate-950">{formatQuantity(locationLowStock.length)}</p>
              <p className="mt-1 text-sm text-slate-600">Artikel mit sofortigem Nachbestellbedarf.</p>
            </div>
            <div className="rounded-2xl bg-secondary/60 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Artikel im Zugriff</p>
              <p className="mt-1 text-3xl font-semibold text-slate-950">{formatQuantity(locationArticles.length)}</p>
              <p className="mt-1 text-sm text-slate-600">Manuelle Auswahl fuer Inventur und Nachfuellung.</p>
            </div>
            <div className="rounded-2xl bg-secondary/60 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Entwurf</p>
              <p className="mt-1 text-3xl font-semibold text-slate-950">{activeDraft ? "Aktiv" : "Keiner"}</p>
              <p className="mt-1 text-sm text-slate-600">
                {activeDraft
                  ? `Automatisch gespeichert / ${formatQuantity(activeDraftItemCount)} Positionen in ${activeDraft.orderNumber}`
                  : "Noch kein offener Entwurf fuer diesen Standort."}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="space-y-6">
          <Card className="border-white/80 bg-white/95">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Unter Mindestbestand</CardTitle>
                  <CardDescription>Die Vorschlagsmenge fuellt bis zum konfigurierten Zielbestand auf.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  disabled={isPending || locationLowStock.length === 0}
                  onClick={() =>
                    handleAddArticles(
                      locationLowStock.map((entry) => entry.articleId),
                      "Alle Low-Stock-Artikel wurden in den Entwurf uebernommen."
                    )
                  }
                >
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Alle uebernehmen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {locationLowStock.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {locationLowStock.map((entry) => (
                    <article key={entry.articleId} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={getImageSrc(entry.imageUrl)}
                          alt={entry.articleName}
                          className="h-16 w-16 rounded-2xl border border-white bg-white object-cover shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="warning">Low Stock</Badge>
                            <Badge variant="muted">{entry.category}</Badge>
                          </div>
                          <h3 className="mt-2 text-base font-semibold text-slate-950">{entry.articleName}</h3>
                          <p className="mt-2 text-sm text-slate-600">
                            Bestand {formatQuantity(entry.quantity)} / Minimum {formatQuantity(entry.minimumStock)}
                          </p>
                          <p className="text-sm font-medium text-amber-900">
                            Vorschlag: {formatQuantity(entry.suggestedQuantity)} Stueck
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleAddArticles([entry.articleId], `${entry.articleName} wurde in den Entwurf uebernommen.`)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Hinzufuegen
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-slate-50/80 px-6 py-10 text-center">
                  <p className="text-base font-medium text-slate-900">Keine Low-Stock-Artikel fuer diesen Standort.</p>
                  <p className="mt-2 text-sm text-slate-500">Du kannst trotzdem weitere Artikel manuell fuer eine Bestellung sammeln.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/80 bg-white/95">
            <CardHeader className="gap-3">
              <CardTitle>Weitere Artikel manuell hinzufuegen</CardTitle>
              <CardDescription>Die Auswahl bleibt bewusst simpel: Kategorie waehlen und Artikel direkt anklicken.</CardDescription>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  onClick={() => setSelectedCategory("all")}
                >
                  Alle
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category}
                    size="sm"
                    variant={selectedCategory === category ? "default" : "outline"}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {manualArticles.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {manualArticles.map((article) => {
                    const alreadyIncluded = activeDraft?.items.some((item) => item.articleId === article.id) ?? false;

                    return (
                      <article
                        key={article.id}
                        className={cn(
                          "rounded-2xl border p-4 transition",
                          alreadyIncluded ? "border-emerald-200 bg-emerald-50/80" : "border-border bg-slate-50/80"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={getImageSrc(article.imageUrl)}
                            alt={article.name}
                            className="h-16 w-16 rounded-2xl border border-white bg-white object-cover shadow-sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="muted">{article.category}</Badge>
                              {alreadyIncluded ? <Badge variant="success">Im Entwurf</Badge> : null}
                            </div>
                            <h3 className="mt-2 text-sm font-semibold text-slate-950">{article.name}</h3>
                            <p className="mt-2 text-xs text-slate-500">Barcode {article.barcode}</p>
                            <p className="text-sm text-slate-600">
                              Bestand {formatQuantity(article.quantity)} / Minimum {formatQuantity(article.minimumStock)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Button
                            size="sm"
                            variant={alreadyIncluded ? "secondary" : "outline"}
                            disabled={isPending}
                            onClick={() => handleAddArticles([article.id], `${article.name} wurde in den Entwurf uebernommen.`)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {alreadyIncluded ? "Aktualisieren" : "Hinzufuegen"}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-slate-50/80 px-6 py-10 text-center">
                  <p className="text-base font-medium text-slate-900">Keine Artikel in dieser Kategorie.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/80 bg-white/95 xl:sticky xl:top-8">
          <CardHeader className="gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Aktiver Bestellentwurf</CardTitle>
                <CardDescription>
                  {activeDraft
                    ? `${activeDraft.orderNumber} / zuletzt aktualisiert ${activeDraft.updatedAtLabel}`
                    : "Sobald du Artikel hinzufuegst, entsteht hier automatisch ein Entwurf."}
                </CardDescription>
              </div>
              {activeDraft ? <OrderStatusBadge status="DRAFT" /> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-secondary/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Positionen</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950">{formatQuantity(activeDraft?.items.length ?? 0)}</p>
              </div>
              <div className="rounded-2xl bg-secondary/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Gesamtmenge</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950">{formatQuantity(totalDraftQuantity)}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {activeDraft ? (
              <>
                <div className="max-h-[34rem] space-y-3 overflow-auto pr-1">
                  {activeDraft.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border bg-slate-50/80 p-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={getImageSrc(item.imageUrl)}
                          alt={item.articleName}
                          className="h-14 w-14 rounded-2xl border border-white bg-white object-cover shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="muted">{item.category}</Badge>
                            {item.currentQuantity <= item.minimumStock ? <Badge variant="warning">Low Stock</Badge> : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-950">{item.articleName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Bestand {formatQuantity(item.currentQuantity)} / Minimum {formatQuantity(item.minimumStock)}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveItem(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-4 grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => handleUpdateQuantity(item.id, Number.parseInt(event.target.value, 10) || 1)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Vorschlagsmenge {formatQuantity(item.suggestedQuantity)} Stueck</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900" htmlFor="order-note">
                    Notiz zur Bestellung
                  </label>
                  <Textarea
                    id="order-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optionaler Hinweis fuer diese Bestellung"
                    className="min-h-[110px]"
                  />
                </div>

                <Button className="w-full" disabled={isPending || activeDraft.items.length === 0} onClick={handleSubmitOrder}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isPending ? "Speichert..." : "Bestellung abschliessen"}
                </Button>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/admin/orders/${activeDraft.id}`}
                    className={buttonVariants({ variant: "outline", className: "flex-1" })}
                  >
                    Details ansehen
                  </Link>
                  <Button variant="destructive" className="flex-1" disabled={isPending} onClick={handleDeleteOrder}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Entwurf loeschen
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-slate-50/80 px-6 py-10 text-center">
                <ShoppingCart className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 text-base font-medium text-slate-900">Noch kein Entwurf fuer diesen Standort.</p>
                <p className="mt-2 text-sm text-slate-500">Uebernimm Low-Stock-Artikel oder fuege manuell Positionen hinzu.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/80 bg-white/90">
        <CardHeader className="gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Bestellhistorie</CardTitle>
              <CardDescription>Bereits abgeschlossene Bestellungen bleiben als Verlauf direkt in Stockly sichtbar.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {history.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {history.map((order) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`} className="rounded-2xl border border-border bg-white px-4 py-4 transition hover:border-slate-400 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-950">{order.orderNumber}</p>
                      <p className="text-sm text-slate-500">{order.locationName}</p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-secondary/60 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Positionen</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">{formatQuantity(order.itemCount)}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/60 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Bestellt am</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{order.submittedAtLabel}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Erstellt {order.createdAtLabel}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-slate-50/80 px-6 py-10 text-center">
              <Layers3 className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-base font-medium text-slate-900">Noch keine abgeschlossenen Bestellungen.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
