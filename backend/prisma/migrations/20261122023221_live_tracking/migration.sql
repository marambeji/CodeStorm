-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveryLat" REAL;
ALTER TABLE "Order" ADD COLUMN "deliveryLng" REAL;
ALTER TABLE "Order" ADD COLUMN "pickupLat" REAL;
ALTER TABLE "Order" ADD COLUMN "pickupLng" REAL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "liveAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "liveLat" REAL;
ALTER TABLE "User" ADD COLUMN "liveLng" REAL;
