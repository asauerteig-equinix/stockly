"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

import { Button } from "./button";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerActions?: React.ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  contentClassName,
  headerActions
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "w-full max-w-3xl rounded-[1.75rem] border border-white/80 bg-white/95 shadow-2xl",
          className
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
            {description ? <p className="text-sm text-slate-500">{description}</p> : null}
          </div>

          <div className="flex items-start gap-2">
            {headerActions}
            <Button type="button" variant="ghost" className="h-10 w-10 p-0" onClick={onClose} aria-label="Modal schliessen">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className={cn("max-h-[min(82vh,60rem)] overflow-auto px-6 py-5", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
