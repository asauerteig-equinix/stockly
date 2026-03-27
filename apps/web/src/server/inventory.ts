import { MovementType, SourceType } from "@prisma/client";

import { prisma } from "@/server/db";

type RecordMovementInput = {
  locationId: string;
  articleId: string;
  type: MovementType;
  quantity: number;
  sourceType: SourceType;
  note?: string | null;
  usageReason?: string | null;
  createdByUserId?: string | null;
};

export async function recordStockMovement(input: RecordMovementInput) {
  if (input.quantity === 0) {
    throw new Error("Menge darf nicht 0 sein.");
  }

  return prisma.$transaction(async (tx) => {
    const article = await tx.article.findUnique({
      where: { id: input.articleId },
      include: {
        location: {
          include: {
            settings: true
          }
        }
      }
    });

    if (!article || article.locationId !== input.locationId) {
      throw new Error("Artikel wurde am Standort nicht gefunden.");
    }

    if (article.isArchived) {
      throw new Error("Archivierte Artikel koennen nicht gebucht werden.");
    }

    const existingBalance = await tx.inventoryBalance.findUnique({
      where: { articleId: input.articleId }
    });

    const currentQuantity = existingBalance?.quantity ?? 0;
    const allowNegativeStock = article.location.settings?.allowNegativeStock ?? false;

    const delta =
      input.type === MovementType.TAKE ? -Math.abs(input.quantity) : input.type === MovementType.CORRECTION ? input.quantity : Math.abs(input.quantity);

    const nextQuantity = currentQuantity + delta;

    if (!allowNegativeStock && nextQuantity < 0) {
      throw new Error("Bestand waere negativ. Buchung wurde verhindert.");
    }

    const movement = await tx.stockMovement.create({
      data: {
        locationId: input.locationId,
        articleId: input.articleId,
        type: input.type,
        quantity: input.type === MovementType.CORRECTION ? input.quantity : Math.abs(input.quantity),
        sourceType: input.sourceType,
        usageReason: input.usageReason ?? null,
        note: input.note ?? null,
        createdByUserId: input.createdByUserId ?? null
      }
    });

    const balance = await tx.inventoryBalance.upsert({
      where: {
        articleId: input.articleId
      },
      create: {
        articleId: input.articleId,
        locationId: input.locationId,
        quantity: nextQuantity,
        lastMovementAt: movement.createdAt
      },
      update: {
        quantity: nextQuantity,
        lastMovementAt: movement.createdAt
      }
    });

    return {
      movement,
      balance
    };
  });
}
