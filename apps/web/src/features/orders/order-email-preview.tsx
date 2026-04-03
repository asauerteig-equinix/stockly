"use client";

import { useMemo, useState } from "react";
import { Copy, Mail } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  buildOrderEmail,
  orderEmailCompanies,
  type OrderEmailCompanyKey,
  type OrderEmailLanguage,
  type OrderEmailPayload
} from "@/lib/order-email";

type OrderEmailPreviewProps = {
  currentDateIso: string;
  order: OrderEmailPayload;
};

export function OrderEmailPreview({ currentDateIso, order }: OrderEmailPreviewProps) {
  const [language, setLanguage] = useState<OrderEmailLanguage>("de");
  const [company, setCompany] = useState<OrderEmailCompanyKey>("equinix_germany_gmbh");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; message: string | null }>({
    tone: "info",
    message: null
  });

  const email = useMemo(() => {
    return buildOrderEmail(order, {
      language,
      company,
      currentDate: new Date(currentDateIso)
    });
  }, [company, currentDateIso, language, order]);

  const mailtoHref = useMemo(() => {
    return `mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  }, [email.body, email.subject]);

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
            Angebotsanfrage mit Umschaltern fuer Sprache und Firmenentitaet. Du kannst die Vorlage kopieren oder direkt im lokalen Mail-Programm oeffnen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">Sprache</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={language === "de" ? "default" : "outline"} onClick={() => setLanguage("de")}>
                  Deutsch
                </Button>
                <Button type="button" size="sm" variant={language === "en" ? "default" : "outline"} onClick={() => setLanguage("en")}>
                  English
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">Firmenentitaet</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(orderEmailCompanies) as [OrderEmailCompanyKey, (typeof orderEmailCompanies)[OrderEmailCompanyKey]][]).map(
                  ([key, value]) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={company === key ? "default" : "outline"}
                      onClick={() => setCompany(key)}
                    >
                      {value.label}
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900" htmlFor="order-email-subject">
              Betreff
            </label>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <Input id="order-email-subject" value={email.subject} readOnly />
              <Button variant="outline" onClick={() => copyText("Der Betreff", email.subject)}>
                <Copy className="mr-2 h-4 w-4" />
                Betreff kopieren
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900" htmlFor="order-email-body">
              Nachricht
            </label>
            <Textarea id="order-email-body" value={email.body} readOnly className="min-h-[24rem] font-mono text-sm" />
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => copyText("Die Nachricht", email.body)}>
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
