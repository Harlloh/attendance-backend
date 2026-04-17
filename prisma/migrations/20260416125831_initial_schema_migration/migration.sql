-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "queueNumber" INTEGER NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "addedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "lgaName" TEXT NOT NULL,
    "lgaLatitude" DOUBLE PRECISION NOT NULL,
    "lgaLongitude" DOUBLE PRECISION NOT NULL,
    "radius" INTEGER NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "cdsGroup" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_stateCode_key" ON "AttendanceRecord"("sessionId", "stateCode");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_queueNumber_key" ON "AttendanceRecord"("sessionId", "queueNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_deviceFingerprint_key" ON "AttendanceRecord"("sessionId", "deviceFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_lgaLatitude_key" ON "Admin"("lgaLatitude");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_lgaLongitude_key" ON "Admin"("lgaLongitude");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
