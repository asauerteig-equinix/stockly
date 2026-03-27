import { PageIntro } from "@/components/layout/page-intro";
import { InventoryManagement } from "@/features/inventory/inventory-management";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { formatDateTime } from "@/server/format";

export default async function InventoryPage() {
  const user = await requireUser();
  const articleWhere =
    user.role === "MASTER_ADMIN"
      ? { isArchived: false }
      : {
          isArchived: false,
          locationId: {
            in: user.assignedLocationIds
          }
        };

  const [articles, balances] = await Promise.all([
    prisma.article.findMany({
      where: articleWhere,
      include: {
        location: true,
        inventoryBalance: true
      },
      orderBy: {
        name: "asc"
      }
    }),
    prisma.inventoryBalance.findMany({
      where:
        user.role === "MASTER_ADMIN"
          ? undefined
          : {
              locationId: {
                in: user.assignedLocationIds
              }
            },
      include: {
        article: true,
        location: true
      },
      orderBy: [{ location: { name: "asc" } }, { article: { name: "asc" } }]
    })
  ]);

  return (
    <div className="space-y-8">
      <PageIntro
        title="Bestandsmanagement"
        description="Wareneingaenge und manuelle Korrekturen laufen ausschliesslich ueber die Admin-Oberflaeche und schreiben atomare Lagerbewegungen."
      />

      <InventoryManagement
        articles={articles.map((article) => ({
          id: article.id,
          name: article.name,
          category: article.category,
          locationId: article.locationId,
          locationName: article.location.name,
          quantity: article.inventoryBalance?.quantity ?? 0,
          minimumStock: article.minimumStock,
          lastMovementAt: article.inventoryBalance?.lastMovementAt
            ? formatDateTime(article.inventoryBalance.lastMovementAt)
            : null
        }))}
        balances={balances.map((balance) => ({
          id: balance.id,
          articleId: balance.articleId,
          locationId: balance.locationId,
          locationName: balance.location.name,
          articleName: balance.article.name,
          category: balance.article.category,
          quantity: balance.quantity,
          minimumStock: balance.article.minimumStock,
          lastMovementAt: balance.lastMovementAt ? formatDateTime(balance.lastMovementAt) : null
        }))}
      />
    </div>
  );
}
