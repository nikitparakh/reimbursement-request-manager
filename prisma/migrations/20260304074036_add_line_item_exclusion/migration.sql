-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReceiptLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptExtractionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL,
    "unitPrice" DECIMAL,
    "lineTotal" DECIMAL,
    "category" TEXT,
    "excludedAt" DATETIME,
    "excludedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReceiptLineItem_receiptExtractionId_fkey" FOREIGN KEY ("receiptExtractionId") REFERENCES "ReceiptExtraction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReceiptLineItem_excludedById_fkey" FOREIGN KEY ("excludedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReceiptLineItem" ("category", "createdAt", "description", "id", "lineTotal", "position", "quantity", "receiptExtractionId", "unitPrice", "updatedAt") SELECT "category", "createdAt", "description", "id", "lineTotal", "position", "quantity", "receiptExtractionId", "unitPrice", "updatedAt" FROM "ReceiptLineItem";
DROP TABLE "ReceiptLineItem";
ALTER TABLE "new_ReceiptLineItem" RENAME TO "ReceiptLineItem";
CREATE INDEX "ReceiptLineItem_receiptExtractionId_position_idx" ON "ReceiptLineItem"("receiptExtractionId", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
