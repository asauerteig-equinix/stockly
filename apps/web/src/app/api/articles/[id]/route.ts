import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertLocationAccess, apiError } from "@/server/permissions";

const updateArticleSchema = z.object({
  locationId: z.string().optional(),
  name: z.string().min(2).optional(),
  barcode: z.string().min(3).optional(),
  description: z.string().max(500).optional().nullable(),
  manufacturerNumber: z.string().max(120).optional().nullable(),
  supplierNumber: z.string().max(120).optional().nullable(),
  category: z.string().min(2).optional(),
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
      where: { id }
    });

    if (!existingArticle) {
      throw new Error("Artikel nicht gefunden.");
    }

    assertLocationAccess(user, existingArticle.locationId);
    if (body.locationId) {
      assertLocationAccess(user, body.locationId);
    }

    const article = await prisma.article.update({
      where: { id },
      data: {
        locationId: body.locationId,
        name: body.name,
        barcode: body.barcode,
        description: body.description,
        manufacturerNumber: body.manufacturerNumber,
        supplierNumber: body.supplierNumber,
        category: body.category,
        minimumStock: body.minimumStock,
        isArchived: body.isArchived
      }
    });

    return NextResponse.json({ article });
  } catch (error) {
    return apiError(error);
  }
}
