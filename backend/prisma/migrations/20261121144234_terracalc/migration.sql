-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "climate" TEXT NOT NULL,
    "droughtTolerance" TEXT NOT NULL,
    "rowSpacingM" REAL,
    "treeSpacingM" REAL,
    "waterM3PerTreeYear" REAL,
    "firstProductionAge" INTEGER,
    "fullProductionAge" INTEGER,
    "fullYieldKgPerTree" REAL,
    "lifespanYears" INTEGER,
    "plantCostEur" REAL,
    "maintenanceEurPerTreeYr" REAL,
    "co2KgPerTreeYear" REAL,
    "yieldKgPerHa" REAL,
    "waterM3PerHaYear" REAL,
    "costEurPerHa" REAL,
    "co2KgPerHaYear" REAL,
    "pricePerKgEur" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Terrain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "polygon" TEXT NOT NULL,
    "areaM2" REAL NOT NULL,
    "perimeterM" REAL NOT NULL,
    "centroidLat" REAL NOT NULL,
    "centroidLng" REAL NOT NULL,
    "speciesId" TEXT,
    "plantingYear" INTEGER,
    "rowSpacingM" REAL,
    "treeSpacingM" REAL,
    "irrigation" TEXT,
    "pricePerKg" REAL,
    "estimate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Terrain_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
