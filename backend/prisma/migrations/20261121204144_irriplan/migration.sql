-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "HydroObservation";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Invoice";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "IrrigationPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "terrainId" TEXT,
    "speciesId" TEXT NOT NULL,
    "areaM2" REAL NOT NULL,
    "trees" INTEGER,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "irrigation" TEXT NOT NULL,
    "plantingYear" INTEGER,
    "pumpHeadM" REAL NOT NULL DEFAULT 30,
    "kwhPrice" REAL NOT NULL DEFAULT 0.25,
    "plan" TEXT NOT NULL,
    "doneDays" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

