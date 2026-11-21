/*
  Warnings:

  - You are about to drop the column `anomaly` on the `MeterReading` table. All the data in the column will be lost.
  - Added the required column `label` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tips` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `meterId` to the `MeterReading` table without a default value. This is not possible if the table is not empty.
  - Added the required column `readAt` to the `MeterReading` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MeterReading` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diseaseKey` to the `PlantDiagnosis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tips` to the `PlantDiagnosis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PlantDiagnosis` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "HydroObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zoneId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "waterLevelM" REAL,
    "observedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Meter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "supplier" TEXT,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "kwh" REAL NOT NULL,
    "hpKwh" REAL,
    "hcKwh" REAL,
    "amount" REAL NOT NULL,
    "subscriptionKva" REAL,
    "offer" TEXT NOT NULL DEFAULT 'base',
    "tiers" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "tips" TEXT NOT NULL,
    "extraction" TEXT NOT NULL DEFAULT 'auto',
    "fileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Invoice" ("amount", "createdAt", "explanation", "id", "kwh", "periodEnd", "periodStart", "tiers") SELECT "amount", "createdAt", "explanation", "id", "kwh", "periodEnd", "periodStart", "tiers" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE TABLE "new_MeterReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meterId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "readAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ocr',
    "ocrConfidence" REAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeterReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MeterReading" ("createdAt", "id", "source", "value") SELECT "createdAt", "id", "source", "value" FROM "MeterReading";
DROP TABLE "MeterReading";
ALTER TABLE "new_MeterReading" RENAME TO "MeterReading";
CREATE TABLE "new_PlantDiagnosis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcel" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "diseaseKey" TEXT NOT NULL,
    "disease" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "severity" TEXT NOT NULL,
    "advice" TEXT NOT NULL,
    "tips" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'a-traiter',
    "notes" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PlantDiagnosis" ("advice", "confidence", "createdAt", "crop", "disease", "id", "imageUrl", "parcel", "severity") SELECT "advice", "confidence", "createdAt", "crop", "disease", "id", "imageUrl", "parcel", "severity" FROM "PlantDiagnosis";
DROP TABLE "PlantDiagnosis";
ALTER TABLE "new_PlantDiagnosis" RENAME TO "PlantDiagnosis";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
