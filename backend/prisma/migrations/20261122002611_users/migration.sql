
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Profile";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "farmName" TEXT,
    "placeName" TEXT,
    "lat" REAL,
    "lng" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Compte de démo : reçoit toutes les données existantes (mot de passe : Demo2026!)
INSERT INTO "User" ("id", "email", "passwordHash", "name", "farmName", "placeName", "lat", "lng", "createdAt")
VALUES ('demo-user', 'demo@econexus.app', '$scrypt$ln=17,r=8,p=1$NX341USN6SyNJaJkXu8Q3g$UcDg6RHXXPmvSpeizp0CcSSNjb/Opki9pF0XLinWTmE', 'Agriculteur démo', 'Ferme de démonstration', 'Sfax', 34.74, 10.76, CURRENT_TIMESTAMP);


-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IrrigationPlan" (
    "userId" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IrrigationPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_IrrigationPlan" ("userId", "areaM2", "createdAt", "doneDays", "id", "irrigation", "kwhPrice", "lat", "lng", "name", "plan", "plantingYear", "pumpHeadM", "speciesId", "terrainId", "trees", "updatedAt") SELECT 'demo-user', "areaM2", "createdAt", "doneDays", "id", "irrigation", "kwhPrice", "lat", "lng", "name", "plan", "plantingYear", "pumpHeadM", "speciesId", "terrainId", "trees", "updatedAt" FROM "IrrigationPlan";
DROP TABLE "IrrigationPlan";
ALTER TABLE "new_IrrigationPlan" RENAME TO "IrrigationPlan";
CREATE INDEX "IrrigationPlan_userId_idx" ON "IrrigationPlan"("userId");
CREATE TABLE "new_Meter" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Meter" ("userId", "createdAt", "id", "location", "name") SELECT 'demo-user', "createdAt", "id", "location", "name" FROM "Meter";
DROP TABLE "Meter";
ALTER TABLE "new_Meter" RENAME TO "Meter";
CREATE INDEX "Meter_userId_idx" ON "Meter"("userId");
CREATE TABLE "new_PlantDiagnosis" (
    "userId" TEXT NOT NULL,
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
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlantDiagnosis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlantDiagnosis" ("userId", "advice", "confidence", "createdAt", "crop", "details", "disease", "diseaseKey", "id", "imageUrl", "notes", "parcel", "severity", "status", "tips", "updatedAt") SELECT 'demo-user', "advice", "confidence", "createdAt", "crop", "details", "disease", "diseaseKey", "id", "imageUrl", "notes", "parcel", "severity", "status", "tips", "updatedAt" FROM "PlantDiagnosis";
DROP TABLE "PlantDiagnosis";
ALTER TABLE "new_PlantDiagnosis" RENAME TO "PlantDiagnosis";
CREATE INDEX "PlantDiagnosis_userId_idx" ON "PlantDiagnosis"("userId");
CREATE TABLE "new_Terrain" (
    "userId" TEXT NOT NULL,
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
    CONSTRAINT "Terrain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Terrain_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Terrain" ("userId", "areaM2", "centroidLat", "centroidLng", "createdAt", "estimate", "id", "irrigation", "name", "perimeterM", "plantingYear", "polygon", "pricePerKg", "rowSpacingM", "speciesId", "treeSpacingM", "updatedAt") SELECT 'demo-user', "areaM2", "centroidLat", "centroidLng", "createdAt", "estimate", "id", "irrigation", "name", "perimeterM", "plantingYear", "polygon", "pricePerKg", "rowSpacingM", "speciesId", "treeSpacingM", "updatedAt" FROM "Terrain";
DROP TABLE "Terrain";
ALTER TABLE "new_Terrain" RENAME TO "Terrain";
CREATE INDEX "Terrain_userId_idx" ON "Terrain"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

