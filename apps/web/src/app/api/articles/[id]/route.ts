import { NextResponse } from "next/server";
import { z } from "zod";

import { articlePlaceholderImage } from "@/lib/article-images";
import { normalizeBarcode, sanitizeAdditionalBarcodes } from "@/lib/barcodes";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertLocationAccess, apiError } from "@/server/permissions";

const updateArticleSchema = z.object({
  locationId: z.string().optional(),
  name: z.string().min(2).optional(),
  barcode: z.string().min(3).optional(),
  additionalBarcodes: z.array(z.string().min(3)).optional(),
  imageUrl: z.string().max(500).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  manufacturerNumber: z.string().max(120).optional().nullable(),
  supplierNumber: z.string().max(120).optional().nullable(),
  unitPriceCents: z.coerce.number().int().min(0).optional().nullable(),
  category: z.string().min(2).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  minimumStock: z.coerce.number().int().min(0).optional(),
  isArchived: z.boolean().optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const { id } = await params;
    const body = updateArticleSchema.parse(await request.json());
    const existingArticle = await prisma.article.findUnique({
      where: { id },
      include: {
        articleBarcodes: {
          orderBy: {
            barcode: "asc"
          }
        }
      }
    });

    if (!existingArticle) {
      throw new Error("Artikel nicht gefunden.");
    }

    assertLocationAccess(user, existingArticle.locationId);
    if (body.locationId) {
      assertLocationAccess(user, body.locationId);
    }

    const nextLocationId = body.locationId ?? existingArticle.locationId;
    const nextPrimaryBarcode = normalizeBarcode(body.barcode ?? existingArticle.barcode);
    const nextAdditionalBarcodes =
      body.additionalBarcodes !== undefined
        ? sanitizeAdditionalBarcodes(body.additionalBarcodes, nextPrimaryBarcode)
        : sanitizeAdditionalBarcodes(
            existingArticle.articleBarcodes.map((entry) => entry.barcode),
            nextPrimaryBarcode
          );

    const article = await prisma.$transaction(async (tx) => {
      await tx.article.update({
        where: { id },
        data: {
          locationId: body.locationId,
          name: body.name,
          barcode: body.barcode !== undefined ? nextPrimaryBarcode : undefined,
          description: body.description,
          manufacturerNumber: body.manufacturerNumber,
          supplierNumber: body.supplierNumber,
          unitPriceCents: body.unitPriceCents,
          category: body.category,
          imageUrl: body.imageUrl !== undefined ? body.imageUrl || articlePlaceholderImage : undefined,
          sortOrder: body.sortOrder,
          minimumStock: body.minimumStock,
          isArchived: body.isArchived
        }
      });

      if (body.additionalBarcodes !== undefined || body.locationId !== undefined || body.barcode !== undefined) {
        await tx.articleBarcode.deleteMany({
          where: {
            articleId: id
          }
        });

        if (nextAdditionalBarcodes.length) {
          await tx.articleBarcode.createMany({
            data: nextAdditionalBarcodes.map((barcode) => ({
              articleId: id,
              locationId: nextLocationId,
              barcode
            }))
          });
        }
      }

      return tx.article.findUniqueOrThrow({
        where: { id },
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

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const { id } = await params;
    const existingArticle = await prisma.article.findUnique({
      where: { id },
      include: {
        inventoryBalance: true,
        articleBarcodes: true,
        stockMovements: {
          take: 1,
          select: {
            id: true
          }
        },
        purchaseOrderItems: {
          take: 1,
          select: {
            id: true
          }
        }
      }
    });

    if (!existingArticle) {
      throw new Error("Artikel nicht gefunden.");
    }

    assertLocationAccess(user, existingArticle.locationId);

    if ((existingArticle.inventoryBalance?.quantity ?? 0) !== 0 || existingArticle.stockMovements.length || existingArticle.purchaseOrderItems.length) {
      throw new Error("Artikel hat bereits Bestand oder Historie. Bitte stattdessen archivieren.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.articleBarcode.deleteMany({
        where: {
          articleId: id
        }
      });

      await tx.article.delete({
        where: { id }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
