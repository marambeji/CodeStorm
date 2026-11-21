-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'me',
    "name" TEXT NOT NULL,
    "farmName" TEXT,
    "placeName" TEXT,
    "lat" REAL,
    "lng" REAL,
    "updatedAt" DATETIME NOT NULL
);

