import { NextResponse } from "next/server";

import { articlePlaceholderImage } from "@/lib/article-images";
import { normalizeArticleImportLookup, parseArticleImportFile } from "@/lib/article-import";
import { normalizeBarcode, sanitizeAdditionalBarcodes } from "@/lib/barcodes";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { apiError } from "@/server/permissions";

function indexArticle(
  article: {
    id: string;
    locationId: string;
    name: string;
    category: string;
    barcode: string;
  },
  byBarcode: Map<string, string>,
  byCategoryAndName: Map<string, string>
) {
  byBarcode.set(`${article.locationId}::${normalizeBarcode(article.barcode)}`, article.id);
  byCategoryAndName.set(
    `${article.locationId}::${normalizeArticleImportLookup(article.category)}::${normalizeArticleImportLookup(article.name)}`,
    article.id
  );
}

function unindexArticle(
  article: {
    locationId: string;
    name: string;
    category: string;
    barcode: string;
  },
  byBarcode: Map<string, string>,
  byCategoryAndName: Map<string, string>
) {
  byBarcode.delete(`${article.locationId}::${normalizeBarcode(article.barcode)}`);
  byCategoryAndName.delete(
    `${article.locationId}::${normalizeArticleImportLookup(article.category)}::${normalizeArticleImportLookup(article.name)}`
  );
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Bitte eine Importdatei auswaehlen.");
    }

    const parsedImport = await parseArticleImportFile(file);

    const summary = await prisma.$transaction(async (tx) => {
      const accessibleLocationFilter =
        user.role === "MASTER_ADMIN"
          ? undefined
          : {
              id: {
                in: user.assignedLocationIds
              }
            };

      const [locations, articles] = await Promise.all([
        tx.location.findMany({
          where: accessibleLocationFilter,
          select: {
            id: true,
            name: true,
            code: true
          }
        }),
        tx.article.findMany({
          where:
            user.role === "MASTER_ADMIN"
              ? undefined
              : {
                  locationId: {
                    in: user.assignedLocationIds
                  }
                },
          include: {
            articleBarcodes: true
          }
        })
      ]);

      const locationsByCode = new Map(locations.map((location) => [normalizeArticleImportLookup(location.code), location]));
      const locationsByName = new Map(locations.map((location) => [normalizeArticleImportLookup(location.name), location]));
      const articlesById = new Map(articles.map((article) => [article.id, article]));
      const articlesByBarcode = new Map<string, string>();
      const articlesByCategoryAndName = new Map<string, string>();

      for (const article of articles) {
        indexArticle(article, articlesByBarcode, articlesByCategoryAndName);
      }

      const counters = {
        createdArticles: 0,
        updatedArticles: 0
      };

      for (const row of parsedImport.rows) {
        const location =
          (row.locationCode ? locationsByCode.get(normalizeArticleImportLookup(row.locationCode)) : undefined) ??
          (row.locationName ? locationsByName.get(normalizeArticleImportLookup(row.locationName)) : undefined);

        if (!location) {
          throw new Error(`Zeile ${row.rowNumber}: Standort nicht gefunden oder nicht sichtbar.`);
        }

        const normalizedPrimaryBarcode = normalizeBarcode(row.barcode);
        const barcodeKey = `${location.id}::${normalizedPrimaryBarcode}`;
        const categoryNameKey = `${location.id}::${normalizeArticleImportLookup(row.categoryName)}::${normalizeArticleImportLookup(row.name)}`;
        const existingArticleId = articlesByBarcode.get(barcodeKey) ?? articlesByCategoryAndName.get(categoryNameKey);
        const additionalBarcodes = sanitizeAdditionalBarcodes(row.additionalBarcodes, normalizedPrimaryBarcode);
        const imageUrl = row.imageUrl || articlePlaceholderImage;

        if (existingArticleId) {
          const existingArticle = articlesById.get(existingArticleId);

          if (!existingArticle) {
            throw new Error(`Zeile ${row.rowNumber}: Artikel konnte nicht geladen werden.`);
          }

          const updatedArticle = await tx.article.update({
            where: {
              id: existingArticle.id
            },
            data: {
              locationId: location.id,
              name: row.name,
              barcode: normalizedPrimaryBarcode,
              description: row.description ?? null,
              manufacturerNumber: row.manufacturerNumber ?? null,
              supplierNumber: row.supplierNumber ?? null,
              category: row.categoryName,
              sortOrder: row.sortOrder ?? existingArticle.sortOrder,
              minimumStock: row.minimumStock ?? existingArticle.minimumStock,
              imageUrl,
              isArchived: row.active === undefined ? existingArticle.isArchived : !row.active
            }
          });

          await tx.articleBarcode.deleteMany({
            where: {
              articleId: existingArticle.id
            }
          });

          if (additionalBarcodes.length) {
            await tx.articleBarcode.createMany({
              data: additionalBarcodes.map((barcode) => ({
                articleId: existingArticle.id,
                locationId: location.id,
                barcode
              }))
            });
          }

          unindexArticle(existingArticle, articlesByBarcode, articlesByCategoryAndName);
          indexArticle(updatedArticle, articlesByBarcode, articlesByCategoryAndName);
          articlesById.set(updatedArticle.id, {
            ...existingArticle,
            ...updatedArticle,
            articleBarcodes: additionalBarcodes.map((barcode) => ({
              id: "",
              articleId: existingArticle.id,
              locationId: location.id,
              barcode,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          });
          counters.updatedArticles += 1;
          continue;
        }

        const createdArticle = await tx.article.create({
          data: {
            locationId: location.id,
            name: row.name,
            barcode: normalizedPrimaryBarcode,
            description: row.description ?? null,
            manufacturerNumber: row.manufacturerNumber ?? null,
            supplierNumber: row.supplierNumber ?? null,
            category: row.categoryName,
            sortOrder: row.sortOrder ?? 0,
            minimumStock: row.minimumStock ?? 0,
            imageUrl,
            isArchived: row.active === undefined ? false : !row.active,
            articleBarcodes: additionalBarcodes.length
              ? {
                  createMany: {
                    data: additionalBarcodes.map((barcode) => ({
                      locationId: location.id,
                      barcode
                    }))
                  }
                }
              : undefined
          },
          include: {
            articleBarcodes: true
          }
        });

        indexArticle(createdArticle, articlesByBarcode, articlesByCategoryAndName);
        articlesById.set(createdArticle.id, createdArticle);
        counters.createdArticles += 1;
      }

      return counters;
    });

    const infoSuffix =
      parsedImport.unknownHeaders.length > 0
        ? ` Nicht erkannte Spalten ignoriert: ${parsedImport.unknownHeaders.join(", ")}.`
        : "";

    return NextResponse.json({
      ok: true,
      message: `Import abgeschlossen (${parsedImport.sheetName}): ${summary.createdArticles} Artikel angelegt, ${summary.updatedArticles} aktualisiert.` + infoSuffix
    });
  } catch (error) {
    return apiError(error);
  }
}
