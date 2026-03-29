"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import { fetchJson } from "@/lib/fetch-json";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      className="w-full justify-start border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await fetchJson("/api/auth/logout", { method: "POST" });
          window.location.assign(withBasePath("/login"));
        })
      }
    >
      {isPending ? "Abmeldung..." : "Abmelden"}
    </Button>
  );
}
