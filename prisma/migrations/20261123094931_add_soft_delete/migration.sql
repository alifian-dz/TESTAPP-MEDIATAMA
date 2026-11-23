-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "deletedAt" TIMESTAMP(3);
