ALTER TABLE "Article"
ADD COLUMN "unitPriceCents" INTEGER;

ALTER TABLE "PurchaseOrderItem"
ADD COLUMN "unitPriceCentsSnapshot" INTEGER;
