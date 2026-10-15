-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "branchId" TEXT;

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "deliveryRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "offlineMessage" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchVariantStock" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchVariantStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchStockMovement" (
    "id" TEXT NOT NULL,
    "branchStockId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "orderId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchRider" (
    "branchId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,

    CONSTRAINT "BranchRider_pkey" PRIMARY KEY ("branchId","riderId")
);

-- CreateTable
CREATE TABLE "BranchStatusLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_slug_key" ON "Branch"("slug");

-- CreateIndex
CREATE INDEX "Branch_isActive_isOnline_idx" ON "Branch"("isActive", "isOnline");

-- CreateIndex
CREATE INDEX "Branch_lat_lng_idx" ON "Branch"("lat", "lng");

-- CreateIndex
CREATE INDEX "BranchVariantStock_branchId_stock_idx" ON "BranchVariantStock"("branchId", "stock");

-- CreateIndex
CREATE INDEX "BranchVariantStock_variantId_idx" ON "BranchVariantStock"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchVariantStock_branchId_variantId_key" ON "BranchVariantStock"("branchId", "variantId");

-- CreateIndex
CREATE INDEX "BranchStockMovement_branchStockId_createdAt_idx" ON "BranchStockMovement"("branchStockId", "createdAt");

-- CreateIndex
CREATE INDEX "BranchStockMovement_orderId_idx" ON "BranchStockMovement"("orderId");

-- CreateIndex
CREATE INDEX "BranchStatusLog_branchId_createdAt_idx" ON "BranchStatusLog"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_branchId_idx" ON "Order"("branchId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchVariantStock" ADD CONSTRAINT "BranchVariantStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchVariantStock" ADD CONSTRAINT "BranchVariantStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchStockMovement" ADD CONSTRAINT "BranchStockMovement_branchStockId_fkey" FOREIGN KEY ("branchStockId") REFERENCES "BranchVariantStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchRider" ADD CONSTRAINT "BranchRider_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchRider" ADD CONSTRAINT "BranchRider_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchStatusLog" ADD CONSTRAINT "BranchStatusLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
