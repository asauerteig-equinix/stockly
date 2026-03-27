import { NextResponse } from "next/server";

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
        location: true
      },
      orderBy: {
        name: "asc"
      }
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

    const article = await prisma.article.create({
      data: {
        locationId: body.locationId,
        name: body.name,
        barcode: body.barcode,
        description: body.description ?? null,
        manufacturerNumber: body.manufacturerNumber ?? null,
        supplierNumber: body.supplierNumber ?? null,
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
