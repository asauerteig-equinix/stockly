import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { articlePlaceholderImage } from "@/lib/article-images";
import { articleImportTemplateHeaders } from "@/lib/article-import-template";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { apiError } from "@/server/permissions";

function createTimestamp() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toTimeString().slice(0, 5).replace(":", "");
  return `${datePart}-${timePart}`;
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const articles = await prisma.article.findMany({
      where:
        user.role === "MASTER_ADMIN"
          ? undefined
          : {
              locationId: {
                in: user.assignedLocationIds
              }
            },
      include: {
        location: true,
        articleBarcodes: {
          orderBy: {
            barcode: "asc"
          }
        }
      },
      orderBy: [{ location: { name: "asc" } }, { category: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    });

    const rows = articles.map((article) => ({
      "Standort Code": article.location.code,
      Standort: article.location.name,
      Kategorie: article.category,
      Reihenfolge: article.sortOrder,
      Artikelname: article.name,
      Barcode: article.barcode,
      "Weitere Barcodes": article.articleBarcodes.map((entry) => entry.barcode).join("\n"),
      Beschreibung: article.description ?? "",
      Herstellernummer: article.manufacturerNumber ?? "",
      Lieferantennummer: article.supplierNumber ?? "",
      "Preis EUR": article.unitPriceCents !== null && article.unitPriceCents !== undefined ? article.unitPriceCents / 100 : "",
      Mindestbestand: article.minimumStock,
      Aktiv: article.isArchived ? "nein" : "ja",
      "Bild URL": article.imageUrl && article.imageUrl !== articlePlaceholderImage ? article.imageUrl : ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...articleImportTemplateHeaders]
    });
    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 20 },
      { wch: 12 },
      { wch: 36 },
      { wch: 20 },
      { wch: 28 },
      { wch: 36 },
      { wch: 22 },
      { wch: 22 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 32 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Artikel");
    const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const fileName = `stockly-articles-export-${createTimestamp()}.xlsx`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
