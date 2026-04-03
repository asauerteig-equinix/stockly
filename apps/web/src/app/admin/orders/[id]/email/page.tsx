import Link from "next/link";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/layout/page-intro";
import { buttonVariants } from "@/components/ui/button";
import { OrderEmailPreview } from "@/features/orders/order-email-preview";
import { type OrderEmailPayload } from "@/lib/order-email";
import { requireUser } from "@/server/auth";
import { getPurchaseOrderForUser } from "@/server/order-documents";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderEmailPreviewPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const order = await getPurchaseOrderForUser(id, user);

  if (!order) {
    notFound();
  }

  const emailOrder: OrderEmailPayload = {
    orderNumber: order.orderNumber,
    items: order.items.map((item) => ({
      articleName: item.articleNameSnapshot,
      productName: item.articleNameSnapshot,
      productNumber: item.manufacturerNumberSnapshot ?? "",
      supplierProductNumber: item.supplierNumberSnapshot ?? "",
      quantity: item.quantity
    }))
  };

  return (
    <div className="space-y-8">
      <PageIntro
        title={`E-Mail ${order.orderNumber}`}
        description="Vorgefertigte Angebotsanfrage mit Sprach- und Firmenumschaltung."
      />

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/orders" className={buttonVariants({ variant: "outline" })}>
          Zurueck zu Bestellungen
        </Link>
      </div>

      <OrderEmailPreview order={emailOrder} currentDateIso={new Date().toISOString()} />
    </div>
  );
}
