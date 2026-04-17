/*
  Warnings:

  - You are about to drop the column `lgaLatitude` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `lgaLongitude` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `lgaName` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `radius` on the `Admin` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[lgaId]` on the table `Admin` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `lgaId` to the `Admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lgaId` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Admin_lgaLatitude_key";

-- DropIndex
DROP INDEX "Admin_lgaLongitude_key";

-- AlterTable
ALTER TABLE "Admin" DROP COLUMN "lgaLatitude",
DROP COLUMN "lgaLongitude",
DROP COLUMN "lgaName",
DROP COLUMN "radius",
ADD COLUMN     "lgaId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "lgaId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "LGA" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radius" INTEGER,
    "updatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LGA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LGA_name_key" ON "LGA"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_lgaId_key" ON "Admin"("lgaId");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
