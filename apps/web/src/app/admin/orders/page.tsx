import { OrderWorkspace } from "@/features/orders/order-workspace";
import { getSuggestedReorderQuantity } from "@/lib/reorder";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { formatDate, formatDateTime } from "@/server/format";
import { getWarnings } from "@/server/warnings";

export default async function OrdersPage() {
  const user = await requireUser();
  const locationIds = user.role === "MASTER_ADMIN" ? undefined : user.assignedLocationIds;

  const [locations, articles, warnings, drafts, history] = await Promise.all([
    prisma.location.findMany({
      where:
        locationIds?.length
          ? {
              id: {
                in: locationIds
              }
            }
          : undefined,
      orderBy: {
        name: "asc"
      }
    }),
    prisma.article.findMany({
      where:
        locationIds?.length
          ? {
              locationId: {
                in: locationIds
              },
              isArchived: false
            }
          : {
              isArchived: false
            },
      include: {
        inventoryBalance: true,
        location: true
      },
      orderBy: [{ location: { name: "asc" } }, { category: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    }),
    getWarnings(locationIds),
    prisma.purchaseOrder.findMany({
      where: {
        status: "DRAFT",
        ...(locationIds?.length
          ? {
              locationId: {
                in: locationIds
              }
            }
          : {})
      },
      include: {
        items: {
          orderBy: [{ categorySnapshot: "asc" }, { articleNameSnapshot: "asc" }]
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.purchaseOrder.findMany({
      where: {
        status: "ORDERED",
        ...(locationIds?.length
          ? {
              locationId: {
                in: locationIds
              }
            }
          : {})
      },
      include: {
        location: true,
        _count: {
          select: {
            items: true
          }
        }
      },
      orderBy: {
        submittedAt: "desc"
      },
      take: 12
    })
  ]);

  return (
    <div className="space-y-8">
      <OrderWorkspace
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name,
          code: location.code
        }))}
        articles={articles.map((article) => ({
          id: article.id,
          locationId: article.locationId,
          name: article.name,
          barcode: article.barcode,
          category: article.category,
          sortOrder: article.sortOrder,
          imageUrl: article.imageUrl,
          unitPriceCents: article.unitPriceCents,
          quantity: article.inventoryBalance?.quantity ?? 0,
          minimumStock: article.minimumStock
        }))}
        lowStock={warnings.lowStock.map((entry) => ({
          articleId: entry.articleId,
          locationId: entry.locationId,
          articleName: entry.article.name,
          category: entry.article.category,
          imageUrl: entry.article.imageUrl,
          quantity: entry.quantity,
          minimumStock: entry.article.minimumStock,
          suggestedQuantity: getSuggestedReorderQuantity(
            entry.quantity,
            entry.article.minimumStock,
            entry.location.settings?.lowStockBuffer ?? 0
          )
        }))}
        drafts={drafts.map((draft) => ({
          id: draft.id,
          orderNumber: draft.orderNumber,
          locationId: draft.locationId,
          note: draft.note,
          updatedAtLabel: formatDateTime(draft.updatedAt),
          items: draft.items.map((item) => ({
            id: item.id,
            articleId: item.articleId,
            quantity: item.quantity,
            suggestedQuantity: item.suggestedQuantity,
            articleName: item.articleNameSnapshot,
            category: item.categorySnapshot,
            imageUrl: item.imageUrlSnapshot,
            currentQuantity: item.currentQuantitySnapshot,
            minimumStock: item.minimumStockSnapshot,
            unitPriceCents: item.unitPriceCentsSnapshot
          }))
        }))}
        history={history.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          locationName: order.location.name,
          itemCount: order._count.items,
          createdAtLabel: formatDate(order.createdAt),
          submittedAtLabel: formatDate(order.submittedAt)
        }))}
      />
    </div>
  );
}
