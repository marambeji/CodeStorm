-- CreateTable
CREATE TABLE "HarvestLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "variety" TEXT,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "parcel" TEXT,
    "placeName" TEXT,
    "lat" REAL,
    "lng" REAL,
    "harvestDate" DATETIME NOT NULL,
    "organic" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "certificate" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'recolte',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HarvestLot_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TraceBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "placeName" TEXT,
    "lat" REAL,
    "lng" REAL,
    "temperature" REAL,
    "quantity" REAL,
    "note" TEXT,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TraceBlock_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "HarvestLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraceBlock_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HarvestLot_code_key" ON "HarvestLot"("code");

-- CreateIndex
CREATE INDEX "HarvestLot_farmerId_idx" ON "HarvestLot"("farmerId");

-- CreateIndex
CREATE INDEX "TraceBlock_actorId_idx" ON "TraceBlock"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "TraceBlock_lotId_index_key" ON "TraceBlock"("lotId", "index");
