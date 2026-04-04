"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { withBasePath } from "@/lib/base-path";
import { fetchJson } from "@/lib/fetch-json";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      className={cn(
        "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950",
        compact ? "h-11 w-11 p-0" : "w-full justify-start"
      )}
      disabled={isPending}
      aria-label="Abmelden"
      onClick={() =>
        startTransition(async () => {
          await fetchJson("/api/auth/logout", { method: "POST" });
          window.location.assign(withBasePath("/login"));
        })
      }
    >
      <LogOut className={cn("h-4 w-4", compact ? "" : "mr-2")} />
      {compact ? null : isPending ? "Abmeldung..." : "Abmelden"}
    </Button>
  );
}
