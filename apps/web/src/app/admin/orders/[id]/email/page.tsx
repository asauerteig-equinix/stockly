import Link from "next/link";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/layout/page-intro";
import { buttonVariants } from "@/components/ui/button";
import { OrderEmailPreview } from "@/features/orders/order-email-preview";
import { requireUser } from "@/server/auth";
import { buildPurchaseOrderEmailPreview, getPurchaseOrderForUser } from "@/server/order-documents";

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

  const preview = buildPurchaseOrderEmailPreview(order);

  return (
    <div className="space-y-8">
      <PageIntro
        title={`E-Mail ${order.orderNumber}`}
        description="Vorschau fuer die Weitergabe der Bestellung per E-Mail oder Mail-Programm."
      />

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/orders" className={buttonVariants({ variant: "outline" })}>
          Zurueck zu Bestellungen
        </Link>
        <Link href={`/admin/orders/${order.id}`} className={buttonVariants({ variant: "outline" })}>
          Zurueck zur Bestellung
        </Link>
      </div>

      <OrderEmailPreview subject={preview.subject} body={preview.body} mailtoHref={preview.mailtoHref} />
    </div>
  );
}
