import { subDays } from "date-fns";

import { prisma } from "@/server/db";

export async function getDashboardReport(locationIds?: string[]) {
  const locationIdFilter = locationIds?.length ? { in: locationIds } : undefined;

  const balances = await prisma.inventoryBalance.findMany({
    where: locationIdFilter
      ? {
          locationId: locationIdFilter
        }
      : undefined,
    include: {
      article: true,
      location: true
    }
  });

  const recentMovements = await prisma.stockMovement.findMany({
    where: locationIdFilter
      ? {
          locationId: locationIdFilter
        }
      : undefined,
    include: {
      article: true,
      location: true,
      createdByUser: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 8
  });

  const topWithdrawals = await prisma.stockMovement.groupBy({
    by: ["articleId"],
    where: {
      type: "TAKE",
      locationId: locationIdFilter ? locationIdFilter : undefined,
      createdAt: {
        gte: subDays(new Date(), 60)
      }
    },
    _sum: {
      quantity: true
    },
    orderBy: {
      _sum: {
        quantity: "desc"
      }
    },
    take: 5
  });

  const usageReasonDistribution = await prisma.stockMovement.groupBy({
    by: ["usageReason"],
    where: {
      type: "TAKE",
      usageReason: {
        not: null
      },
      locationId: locationIdFilter ? locationIdFilter : undefined,
      createdAt: {
        gte: subDays(new Date(), 60)
      }
    },
    _count: {
      usageReason: true
    },
    orderBy: {
      _count: {
        usageReason: "desc"
      }
    }
  });

  const consumptionMovements = await prisma.stockMovement.findMany({
    where: {
      type: "TAKE",
      locationId: locationIdFilter ? locationIdFilter : undefined,
      createdAt: {
        gte: subDays(new Date(), 30)
      }
    },
    select: {
      quantity: true,
      createdAt: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const topArticleIds = topWithdrawals.map((entry) => entry.articleId);
  const topArticles = topArticleIds.length
    ? await prisma.article.findMany({
        where: {
          id: {
            in: topArticleIds
          }
        }
      })
    : [];
  const topArticleMap = new Map(topArticles.map((article) => [article.id, article]));

  const articleIdsWithMovement = new Set(
    (
      await prisma.stockMovement.findMany({
        where: locationIdFilter
          ? {
              locationId: locationIdFilter
            }
          : undefined,
        select: {
          articleId: true
        },
        distinct: ["articleId"]
      })
    ).map((entry) => entry.articleId)
  );

  const dormantArticles = await prisma.article.findMany({
    where: {
      locationId: locationIdFilter ? locationIdFilter : undefined,
      isArchived: false
    },
    include: {
      location: true,
      inventoryBalance: true
    },
    orderBy: {
      name: "asc"
    }
  });

  return {
    totals: {
      articles: balances.length,
      quantity: balances.reduce((sum, balance) => sum + balance.quantity, 0),
      lowStockCandidates: balances.filter((balance) => balance.quantity <= balance.article.minimumStock).length
    },
    recentMovements,
    topWithdrawals: topWithdrawals.map((entry) => ({
      articleId: entry.articleId,
      articleName: topArticleMap.get(entry.articleId)?.name ?? "Unbekannter Artikel",
      quantity: entry._sum.quantity ?? 0
    })),
    usageReasonDistribution: usageReasonDistribution.map((entry) => ({
      usageReason: entry.usageReason ?? "ohne Angabe",
      count: entry._count.usageReason
    })),
    consumptionSeries: consumptionMovements.reduce<Array<{ label: string; quantity: number }>>((acc, movement) => {
      const label = movement.createdAt.toISOString().slice(0, 10);
      const current = acc.find((entry) => entry.label === label);

      if (current) {
        current.quantity += movement.quantity;
        return acc;
      }

      acc.push({
        label,
        quantity: movement.quantity
      });
      return acc;
    }, []),
    dormantArticles: dormantArticles.filter((article) => !articleIdsWithMovement.has(article.id))
  };
}
