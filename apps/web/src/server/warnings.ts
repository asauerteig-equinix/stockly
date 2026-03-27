import { subDays } from "date-fns";

import { prisma } from "@/server/db";

export async function getWarnings(locationIds?: string[]) {
  const locationIdFilter = locationIds?.length ? { in: locationIds } : undefined;

  const balances = await prisma.inventoryBalance.findMany({
    where: locationIdFilter
      ? {
          locationId: locationIdFilter
        }
      : undefined,
    include: {
      article: true,
      location: {
        include: {
          settings: true
        }
      }
    },
    orderBy: [{ quantity: "asc" }, { updatedAt: "desc" }]
  });

  const lowStock = balances.filter(
    (balance) => balance.quantity <= balance.article.minimumStock + (balance.location.settings?.lowStockBuffer ?? 0)
  );

  const agingReferenceMap = new Map<string, Date>();
  const movementGroups = await prisma.stockMovement.groupBy({
    by: ["articleId"],
    where: {
      type: "TAKE",
      locationId: locationIdFilter ? locationIdFilter : undefined
    },
    _max: {
      createdAt: true
    }
  });

  for (const group of movementGroups) {
    if (group._max.createdAt) {
      agingReferenceMap.set(group.articleId, group._max.createdAt);
    }
  }

  const aging = balances.filter((balance) => {
    const thresholdDays = balance.location.settings?.agingWarningDays ?? 30;
    const lastTake = agingReferenceMap.get(balance.articleId);

    if (!lastTake) {
      return true;
    }

    return lastTake < subDays(new Date(), thresholdDays);
  });

  return {
    lowStock,
    aging
  };
}
