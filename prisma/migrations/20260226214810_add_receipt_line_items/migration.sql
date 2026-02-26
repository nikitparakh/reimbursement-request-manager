-- CreateTable
CREATE TABLE "ReceiptLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptExtractionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL,
    "unitPrice" DECIMAL,
    "lineTotal" DECIMAL,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReceiptLineItem_receiptExtractionId_fkey" FOREIGN KEY ("receiptExtractionId") REFERENCES "ReceiptExtraction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReceiptLineItem_receiptExtractionId_position_idx" ON "ReceiptLineItem"("receiptExtractionId", "position");
