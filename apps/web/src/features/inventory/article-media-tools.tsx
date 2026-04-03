"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { withBasePath } from "@/lib/base-path";

type ArticleImageOption = {
  fileName: string;
  name: string;
  url: string;
};

export function ArticleMediaTools({ images }: { images: ArticleImageOption[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string | null }>({
    tone: "success",
    message: null
  });
  const [isPending, startTransition] = useTransition();

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setFeedback({ tone: "error", message: "Bitte zuerst ein Bild auswaehlen." });
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("image", file);

        const response = await fetch(withBasePath("/api/article-images"), {
          method: "POST",
          body: formData
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error ?? "Bild konnte nicht hochgeladen werden.");
        }

        setFeedback({ tone: "success", message: "Bild hochgeladen und der Bibliothek hinzugefuegt." });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden."
        });
      }
    });
  }

  function handleDelete(fileName: string) {
    startTransition(async () => {
      try {
        const response = await fetch(withBasePath(`/api/article-images/${encodeURIComponent(fileName)}`), {
          method: "DELETE"
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error ?? "Bild konnte nicht geloescht werden.");
        }

        setFeedback({ tone: "success", message: "Bild wurde aus der Bibliothek entfernt." });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Bild konnte nicht geloescht werden."
        });
      }
    });
  }

  return (
    <Card className="border-white/80 bg-white/95 shadow-sm">
      <CardHeader className="gap-3">
        <CardTitle>Bildbibliothek</CardTitle>
        <CardDescription>
          Hochgeladene Artikelbilder koennen danach in der Artikelpflege, in Bestellungen und spaeter auch im Kiosk verwendet werden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormFeedback message={feedback.message} tone={feedback.tone} />

        <div className="flex flex-wrap gap-3">
          <Input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" />
          <Button onClick={handleUpload} disabled={isPending}>
            <ImagePlus className="mr-2 h-4 w-4" />
            {isPending ? "Laeuft..." : "Bild hochladen"}
          </Button>
        </div>

        {images.length ? (
          <div className="grid max-h-[16rem] gap-3 overflow-auto pr-1 sm:grid-cols-2">
            {images.map((image) => (
              <div key={image.fileName} className="rounded-2xl border border-border bg-slate-50/80 p-3">
                <img
                  src={withBasePath(image.url)}
                  alt={image.name}
                  className="h-28 w-full rounded-xl border border-white bg-white object-cover"
                />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900" title={image.name}>
                      {image.name}
                    </p>
                    <p className="text-xs text-slate-500">{image.fileName}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(image.fileName)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-slate-50/80 px-6 py-8 text-center text-sm text-slate-500">
            Noch keine Bilder in der Bibliothek.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
