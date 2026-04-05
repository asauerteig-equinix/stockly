import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { apiError, assertMasterAdmin } from "@/server/permissions";

const resetArticlesSchema = z.object({
  confirmation: z.literal("ARTIKEL RESET")
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    assertMasterAdmin(user);
    resetArticlesSchema.parse(await request.json());

    const summary = await prisma.$transaction(async (tx) => {
      const [articleCount, movementCount, orderCount] = await Promise.all([
        tx.article.count(),
        tx.stockMovement.count(),
        tx.purchaseOrder.count()
      ]);

      await tx.purchaseOrder.deleteMany({});
      await tx.stockMovement.deleteMany({});
      await tx.inventoryBalance.deleteMany({});
      await tx.articleBarcode.deleteMany({});
      await tx.article.deleteMany({});

      return {
        articleCount,
        movementCount,
        orderCount
      };
    });

    return NextResponse.json({
      ok: true,
      message: `${summary.articleCount} Artikel, ${summary.movementCount} Bewegungen und ${summary.orderCount} Bestellungen wurden entfernt.`
    });
  } catch (error) {
    return apiError(error);
  }
}
