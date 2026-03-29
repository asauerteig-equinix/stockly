CREATE TABLE "ArticleBarcode" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleBarcode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArticleBarcode_locationId_barcode_key" ON "ArticleBarcode"("locationId", "barcode");
CREATE UNIQUE INDEX "ArticleBarcode_articleId_barcode_key" ON "ArticleBarcode"("articleId", "barcode");
CREATE INDEX "ArticleBarcode_articleId_idx" ON "ArticleBarcode"("articleId");

ALTER TABLE "ArticleBarcode"
ADD CONSTRAINT "ArticleBarcode_articleId_fkey"
FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
