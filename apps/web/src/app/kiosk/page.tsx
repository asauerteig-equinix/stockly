import { KioskPairingCard } from "@/features/kiosk/kiosk-pairing-card";
import { KioskTerminal } from "@/features/kiosk/kiosk-terminal";
import { getKioskContext } from "@/server/auth";
import { usageReasonOptions } from "@/server/constants";
import { prisma } from "@/server/db";

export default async function KioskPage() {
  const kiosk = await getKioskContext();

  const usageReasonOrder = kiosk
    ? await prisma.stockMovement.groupBy({
        by: ["usageReason"],
        where: {
          locationId: kiosk.locationId,
          type: "TAKE",
          usageReason: {
            not: null
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
      })
    : [];

  const sortedUsageReasons = [
    ...usageReasonOrder.map((entry) => entry.usageReason).filter((value): value is string => Boolean(value)),
    ...usageReasonOptions.filter((reason) => !usageReasonOrder.some((entry) => entry.usageReason === reason))
  ];

  const [kioskArticles, recentTakeMovements] = kiosk
    ? await Promise.all([
        prisma.article.findMany({
          where: {
            locationId: kiosk.locationId,
            isArchived: false
          },
          include: {
            inventoryBalance: true,
            articleBarcodes: {
              orderBy: {
                barcode: "asc"
              }
            }
          },
          orderBy: [{ category: "asc" }, { name: "asc" }]
        }),
        prisma.stockMovement.findMany({
          where: {
            locationId: kiosk.locationId,
            type: "TAKE"
          },
          select: {
            articleId: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 80
        })
      ])
    : [[], []];

  const popularArticleIds = kiosk
    ? Array.from(
        recentTakeMovements.reduce((articleCount, movement) => {
          articleCount.set(movement.articleId, (articleCount.get(movement.articleId) ?? 0) + 1);
          return articleCount;
        }, new Map<string, number>())
      )
        .sort((left, right) => right[1] - left[1])
        .map(([articleId]) => articleId)
    : [];

  const locations = await prisma.location.findMany({
    where: {
      isActive: true
    },
    orderBy: {
      name: "asc"
    }
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.16),_transparent_18%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-white">
      {kiosk ? (
        <div className="page-shell py-4 lg:py-5">
          <KioskTerminal
            kiosk={{
              locationName: kiosk.locationName,
              locationCode: kiosk.locationCode
            }}
            usageReasons={sortedUsageReasons}
            articles={kioskArticles.map((article) => ({
              id: article.id,
              name: article.name,
              barcode: article.barcode,
              additionalBarcodes: article.articleBarcodes.map((entry) => entry.barcode),
              description: article.description,
              category: article.category,
              minimumStock: article.minimumStock,
              quantity: article.inventoryBalance?.quantity ?? 0
            }))}
            popularArticleIds={popularArticleIds}
          />
        </div>
      ) : (
        <div className="page-shell flex min-h-screen items-center justify-center py-8">
          <div className="w-full max-w-xl space-y-4">
            <div className="space-y-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Kiosk Setup</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">Terminal koppeln</h1>
              <p className="text-sm text-slate-400">Standort waehlen, PIN eingeben, danach startet direkt die Buchungsansicht.</p>
            </div>

            <KioskPairingCard
              locations={locations.map((location) => ({
                id: location.id,
                name: location.name,
                code: location.code
              }))}
            />
          </div>
        </div>
      )}
    </main>
  );
}
