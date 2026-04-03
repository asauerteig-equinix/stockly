import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import { formatCurrency } from "@/lib/currency";
import { type AuthUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { formatDateTime, formatQuantity } from "@/server/format";
import { assertLocationAccess } from "@/server/permissions";

export async function getPurchaseOrderForUser(orderId: string, user: AuthUser) {
  const order = await prisma.purchaseOrder.findUnique({
    where: {
      id: orderId
    },
    include: {
      location: true,
      createdByUser: true,
      updatedByUser: true,
      items: {
        orderBy: [{ categorySnapshot: "asc" }, { articleNameSnapshot: "asc" }]
      }
    }
  });

  if (!order) {
    return null;
  }

  assertLocationAccess(user, order.locationId);
  return order;
}

export type PurchaseOrderDocument = NonNullable<Awaited<ReturnType<typeof getPurchaseOrderForUser>>>;

export function buildPurchaseOrderEmailPreview(order: PurchaseOrderDocument) {
  const subject = `Nachbestellung ${order.location.code} - ${order.orderNumber}`;
  const lines = [
    "Guten Tag,",
    "",
    `bitte folgende Artikel fuer den Standort ${order.location.name} (${order.location.code}) bereitstellen:`,
    "",
    ...order.items.flatMap((item, index) => {
      const itemLines = [
        `${index + 1}. ${item.articleNameSnapshot} (${item.categorySnapshot})`,
        `   Menge: ${formatQuantity(item.quantity)}`,
        `   Barcode: ${item.barcodeSnapshot}`,
        item.supplierNumberSnapshot ? `   Lieferantennummer: ${item.supplierNumberSnapshot}` : null,
        item.manufacturerNumberSnapshot ? `   Herstellernummer: ${item.manufacturerNumberSnapshot}` : null,
        `   Bestand bei Erfassung: ${formatQuantity(item.currentQuantitySnapshot)} | Mindestbestand: ${formatQuantity(item.minimumStockSnapshot)}`,
        ""
      ];

      return itemLines.filter((line): line is string => Boolean(line));
    }),
    order.note ? `Notiz: ${order.note}` : null,
    "",
    `Bestellung: ${order.orderNumber}`,
    `Standort: ${order.location.name} (${order.location.code})`,
    `Erstellt von: ${order.createdByUser.name} <${order.createdByUser.email}>`,
    `Erstellt am: ${formatDateTime(order.createdAt)}`,
    order.submittedAt ? `Abgeschlossen am: ${formatDateTime(order.submittedAt)}` : null,
    "",
    "Viele Gruesse"
  ].filter((line): line is string => line !== null);

  const body = lines.join("\n");

  return {
    subject,
    body,
    mailtoHref: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  };
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  if (!text.trim()) {
    return [""];
  }

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (font.widthOfTextAtSize(nextLine, fontSize) <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    let segment = "";

    for (const character of word) {
      const nextSegment = `${segment}${character}`;

      if (font.widthOfTextAtSize(nextSegment, fontSize) <= maxWidth) {
        segment = nextSegment;
        continue;
      }

      if (segment) {
        lines.push(segment);
      }

      segment = character;
    }

    currentLine = segment;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export async function buildPurchaseOrderPdf(order: PurchaseOrderDocument) {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize = { width: 595.28, height: 841.89 };
  const margin = 48;
  const totalOrderAmountCents = order.items.reduce(
    (sum, item) => sum + (item.unitPriceCentsSnapshot ?? 0) * item.quantity,
    0
  );
  const itemsWithoutPrice = order.items.filter((item) => item.unitPriceCentsSnapshot === null).length;
  let page = pdf.addPage([pageSize.width, pageSize.height]);
  let y = pageSize.height - margin;

  function addPage() {
    page = pdf.addPage([pageSize.width, pageSize.height]);
    y = pageSize.height - margin;
  }

  function ensureSpace(requiredHeight: number) {
    if (y - requiredHeight < margin) {
      addPage();
    }
  }

  function drawTextBlock(text: string, options?: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> }) {
    const font = options?.font ?? regularFont;
    const size = options?.size ?? 11;
    const color = options?.color ?? rgb(0.15, 0.18, 0.22);
    const lineHeight = size + 4;
    const lines = wrapText(text, font, size, pageSize.width - margin * 2);
    ensureSpace(lines.length * lineHeight);

    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y,
        size,
        font,
        color
      });
      y -= lineHeight;
    }
  }

  function spacer(height = 8) {
    ensureSpace(height);
    y -= height;
  }

  drawTextBlock(`Bestellung ${order.orderNumber}`, {
    font: boldFont,
    size: 20,
    color: rgb(0.08, 0.16, 0.33)
  });
  drawTextBlock(`Standort ${order.location.name} (${order.location.code})`, {
    size: 12
  });
  spacer(12);

  const metaLines = [
    `Status: ${order.status === "DRAFT" ? "Entwurf" : "Bestellt"}`,
    `Erstellt von: ${order.createdByUser.name} <${order.createdByUser.email}>`,
    `Erstellt am: ${formatDateTime(order.createdAt)}`,
    `Zuletzt aktualisiert: ${formatDateTime(order.updatedAt)}`,
    `Abgeschlossen am: ${formatDateTime(order.submittedAt)}`,
    `Positionen: ${formatQuantity(order.items.length)}`,
    `Gesamtsumme: ${formatCurrency(totalOrderAmountCents, "0,00 EUR")}`,
    itemsWithoutPrice ? `Positionen ohne Preis: ${formatQuantity(itemsWithoutPrice)}` : null
  ].filter((line): line is string => Boolean(line));

  for (const line of metaLines) {
    drawTextBlock(line);
  }

  if (order.note) {
    spacer(8);
    drawTextBlock("Notiz", {
      font: boldFont,
      size: 13
    });
    drawTextBlock(order.note);
  }

  spacer(12);
  drawTextBlock("Positionen", {
    font: boldFont,
    size: 15
  });
  spacer(4);

  order.items.forEach((item, index) => {
    drawTextBlock(`${index + 1}. ${item.articleNameSnapshot}`, {
      font: boldFont,
      size: 13
    });
    drawTextBlock(`Kategorie: ${item.categorySnapshot}`);
    drawTextBlock(`Barcode: ${item.barcodeSnapshot}`);
    drawTextBlock(
      `Bestellmenge: ${formatQuantity(item.quantity)} | Vorschlag: ${formatQuantity(item.suggestedQuantity)} | Bestand bei Erfassung: ${formatQuantity(item.currentQuantitySnapshot)} | Mindestbestand: ${formatQuantity(item.minimumStockSnapshot)}`
    );
    drawTextBlock(
      `Einzelpreis: ${formatCurrency(item.unitPriceCentsSnapshot, "Kein Preis")} | Positionssumme: ${
        item.unitPriceCentsSnapshot !== null
          ? formatCurrency(item.unitPriceCentsSnapshot * item.quantity, "0,00 EUR")
          : "Nicht verfuegbar"
      }`
    );

    if (item.supplierNumberSnapshot || item.manufacturerNumberSnapshot) {
      const referenceParts = [
        item.supplierNumberSnapshot ? `Lieferantennummer: ${item.supplierNumberSnapshot}` : null,
        item.manufacturerNumberSnapshot ? `Herstellernummer: ${item.manufacturerNumberSnapshot}` : null
      ].filter((value): value is string => Boolean(value));

      drawTextBlock(referenceParts.join(" | "));
    }

    spacer(10);
  });

  return pdf.save();
}
