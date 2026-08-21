-- CreateEnum
CREATE TYPE "ProductLine" AS ENUM ('OWN_PRODUCTION', 'NATIVE_SPIRIT');

-- CreateEnum
CREATE TYPE "GarmentFit" AS ENUM ('CLASSIC', 'OVERSIZE', 'OVERSIZE_WOMEN', 'COMFORT', 'HYBRID', 'KIDS');

-- CreateEnum
CREATE TYPE "GarmentType" AS ENUM ('TSHIRT', 'SWEATSHIRT', 'HOODIE', 'ZIP_HOODIE', 'JOGGERS', 'TOTE_BAG');

-- CreateEnum
CREATE TYPE "VariantAvailability" AS ENUM ('IN_STOCK', 'MADE_TO_ORDER', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "PrintSizeTier" AS ENUM ('MINI', 'MEDIUM', 'MAXI');

-- CreateEnum
CREATE TYPE "PrintMethod" AS ENUM ('DTF', 'DTG');

-- CreateEnum
CREATE TYPE "OrderStream" AS ENUM ('READY_PRINT', 'CUSTOMISATION', 'FROM_ZERO');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomRequestStatus" AS ENUM ('SUBMITTED', 'QUOTED', 'DEPOSIT_PAID', 'IN_DESIGN', 'AWAITING_APPROVAL', 'APPROVED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "MeasurementKey" AS ENUM ('WIDTH', 'LENGTH', 'SLEEVE', 'WAIST', 'HIP');

-- CreateTable
CREATE TABLE "Fabric" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "line" "ProductLine" NOT NULL,
    "weightGsm" INTEGER NOT NULL,
    "composition" TEXT NOT NULL,
    "origin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fabric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colour" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "supplierCode" TEXT NOT NULL,
    "hex" CHAR(7),
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricColour" (
    "fabricId" UUID NOT NULL,
    "colourId" UUID NOT NULL,

    CONSTRAINT "FabricColour_pkey" PRIMARY KEY ("fabricId","colourId")
);

-- CreateTable
CREATE TABLE "Garment" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "line" "ProductLine" NOT NULL,
    "type" "GarmentType" NOT NULL,
    "fit" "GarmentFit" NOT NULL,
    "name" TEXT NOT NULL,
    "lengthAdjustable" BOOLEAN NOT NULL DEFAULT false,
    "basePriceMinor" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Garment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarmentFabric" (
    "garmentId" UUID NOT NULL,
    "fabricId" UUID NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GarmentFabric_pkey" PRIMARY KEY ("garmentId","fabricId")
);

-- CreateTable
CREATE TABLE "Size" (
    "id" UUID NOT NULL,
    "garmentId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Size_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" UUID NOT NULL,
    "sizeId" UUID NOT NULL,
    "key" "MeasurementKey" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "garmentId" UUID NOT NULL,
    "fabricId" UUID NOT NULL,
    "colourId" UUID NOT NULL,
    "sizeId" UUID NOT NULL,
    "availability" "VariantAvailability" NOT NULL DEFAULT 'UNAVAILABLE',
    "leadTimeDays" INTEGER,
    "priceOverrideMinor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Breed" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "synonyms" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Print" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sizeTier" "PrintSizeTier" NOT NULL,
    "previewUrl" TEXT NOT NULL,
    "artworkKey" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Print_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintCollection" (
    "printId" UUID NOT NULL,
    "collectionId" UUID NOT NULL,

    CONSTRAINT "PrintCollection_pkey" PRIMARY KEY ("printId","collectionId")
);

-- CreateTable
CREATE TABLE "PrintBreed" (
    "printId" UUID NOT NULL,
    "breedId" UUID NOT NULL,

    CONSTRAINT "PrintBreed_pkey" PRIMARY KEY ("printId","breedId")
);

-- CreateTable
CREATE TABLE "PrintGarmentRule" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "garmentId" UUID NOT NULL,

    CONSTRAINT "PrintGarmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintPrice" (
    "tier" "PrintSizeTier" NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "suppliedArtworkDiscountMinor" INTEGER NOT NULL DEFAULT 15000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintPrice_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "stream" "OrderStream" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotalMinor" INTEGER NOT NULL,
    "shippingMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "printId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "printMethod" "PrintMethod" NOT NULL,
    "garmentPriceMinor" INTEGER NOT NULL,
    "printPriceMinor" INTEGER NOT NULL,
    "lineTotalMinor" INTEGER NOT NULL,
    "promisedLeadTimeDays" INTEGER,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRequest" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "CustomRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "dogName" TEXT NOT NULL,
    "dogBreed" TEXT NOT NULL,
    "photoKeys" TEXT[],
    "mood" TEXT NOT NULL,
    "references" TEXT[],
    "notes" TEXT,
    "garmentType" "GarmentType" NOT NULL,
    "preferredLine" "ProductLine",
    "sizeLabel" TEXT,
    "colourNote" TEXT,
    "customerSuppliedArtwork" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TIMESTAMP(3),
    "quotedTotalMinor" INTEGER,
    "includedRevisions" INTEGER NOT NULL DEFAULT 2,
    "extraRevisionMinor" INTEGER,
    "quoteValidUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "correlationId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT,
    "source" TEXT,
    "telegramSentAt" TIMESTAMP(3),
    "telegramError" TEXT,
    "customerId" UUID,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fabric_line_idx" ON "Fabric"("line");

-- CreateIndex
CREATE UNIQUE INDEX "Fabric_line_name_key" ON "Fabric"("line", "name");

-- CreateIndex
CREATE INDEX "Colour_name_idx" ON "Colour"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Colour_supplierCode_key" ON "Colour"("supplierCode");

-- CreateIndex
CREATE INDEX "FabricColour_colourId_idx" ON "FabricColour"("colourId");

-- CreateIndex
CREATE UNIQUE INDEX "Garment_slug_key" ON "Garment"("slug");

-- CreateIndex
CREATE INDEX "Garment_line_type_idx" ON "Garment"("line", "type");

-- CreateIndex
CREATE INDEX "Garment_isPublished_idx" ON "Garment"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "Garment_line_type_fit_key" ON "Garment"("line", "type", "fit");

-- CreateIndex
CREATE INDEX "GarmentFabric_fabricId_idx" ON "GarmentFabric"("fabricId");

-- CreateIndex
CREATE INDEX "Size_garmentId_idx" ON "Size"("garmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Size_garmentId_label_key" ON "Size"("garmentId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Size_garmentId_position_key" ON "Size"("garmentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_sizeId_key_key" ON "Measurement"("sizeId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_sku_key" ON "Variant"("sku");

-- CreateIndex
CREATE INDEX "Variant_garmentId_availability_idx" ON "Variant"("garmentId", "availability");

-- CreateIndex
CREATE INDEX "Variant_availability_idx" ON "Variant"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_garmentId_fabricId_colourId_sizeId_key" ON "Variant"("garmentId", "fabricId", "colourId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_isPublished_position_idx" ON "Collection"("isPublished", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Breed_slug_key" ON "Breed"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Print_slug_key" ON "Print"("slug");

-- CreateIndex
CREATE INDEX "Print_isPublished_idx" ON "Print"("isPublished");

-- CreateIndex
CREATE INDEX "Print_sizeTier_idx" ON "Print"("sizeTier");

-- CreateIndex
CREATE INDEX "PrintCollection_collectionId_idx" ON "PrintCollection"("collectionId");

-- CreateIndex
CREATE INDEX "PrintBreed_breedId_idx" ON "PrintBreed"("breedId");

-- CreateIndex
CREATE INDEX "PrintGarmentRule_garmentId_idx" ON "PrintGarmentRule"("garmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintGarmentRule_collectionId_garmentId_key" ON "PrintGarmentRule"("collectionId", "garmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_status_placedAt_idx" ON "Order"("status", "placedAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomRequest_number_key" ON "CustomRequest"("number");

-- CreateIndex
CREATE INDEX "CustomRequest_status_createdAt_idx" ON "CustomRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CustomRequest_customerId_idx" ON "CustomRequest"("customerId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_number_key" ON "Lead"("number");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_telegramSentAt_idx" ON "Lead"("telegramSentAt");

-- AddForeignKey
ALTER TABLE "FabricColour" ADD CONSTRAINT "FabricColour_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricColour" ADD CONSTRAINT "FabricColour_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarmentFabric" ADD CONSTRAINT "GarmentFabric_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "Garment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarmentFabric" ADD CONSTRAINT "GarmentFabric_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Size" ADD CONSTRAINT "Size_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "Garment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "Garment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintCollection" ADD CONSTRAINT "PrintCollection_printId_fkey" FOREIGN KEY ("printId") REFERENCES "Print"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintCollection" ADD CONSTRAINT "PrintCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintBreed" ADD CONSTRAINT "PrintBreed_printId_fkey" FOREIGN KEY ("printId") REFERENCES "Print"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintBreed" ADD CONSTRAINT "PrintBreed_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintGarmentRule" ADD CONSTRAINT "PrintGarmentRule_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintGarmentRule" ADD CONSTRAINT "PrintGarmentRule_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "Garment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_printId_fkey" FOREIGN KEY ("printId") REFERENCES "Print"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomRequest" ADD CONSTRAINT "CustomRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
