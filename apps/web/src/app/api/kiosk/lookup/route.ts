import { NextResponse } from "next/server";

import { normalizeBarcode } from "@/lib/barcodes";
import { getKioskContext } from "@/server/auth";
import { prisma } from "@/server/db";
import { apiError } from "@/server/permissions";

export async function GET(request: Request) {
  try {
    const kiosk = await getKioskContext();

    if (!kiosk) {
      return apiError(new Error("Kiosk ist nicht gekoppelt."), 401);
    }

    const { searchParams } = new URL(request.url);
    const barcode = searchParams.get("barcode");

    if (!barcode) {
      throw new Error("Barcode fehlt.");
    }

    const normalizedBarcode = normalizeBarcode(barcode);

    const article = await prisma.article.findFirst({
      where: {
        locationId: kiosk.locationId,
        isArchived: false,
        OR: [
          {
            barcode: normalizedBarcode
          },
          {
            articleBarcodes: {
              some: {
                barcode: normalizedBarcode
              }
            }
          }
        ],
      },
      include: {
        inventoryBalance: true,
        articleBarcodes: {
          orderBy: {
            barcode: "asc"
          }
        }
      }
    });

    if (!article) {
      throw new Error("Kein Artikel mit diesem Barcode am Standort gefunden.");
    }

    return NextResponse.json({
      article: {
        id: article.id,
        name: article.name,
        barcode: article.barcode,
        additionalBarcodes: article.articleBarcodes.map((entry) => entry.barcode),
        description: article.description,
        category: article.category,
        minimumStock: article.minimumStock,
        quantity: article.inventoryBalance?.quantity ?? 0
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
