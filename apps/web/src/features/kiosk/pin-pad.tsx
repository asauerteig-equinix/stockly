"use client";

import { Delete } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type PinPadProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  maxLength?: number;
  className?: string;
};

const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "delete"] as const;

export function PinPad({
  label,
  value,
  onChange,
  description,
  maxLength = 20,
  className
}: PinPadProps) {
  function handleKey(key: (typeof digits)[number]) {
    if (key === "clear") {
      onChange("");
      return;
    }

    if (key === "delete") {
      onChange(value.slice(0, -1));
      return;
    }

    if (value.length >= maxLength) {
      return;
    }

    onChange(`${value}${key}`);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-sm text-slate-400">{description}</p> : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-4 text-center text-3xl font-semibold tracking-[0.35em] text-white">
        {value || "----"}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {digits.map((key) => {
          if (key === "clear") {
            return (
              <Button
                key={key}
                type="button"
                variant="outline"
                className="h-16 border-white/10 bg-slate-950/70 text-base text-white hover:bg-white/5"
                onClick={() => handleKey(key)}
              >
                Leeren
              </Button>
            );
          }

          if (key === "delete") {
            return (
              <Button
                key={key}
                type="button"
                variant="outline"
                className="h-16 border-white/10 bg-slate-950/70 text-white hover:bg-white/5"
                onClick={() => handleKey(key)}
              >
                <Delete className="h-5 w-5" />
              </Button>
            );
          }

          return (
            <Button
              key={key}
              type="button"
              variant="outline"
              className="h-16 border-white/10 bg-slate-950/70 text-2xl font-semibold text-white hover:bg-white/5"
              onClick={() => handleKey(key)}
            >
              {key}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
