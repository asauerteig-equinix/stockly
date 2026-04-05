import { PageIntro } from "@/components/layout/page-intro";
import { ArticleManagement } from "@/features/inventory/article-management";
import { buildArticleImageUrl } from "@/lib/article-images";
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

  const [locations, articles, images] = await Promise.all([
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
        inventoryBalance: true,
        articleBarcodes: {
          orderBy: {
            barcode: "asc"
          }
        }
      },
      orderBy: [{ isArchived: "asc" }, { category: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.articleImage.findMany({
      orderBy: [{ createdAt: "asc" }, { originalName: "asc" }],
      select: {
        fileName: true,
        originalName: true
      }
    })
  ]);

  return (
    <div className="space-y-8">
      <PageIntro
        title="Artikelverwaltung"
        description="Artikel werden standortbezogen gepflegt. Bilder, Import, Sortierung und weitere Hersteller-Barcodes sorgen fuer eine schnellere Identifikation in Admin, Bestellung und Kiosk."
      />

      <ArticleManagement
        canDangerousReset={user.role === "MASTER_ADMIN"}
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
          additionalBarcodes: article.articleBarcodes.map((entry) => entry.barcode),
          imageUrl: article.imageUrl,
          description: article.description,
          manufacturerNumber: article.manufacturerNumber,
          supplierNumber: article.supplierNumber,
          unitPriceCents: article.unitPriceCents,
          category: article.category,
          sortOrder: article.sortOrder,
          minimumStock: article.minimumStock,
          isArchived: article.isArchived,
          locationName: article.location.name,
          quantity: article.inventoryBalance?.quantity ?? 0
        }))}
        images={images.map((image) => ({
          fileName: image.fileName,
          name: image.originalName,
          url: buildArticleImageUrl(image.fileName)
        }))}
      />
    </div>
  );
}
