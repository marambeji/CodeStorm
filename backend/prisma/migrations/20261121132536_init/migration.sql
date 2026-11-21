-- CreateTable
CREATE TABLE "PlantDiagnosis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcel" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "disease" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "severity" TEXT NOT NULL,
    "advice" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "kwh" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "tiers" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ocr',
    "anomaly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
