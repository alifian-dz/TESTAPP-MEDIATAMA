-- AlterTable
ALTER TABLE "video_permissions" ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ALTER COLUMN "expiresAt" DROP NOT NULL;
