/*
  Warnings:

  - You are about to drop the column `lgaId` on the `Admin` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[adminId]` on the table `LGA` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,state]` on the table `LGA` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `state` to the `LGA` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Admin" DROP CONSTRAINT "Admin_lgaId_fkey";

-- DropIndex
DROP INDEX "Admin_lgaId_key";

-- AlterTable
ALTER TABLE "Admin" DROP COLUMN "lgaId";

-- AlterTable
ALTER TABLE "LGA" ADD COLUMN     "adminId" TEXT,
ADD COLUMN     "state" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LGA_adminId_key" ON "LGA"("adminId");

-- CreateIndex
CREATE INDEX "LGA_state_idx" ON "LGA"("state");

-- CreateIndex
CREATE UNIQUE INDEX "LGA_name_state_key" ON "LGA"("name", "state");

-- AddForeignKey
ALTER TABLE "LGA" ADD CONSTRAINT "LGA_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
