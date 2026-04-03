import { notFound } from "next/navigation";

import { PageIntro } from "@/components/layout/page-intro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderDetailActions } from "@/features/orders/order-detail-actions";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { articlePlaceholderImage } from "@/lib/article-images";
import { withBasePath } from "@/lib/base-path";
import { formatCurrency } from "@/lib/currency";
import { requireUser } from "@/server/auth";
import { formatDateTime, formatQuantity } from "@/server/format";
import { getPurchaseOrderForUser } from "@/server/order-documents";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const order = await getPurchaseOrderForUser(id, user);

  if (!order) {
    notFound();
  }

  const totalOrderAmountCents = order.items.reduce(
    (sum, item) => sum + (item.unitPriceCentsSnapshot ?? 0) * item.quantity,
    0
  );
  const itemsWithoutPrice = order.items.filter((item) => item.unitPriceCentsSnapshot === null).length;

  return (
    <div className="space-y-8">
      <PageIntro
        title={order.orderNumber}
        description="Bestelldetails mit Standort, Verlauf und allen Positionen der zusammengestellten Nachbestellung."
      />

      <OrderDetailActions
        orderId={order.id}
        orderNumber={order.orderNumber}
        emailHref={`/admin/orders/${order.id}/email`}
        pdfHref={`/api/purchase-orders/${order.id}/pdf`}
      />

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="border-white/80 bg-white/95">
          <CardHeader className="gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Kopfdaten</CardTitle>
                <p className="mt-1 text-sm text-slate-500">{order.location.name}</p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>
              <strong>Status:</strong> {order.status === "DRAFT" ? "Entwurf" : "Bestellt"}
            </p>
            <p>
              <strong>Standort:</strong> {order.location.name} ({order.location.code})
            </p>
            <p>
              <strong>Erstellt von:</strong> {order.createdByUser.name}
            </p>
            <p>
              <strong>Zuletzt bearbeitet von:</strong> {order.updatedByUser?.name || order.createdByUser.name}
            </p>
            <p>
              <strong>Erstellt am:</strong> {formatDateTime(order.createdAt)}
            </p>
            <p>
              <strong>Zuletzt aktualisiert:</strong> {formatDateTime(order.updatedAt)}
            </p>
            <p>
              <strong>Abgeschlossen am:</strong> {formatDateTime(order.submittedAt)}
            </p>
            <p>
              <strong>Positionen:</strong> {formatQuantity(order.items.length)}
            </p>
            <p>
              <strong>Gesamtsumme:</strong> {formatCurrency(totalOrderAmountCents, "0,00 EUR")}
            </p>
            {itemsWithoutPrice ? (
              <p>
                <strong>Ohne Preis:</strong> {formatQuantity(itemsWithoutPrice)} Positionen
              </p>
            ) : null}
            <div className="rounded-2xl bg-secondary/60 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Notiz</p>
              <p className="mt-2 text-sm text-slate-700">{order.note || "Keine zusaetzliche Notiz hinterlegt."}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/95">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>Positionen</CardTitle>
            <p className="text-sm text-slate-500">{formatQuantity(order.items.length)} Eintraege</p>
          </CardHeader>
          <CardContent>
            {order.items.length ? (
              <div className="space-y-3">
                {order.items.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-border bg-slate-50/80 p-4">
                    <div className="flex items-start gap-3">
                      <img
                        src={withBasePath(item.imageUrlSnapshot || articlePlaceholderImage)}
                        alt={item.articleNameSnapshot}
                        className="h-16 w-16 rounded-2xl border border-white bg-white object-cover shadow-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {item.categorySnapshot}
                          </span>
                        </div>
                        <h2 className="mt-2 text-base font-semibold text-slate-950">{item.articleNameSnapshot}</h2>
                        <p className="mt-1 text-xs text-slate-500">Barcode {item.barcodeSnapshot}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Bestellmenge</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{formatQuantity(item.quantity)}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Vorschlag</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{formatQuantity(item.suggestedQuantity)}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Bestand beim Erfassen</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{formatQuantity(item.currentQuantitySnapshot)}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mindestbestand</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{formatQuantity(item.minimumStockSnapshot)}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Einzelpreis</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">
                          {formatCurrency(item.unitPriceCentsSnapshot, "Kein Preis")}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Positionssumme</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">
                          {item.unitPriceCentsSnapshot !== null
                            ? formatCurrency(item.unitPriceCentsSnapshot * item.quantity, "0,00 EUR")
                            : "Nicht verfuegbar"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-slate-50/80 px-6 py-10 text-center text-sm text-slate-500">
                Diese Bestellung enthaelt keine Positionen.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
