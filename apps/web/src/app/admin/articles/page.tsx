import { PageIntro } from "@/components/layout/page-intro";
import { ArticleManagement } from "@/features/inventory/article-management";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function ArticlesPage() {
  const user = await requireUser();
  const locationFilter =
    user.role === "MASTER_ADMIN"
      ? undefined
      : {
          id: {
            in: user.assignedLocationIds
          }
        };

  const [locations, articles] = await Promise.all([
    prisma.location.findMany({
      where: locationFilter,
      orderBy: {
        name: "asc"
      }
    }),
    prisma.article.findMany({
      where:
        user.role === "MASTER_ADMIN"
          ? undefined
          : {
              locationId: {
                in: user.assignedLocationIds
              }
            },
      include: {
        location: true,
        inventoryBalance: true
      },
      orderBy: [{ isArchived: "asc" }, { name: "asc" }]
    })
  ]);

  return (
    <div className="space-y-8">
      <PageIntro
        title="Artikelverwaltung"
        description="Artikel werden standortbezogen gepflegt, Barcodes pro Standort eindeutig gehalten und bevorzugt archiviert statt geloescht."
      />

      <ArticleManagement
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
          description: article.description,
          manufacturerNumber: article.manufacturerNumber,
          supplierNumber: article.supplierNumber,
          category: article.category,
          minimumStock: article.minimumStock,
          isArchived: article.isArchived,
          locationName: article.location.name,
          quantity: article.inventoryBalance?.quantity ?? 0
        }))}
      />
    </div>
  );
}
