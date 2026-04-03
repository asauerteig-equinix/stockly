import { NextResponse } from "next/server";

import { articlePlaceholderImage } from "@/lib/article-images";
import { normalizeBarcode, sanitizeAdditionalBarcodes } from "@/lib/barcodes";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertLocationAccess, apiError } from "@/server/permissions";
import { articleSchema } from "@/server/validation";

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
        inventoryBalance: true,
        location: true,
        articleBarcodes: {
          orderBy: {
            barcode: "asc"
          }
        }
      },
      orderBy: [{ isArchived: "asc" }, { category: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    });

    return NextResponse.json({ articles });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const body = articleSchema.parse(await request.json());
    assertLocationAccess(user, body.locationId);

    const primaryBarcode = normalizeBarcode(body.barcode);
    const additionalBarcodes = sanitizeAdditionalBarcodes(body.additionalBarcodes ?? [], primaryBarcode);

    const article = await prisma.$transaction(async (tx) => {
      const createdArticle = await tx.article.create({
        data: {
          locationId: body.locationId,
          name: body.name,
          barcode: primaryBarcode,
          description: body.description ?? null,
          manufacturerNumber: body.manufacturerNumber ?? null,
          supplierNumber: body.supplierNumber ?? null,
          category: body.category,
          imageUrl: body.imageUrl || articlePlaceholderImage,
          sortOrder: body.sortOrder,
          minimumStock: body.minimumStock,
          isArchived: body.isArchived
        }
      });

      if (additionalBarcodes.length) {
        await tx.articleBarcode.createMany({
          data: additionalBarcodes.map((barcode) => ({
            articleId: createdArticle.id,
            locationId: body.locationId,
            barcode
          }))
        });
      }

      return tx.article.findUniqueOrThrow({
        where: {
          id: createdArticle.id
        },
        include: {
          articleBarcodes: {
            orderBy: {
              barcode: "asc"
            }
          }
        }
      });
    });

    return NextResponse.json({ article });
  } catch (error) {
    return apiError(error);
  }
}
