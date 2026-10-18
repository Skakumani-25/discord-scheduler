-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "announcementChannelId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reminderMinutes" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_sentAt_sendAt_idx" ON "Reminder"("sentAt", "sendAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_eventId_userId_sendAt_key" ON "Reminder"("eventId", "userId", "sendAt");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
