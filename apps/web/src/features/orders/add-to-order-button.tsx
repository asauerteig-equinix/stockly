"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";

type AddToOrderButtonProps = {
  locationId: string;
  articleIds: string[];
  label?: string;
  redirectToOrders?: boolean;
} & Omit<ButtonProps, "onClick">;

export function AddToOrderButton({
  locationId,
  articleIds,
  label = "Zur Bestellung",
  redirectToOrders = false,
  variant = "outline",
  size = "sm",
  ...props
}: AddToOrderButtonProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <Button
        variant={variant}
        size={size}
        disabled={isPending || articleIds.length === 0}
        onClick={() => {
          setFeedback("");
          startTransition(async () => {
            try {
              await fetchJson("/api/purchase-orders/draft-items", {
                method: "POST",
                body: JSON.stringify({
                  locationId,
                  articleIds,
                  mode: articleIds.length > 1 ? "low-stock" : "single"
                })
              });
              setFeedback(articleIds.length > 1 ? "Artikel wurden uebernommen." : "Artikel wurde uebernommen.");

              if (redirectToOrders) {
                router.push("/admin/orders");
                return;
              }

              router.refresh();
            } catch (error) {
              setFeedback(error instanceof Error ? error.message : "Artikel konnte nicht uebernommen werden.");
            }
          });
        }}
        {...props}
      >
        <Plus className="mr-2 h-4 w-4" />
        {isPending ? "Laeuft..." : label}
      </Button>
      {feedback ? <p className="text-xs text-slate-500">{feedback}</p> : null}
    </div>
  );
}
