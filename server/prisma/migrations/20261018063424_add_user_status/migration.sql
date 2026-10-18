-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('AVAILABLE', 'BUSY', 'AWAY', 'DND');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus",
ADD COLUMN     "statusExpiresAt" TIMESTAMP(3),
ADD COLUMN     "statusNote" TEXT;
