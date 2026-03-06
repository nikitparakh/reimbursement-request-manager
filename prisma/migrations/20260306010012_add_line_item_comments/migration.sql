-- CreateTable
CREATE TABLE "LineItemComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineItemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LineItemComment_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "ReceiptLineItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LineItemComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LineItemComment_lineItemId_createdAt_idx" ON "LineItemComment"("lineItemId", "createdAt");
