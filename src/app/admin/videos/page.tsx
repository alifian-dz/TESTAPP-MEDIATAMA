import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  VideosClient,
  VideoRow,
  VideoAccessHistoryEntry,
} from "./videos-client";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  await requireAdminPage();
  const now = new Date();

  const videos = await prisma.video.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          videoPermissions: {
            where: {
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              user: { deletedAt: null },
            },
          },
        },
      },
      accessRequests: {
        orderBy: { requestedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              deletedAt: true,
            },
          },
          videoPermission: true,
        },
      },
      videoPermissions: {
        orderBy: { grantedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              deletedAt: true,
            },
          },
          accessRequest: true,
        },
      },
    },
  });

  const serialized: VideoRow[] = videos.map(
    (v: (typeof videos)[number]) => {
      // Combine request-based entries and direct-grant permission entries into a unified chronological history
      const historyEntries: VideoAccessHistoryEntry[] = [];

      // 1. All AccessRequests (with their linked VideoPermission if approved)
      for (const req of v.accessRequests) {
        const perm = req.videoPermission;
        historyEntries.push({
          id: `req-${req.id}`,
          source: "REQUEST",
          customerName: req.user.name,
          customerEmail: req.user.email,
          customerDeleted: req.user.deletedAt !== null,
          requestStatus: req.status,
          note: req.note,
          requestedAt: req.requestedAt.toISOString(),
          approvedOrReviewedAt: req.reviewedAt
            ? req.reviewedAt.toISOString()
            : perm
              ? perm.grantedAt.toISOString()
              : null,
          durationMinutes:
            perm?.durationMinutes ?? req.grantedDurationMinutes ?? null,
          startedAt: perm?.startedAt ? perm.startedAt.toISOString() : null,
          expiresAt: perm?.expiresAt ? perm.expiresAt.toISOString() : null,
          revokedAt: perm?.revokedAt ? perm.revokedAt.toISOString() : null,
          sortTimestampMs: req.requestedAt.getTime(),
        });
      }

      // 2. Direct Grant VideoPermissions (where requestId === null)
      for (const perm of v.videoPermissions) {
        if (perm.requestId === null) {
          historyEntries.push({
            id: `perm-${perm.id}`,
            source: "DIRECT_GRANT",
            customerName: perm.user.name,
            customerEmail: perm.user.email,
            customerDeleted: perm.user.deletedAt !== null,
            requestStatus: "APPROVED",
            note: "Direct Grant (Tanpa Request)",
            requestedAt: null,
            approvedOrReviewedAt: perm.grantedAt.toISOString(),
            durationMinutes: perm.durationMinutes,
            startedAt: perm.startedAt ? perm.startedAt.toISOString() : null,
            expiresAt: perm.expiresAt ? perm.expiresAt.toISOString() : null,
            revokedAt: perm.revokedAt ? perm.revokedAt.toISOString() : null,
            sortTimestampMs: perm.grantedAt.getTime(),
          });
        }
      }

      historyEntries.sort((a, b) => b.sortTimestampMs - a.sortTimestampMs);

      return {
        id: v.id,
        title: v.title,
        description: v.description,
        originalName: v.originalName,
        storedFileName: v.storedFileName,
        fileSize: v.fileSize,
        mimeType: v.mimeType,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        activePermissionsCount: v._count.videoPermissions,
        totalHistoryCount: historyEntries.length,
        accessHistory: historyEntries,
      };
    }
  );

  return <VideosClient initialVideos={serialized} />;
}
