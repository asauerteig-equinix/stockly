"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileDown, Mail, Trash2 } from "lucide-react";

import { buttonVariants, Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { withBasePath } from "@/lib/base-path";
import { fetchJson } from "@/lib/fetch-json";

type OrderDetailActionsProps = {
  orderId: string;
  orderNumber: string;
  emailHref: string;
  pdfHref: string;
};

export function OrderDetailActions({ orderId, orderNumber, emailHref, pdfHref }: OrderDetailActionsProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; message: string | null }>({
    tone: "info",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Bestellung ${orderNumber} wirklich loeschen?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await fetchJson(`/api/purchase-orders/${orderId}`, {
          method: "DELETE"
        });
        router.push("/admin/orders");
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Bestellung konnte nicht geloescht werden."
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/orders" className={buttonVariants({ variant: "outline" })}>
          Zurueck zu Bestellungen
        </Link>
        <Link href={emailHref} className={buttonVariants({ variant: "outline" })}>
          <Mail className="mr-2 h-4 w-4" />
          E-Mail-Vorschau
        </Link>
        <a
          href={withBasePath(pdfHref)}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          <FileDown className="mr-2 h-4 w-4" />
          PDF oeffnen
        </a>
        <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          {isPending ? "Loescht..." : "Bestellung loeschen"}
        </Button>
      </div>

      <FormFeedback message={feedback.message} tone={feedback.tone} />
    </div>
  );
}
