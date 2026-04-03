"use client";

import { useState } from "react";
import { Copy, Mail } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type OrderEmailPreviewProps = {
  body: string;
  mailtoHref: string;
  subject: string;
};

export function OrderEmailPreview({ body, mailtoHref, subject }: OrderEmailPreviewProps) {
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; message: string | null }>({
    tone: "info",
    message: null
  });

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({
        tone: "success",
        message: `${label} wurde in die Zwischenablage kopiert.`
      });
    } catch {
      setFeedback({
        tone: "error",
        message: `${label} konnte nicht kopiert werden.`
      });
    }
  }

  return (
    <div className="space-y-6">
      <FormFeedback message={feedback.message} tone={feedback.tone} />

      <Card className="border-white/80 bg-white/95">
        <CardHeader className="gap-3">
          <CardTitle>E-Mail-Vorschau</CardTitle>
          <CardDescription>
            Die Bestellung wird als Text vorbereitet. Du kannst die Vorschau kopieren oder direkt im lokalen Mail-Programm oeffnen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900" htmlFor="order-email-subject">
              Betreff
            </label>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <Input id="order-email-subject" value={subject} readOnly />
              <Button variant="outline" onClick={() => copyText("Der Betreff", subject)}>
                <Copy className="mr-2 h-4 w-4" />
                Betreff kopieren
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900" htmlFor="order-email-body">
              Nachricht
            </label>
            <Textarea id="order-email-body" value={body} readOnly className="min-h-[24rem] font-mono text-sm" />
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => copyText("Die Nachricht", body)}>
                <Copy className="mr-2 h-4 w-4" />
                Nachricht kopieren
              </Button>
              <a href={mailtoHref} className={buttonVariants({ variant: "default" })}>
                <Mail className="mr-2 h-4 w-4" />
                Mail-App oeffnen
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
