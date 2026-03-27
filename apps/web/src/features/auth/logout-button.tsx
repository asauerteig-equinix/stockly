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
      className="w-full border-slate-800 bg-transparent text-slate-200 hover:bg-slate-900 hover:text-white"
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
