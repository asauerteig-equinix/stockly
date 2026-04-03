"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Images, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { articlePlaceholderImage } from "@/lib/article-images";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/cn";

type ArticleImageOption = {
  fileName: string;
  name: string;
  url: string;
};

type ArticleImagePickerModalProps = {
  open: boolean;
  onClose: () => void;
  images: ArticleImageOption[];
  selectedImageUrl: string | null | undefined;
  onSelect: (imageUrl: string) => void;
  onOpenLibrary: () => void;
};

function getImageSrc(imageUrl: string) {
  return withBasePath(imageUrl || articlePlaceholderImage);
}

export function ArticleImagePickerModal({
  open,
  onClose,
  images,
  selectedImageUrl,
  onSelect,
  onOpenLibrary
}: ArticleImagePickerModalProps) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const filteredImages = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return images.filter((image) => {
      if (!needle) {
        return true;
      }

      return `${image.name} ${image.fileName}`.toLowerCase().includes(needle);
    });
  }, [images, search]);

  const hasExternalSelection =
    !!selectedImageUrl &&
    selectedImageUrl !== articlePlaceholderImage &&
    !images.some((image) => image.url === selectedImageUrl);

  const previewOptions = hasExternalSelection
    ? [
        {
          fileName: "external-image",
          name: "Aktuelle externe Bild-URL",
          url: selectedImageUrl
        },
        ...filteredImages
      ]
    : filteredImages;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Artikelbild waehlen"
      description="Bilder werden zentral aus der Bibliothek verwendet. Ein Klick uebernimmt das Bild direkt fuer den Artikel."
      className="max-w-5xl"
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Bild nach Name oder Datei filtern"
              className="pl-9"
            />
          </div>
          <Button type="button" variant="outline" onClick={onOpenLibrary}>
            <Images className="mr-2 h-4 w-4" />
            Bildbibliothek verwalten
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            className={cn(
              "rounded-2xl border p-4 text-left transition",
              selectedImageUrl === articlePlaceholderImage
                ? "border-primary bg-primary/5"
                : "border-border bg-slate-50/80 hover:border-slate-300 hover:bg-white"
            )}
            onClick={() => {
              onSelect(articlePlaceholderImage);
              onClose();
            }}
          >
            <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              Platzhalter
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-950">Kein eigenes Bild</p>
                <p className="text-xs text-slate-500">Standardbild in allen Ansichten verwenden</p>
              </div>
              {selectedImageUrl === articlePlaceholderImage ? <Check className="h-4 w-4 text-primary" /> : null}
            </div>
          </button>

          {previewOptions.map((image) => {
            const isSelected = selectedImageUrl === image.url;
            const isExternal = image.fileName === "external-image";

            return (
              <button
                key={`${image.fileName}-${image.url}`}
                type="button"
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  isSelected ? "border-primary bg-primary/5" : "border-border bg-slate-50/80 hover:border-slate-300 hover:bg-white"
                )}
                onClick={() => {
                  onSelect(image.url);
                  onClose();
                }}
              >
                <img
                  src={getImageSrc(image.url)}
                  alt={image.name}
                  className="h-36 w-full rounded-2xl border border-white bg-white object-cover"
                />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950" title={image.name}>
                      {image.name}
                    </p>
                    <p className="truncate text-xs text-slate-500" title={image.fileName}>
                      {isExternal ? "Externe Bild-URL" : image.fileName}
                    </p>
                  </div>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : isExternal ? (
                    <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {!previewOptions.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-slate-50/80 px-6 py-10 text-center text-sm text-slate-500">
            Fuer den aktuellen Filter wurden keine Bilder gefunden.
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
