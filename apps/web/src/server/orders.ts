import { PurchaseOrderStatus } from "@prisma/client";

import { articlePlaceholderImage } from "@/lib/article-images";
import { generateOrderNumber } from "@/lib/order-number";
import { getSuggestedReorderQuantity } from "@/lib/reorder";
import { prisma } from "@/server/db";

function resolveSuggestedQuantity(article: {
  minimumStock: number;
  inventoryBalance: { quantity: number } | null;
  location: { settings: { lowStockBuffer: number } | null };
}) {
  const currentQuantity = article.inventoryBalance?.quantity ?? 0;
  return getSuggestedReorderQuantity(currentQuantity, article.minimumStock, article.location.settings?.lowStockBuffer ?? 0);
}

function createSnapshot(article: {
  id: string;
  name: string;
  barcode: string;
  category: string;
  imageUrl: string | null;
  minimumStock: number;
  manufacturerNumber: string | null;
  supplierNumber: string | null;
  unitPriceCents: number | null;
  inventoryBalance: { quantity: number } | null;
  location: { settings: { lowStockBuffer: number } | null };
}) {
  return {
    articleId: article.id,
    quantity: resolveSuggestedQuantity(article),
    suggestedQuantity: resolveSuggestedQuantity(article),
    articleNameSnapshot: article.name,
    barcodeSnapshot: article.barcode,
    categorySnapshot: article.category,
    imageUrlSnapshot: article.imageUrl || articlePlaceholderImage,
    currentQuantitySnapshot: article.inventoryBalance?.quantity ?? 0,
    minimumStockSnapshot: article.minimumStock,
    manufacturerNumberSnapshot: article.manufacturerNumber,
    supplierNumberSnapshot: article.supplierNumber,
    unitPriceCentsSnapshot: article.unitPriceCents
  };
}

export async function upsertDraftOrderItems(input: {
  locationId: string;
  articleIds: string[];
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const location = await tx.location.findUnique({
      where: { id: input.locationId },
      include: {
        settings: true
      }
    });

    if (!location) {
      throw new Error("Standort nicht gefunden.");
    }

    const uniqueArticleIds = Array.from(new Set(input.articleIds));
    const articles = await tx.article.findMany({
      where: {
        id: {
          in: uniqueArticleIds
        },
        locationId: input.locationId,
        isArchived: false
      },
      include: {
        inventoryBalance: true,
        location: {
          include: {
            settings: true
          }
        }
      }
    });

    if (articles.length !== uniqueArticleIds.length) {
      throw new Error("Mindestens ein Artikel konnte fuer den Standort nicht gefunden werden.");
    }

    let order = await tx.purchaseOrder.findFirst({
      where: {
        locationId: input.locationId,
        status: PurchaseOrderStatus.DRAFT
      },
      include: {
        items: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!order) {
      order = await tx.purchaseOrder.create({
        data: {
          orderNumber: await generateOrderNumber(),
          locationId: input.locationId,
          status: PurchaseOrderStatus.DRAFT,
          createdByUserId: input.userId,
          updatedByUserId: input.userId
        },
        include: {
          items: true
        }
      });
    }

    for (const article of articles) {
      const snapshot = createSnapshot(article);
      const existingItem = order.items.find((item) => item.articleId === article.id);

      if (existingItem) {
        await tx.purchaseOrderItem.update({
          where: { id: existingItem.id },
          data: {
            suggestedQuantity: snapshot.suggestedQuantity,
            articleNameSnapshot: snapshot.articleNameSnapshot,
            barcodeSnapshot: snapshot.barcodeSnapshot,
            categorySnapshot: snapshot.categorySnapshot,
            imageUrlSnapshot: snapshot.imageUrlSnapshot,
            currentQuantitySnapshot: snapshot.currentQuantitySnapshot,
            minimumStockSnapshot: snapshot.minimumStockSnapshot,
            manufacturerNumberSnapshot: snapshot.manufacturerNumberSnapshot,
            supplierNumberSnapshot: snapshot.supplierNumberSnapshot,
            unitPriceCentsSnapshot: snapshot.unitPriceCentsSnapshot
          }
        });
        continue;
      }

      const createdItem = await tx.purchaseOrderItem.create({
        data: {
          purchaseOrderId: order.id,
          ...snapshot
        }
      });
      order.items.push(createdItem);
    }

    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        updatedByUserId: input.userId
      }
    });

    return tx.purchaseOrder.findUniqueOrThrow({
      where: {
        id: order.id
      },
      include: {
        location: true,
        items: {
          include: {
            article: {
              include: {
                inventoryBalance: true
              }
            }
          },
          orderBy: [{ categorySnapshot: "asc" }, { articleNameSnapshot: "asc" }]
        }
      }
    });
  });
}

export async function updatePurchaseOrderItemQuantity(input: {
  orderId: string;
  itemId: string;
  quantity: number;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.purchaseOrderItem.findUnique({
      where: { id: input.itemId },
      include: {
        purchaseOrder: true
      }
    });

    if (!item || item.purchaseOrderId !== input.orderId) {
      throw new Error("Bestellposition nicht gefunden.");
    }

    if (item.purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error("Nur Entwuerfe koennen bearbeitet werden.");
    }

    await tx.purchaseOrderItem.update({
      where: { id: input.itemId },
      data: { quantity: input.quantity }
    });

    await tx.purchaseOrder.update({
      where: { id: input.orderId },
      data: {
        updatedByUserId: input.userId
      }
    });
  });
}

export async function removePurchaseOrderItem(input: {
  orderId: string;
  itemId: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.purchaseOrderItem.findUnique({
      where: { id: input.itemId },
      include: {
        purchaseOrder: true
      }
    });

    if (!item || item.purchaseOrderId !== input.orderId) {
      throw new Error("Bestellposition nicht gefunden.");
    }

    if (item.purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error("Nur Entwuerfe koennen bearbeitet werden.");
    }

    await tx.purchaseOrderItem.delete({
      where: { id: input.itemId }
    });

    const remainingCount = await tx.purchaseOrderItem.count({
      where: { purchaseOrderId: input.orderId }
    });

    if (remainingCount === 0) {
      await tx.purchaseOrder.delete({
        where: { id: input.orderId }
      });

      return {
        deletedOrderId: input.orderId
      };
    }

    await tx.purchaseOrder.update({
      where: { id: input.orderId },
      data: {
        updatedByUserId: input.userId
      }
    });

    return {
      deletedOrderId: null
    };
  });
}

export async function submitPurchaseOrder(input: {
  orderId: string;
  userId: string;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({
      where: { id: input.orderId },
      include: {
        items: true
      }
    });

    if (!order) {
      throw new Error("Bestellung nicht gefunden.");
    }

    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error("Bestellung wurde bereits abgeschlossen.");
    }

    if (order.items.length === 0) {
      throw new Error("Bestellung benoetigt mindestens einen Artikel.");
    }

    return tx.purchaseOrder.update({
      where: { id: input.orderId },
      data: {
        status: PurchaseOrderStatus.ORDERED,
        note: input.note ?? null,
        updatedByUserId: input.userId,
        submittedAt: new Date()
      }
    });
  });
}

export async function deletePurchaseOrder(input: { orderId: string }) {
  const order = await prisma.purchaseOrder.findUnique({
    where: {
      id: input.orderId
    },
    select: {
      id: true
    }
  });

  if (!order) {
    throw new Error("Bestellung nicht gefunden.");
  }

  await prisma.purchaseOrder.delete({
    where: {
      id: input.orderId
    }
  });
}
