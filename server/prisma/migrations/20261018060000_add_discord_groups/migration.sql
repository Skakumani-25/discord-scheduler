-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('CUSTOM', 'DISCORD_SERVER');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "discordGuildId" TEXT,
ADD COLUMN     "type" "GroupType" NOT NULL DEFAULT 'CUSTOM';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "discordAccessToken" TEXT,
ADD COLUMN     "discordTokenExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MeetingChannel" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "MeetingChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingChannel_groupId_channelId_key" ON "MeetingChannel"("groupId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_discordGuildId_key" ON "Group"("discordGuildId");

-- AddForeignKey
ALTER TABLE "MeetingChannel" ADD CONSTRAINT "MeetingChannel_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

