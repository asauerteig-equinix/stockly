"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      className="w-full justify-start border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await fetchJson("/api/auth/logout", { method: "POST" });
          router.push("/login");
          router.refresh();
        })
      }
    >
      {isPending ? "Abmeldung..." : "Abmelden"}
    </Button>
  );
}
