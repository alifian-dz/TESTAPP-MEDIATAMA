import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const now = new Date();

    const [pendingRequests, allPermissions, activeRequests] = await Promise.all([
      prisma.accessRequest.count({
        where: {
          status: "PENDING",
          user: { deletedAt: null },
          video: { deletedAt: null },
        },
      }),
      prisma.videoPermission.findMany({
        where: {
          user: { deletedAt: null },
          video: { deletedAt: null },
        },
        orderBy: { grantedAt: "desc" },
        select: {
          id: true,
          userId: true,
          videoId: true,
          startedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
      prisma.accessRequest.findMany({
        where: {
          status: "PENDING",
          user: { deletedAt: null },
          video: { deletedAt: null },
        },
        orderBy: { requestedAt: "desc" },
        select: {
          id: true,
          userId: true,
          videoId: true,
        },
      }),
    ]);

    const pendingPairs = new Set(
      activeRequests.map(
        (r: (typeof activeRequests)[number]) => `${r.userId}:${r.videoId}`
      )
    );
    const latestPermByPair = new Map<
      string,
      { id: string; expiresAt: Date | null; revokedAt: Date | null }
    >();

    for (const perm of allPermissions) {
      const key = `${perm.userId}:${perm.videoId}`;
      const existing = latestPermByPair.get(key);
      if (!existing) {
        latestPermByPair.set(key, perm);
      } else {
        const existingActive =
          existing.revokedAt === null &&
          (existing.expiresAt === null ||
            existing.expiresAt.getTime() > now.getTime());
        const permActive =
          perm.revokedAt === null &&
          (perm.expiresAt === null || perm.expiresAt.getTime() > now.getTime());
        if (permActive && !existingActive) {
          latestPermByPair.set(key, perm);
        }
      }
    }

    const expiredPermissionIds: string[] = [];
    for (const [key, perm] of latestPermByPair.entries()) {
      const isCurrentlyActive =
        perm.revokedAt === null &&
        (perm.expiresAt === null || perm.expiresAt.getTime() > now.getTime());
      if (!isCurrentlyActive && !pendingPairs.has(key)) {
        expiredPermissionIds.push(perm.id);
      }
    }

    const permissionsStateSignature = allPermissions
      .map(
        (p: (typeof allPermissions)[number]) =>
          `${p.id}:${p.startedAt ? p.startedAt.getTime() : 0}:${p.expiresAt ? p.expiresAt.getTime() : 0}:${p.revokedAt ? p.revokedAt.getTime() : 0}`
      )
      .join(",");

    return NextResponse.json({
      pendingRequests,
      pendingRequestIds: activeRequests.map(
        (r: (typeof activeRequests)[number]) => r.id
      ),
      expiredPermissions: expiredPermissionIds.length,
      expiredPermissionIds,
      permissionsStateSignature,
      totalNotifications: pendingRequests + expiredPermissionIds.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch notification counts" },
      { status: 500 }
    );
  }
}
