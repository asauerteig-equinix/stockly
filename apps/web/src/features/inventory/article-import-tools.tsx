"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { articleImportTemplateHeaders } from "@/lib/article-import-template";
import { withBasePath } from "@/lib/base-path";

function downloadTemplate() {
  const csvContent = `${articleImportTemplateHeaders.join(";")}\n`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stockly-article-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ArticleImportTools() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string | null }>({
    tone: "success",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  function handleImport() {
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setFeedback({ tone: "error", message: "Bitte zuerst eine Importdatei auswaehlen." });
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("file", file);

        const response = await fetch(withBasePath("/api/articles/import"), {
          method: "POST",
          body: formData
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? "Import fehlgeschlagen.");
        }

        setFeedback({ tone: "success", message: payload.message ?? "Import abgeschlossen." });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Import fehlgeschlagen."
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-950">Artikel importieren</h3>
        <p className="text-sm text-slate-500">
          Neue oder geaenderte Artikel koennen gesammelt aus `xlsx`, `xls` oder `csv` uebernommen werden.
        </p>
      </div>

      <FormFeedback message={feedback.message} tone={feedback.tone} />

      <div className="space-y-2">
        <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" />
        <p className="text-xs text-slate-500">
          Pflichtfelder: Standort Code oder Standort, Kategorie, Artikelname und Barcode.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleImport} disabled={isPending}>
          <FileUp className="mr-2 h-4 w-4" />
          {isPending ? "Importiert..." : "Import starten"}
        </Button>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Vorlage laden
        </Button>
      </div>
    </div>
  );
}
