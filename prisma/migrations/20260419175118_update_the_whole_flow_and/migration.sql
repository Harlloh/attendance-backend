/*
  Warnings:

  - You are about to drop the column `cdsGroup` on the `Session` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[checkInSlug]` on the table `LGA` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `checkInSlug` to the `LGA` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "LGA_name_state_key";

-- DropIndex
DROP INDEX "LGA_state_idx";

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LGA" ADD COLUMN     "checkInSlug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "cdsGroup",
ADD COLUMN     "autoCloseAt" TIMESTAMP(3),
ADD COLUMN     "autoOpenAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "LGA_checkInSlug_key" ON "LGA"("checkInSlug");
