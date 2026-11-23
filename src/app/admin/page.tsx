import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminOverviewClient } from "./admin-overview-client";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const now = new Date();

  const [customerCount, videoCount, pendingRequestCount, activePermissionCount] =
    await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null } }),
      prisma.video.count({ where: { deletedAt: null } }),
      prisma.accessRequest.count({
        where: {
          status: "PENDING",
          user: { deletedAt: null },
          video: { deletedAt: null },
        },
      }),
      prisma.videoPermission.count({
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          user: { deletedAt: null },
          video: { deletedAt: null },
        },
      }),
    ]);

  return (
    <AdminOverviewClient
      customerCount={customerCount}
      videoCount={videoCount}
      pendingRequestCount={pendingRequestCount}
      activePermissionCount={activePermissionCount}
    />
  );
}
