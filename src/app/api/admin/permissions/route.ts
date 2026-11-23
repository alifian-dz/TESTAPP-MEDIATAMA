import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = (await request.json()) as {
      userId?: string;
      videoId?: string;
      userIds?: string[];
      videoIds?: string[];
      durationMinutes?: number;
    };

    const rawUserIds = Array.isArray(body.userIds)
      ? body.userIds
      : body.userId
        ? [body.userId]
        : [];
    const rawVideoIds = Array.isArray(body.videoIds)
      ? body.videoIds
      : body.videoId
        ? [body.videoId]
        : [];

    const userIds = Array.from(
      new Set(rawUserIds.map((id) => id.trim()).filter(Boolean))
    );
    const videoIds = Array.from(
      new Set(rawVideoIds.map((id) => id.trim()).filter(Boolean))
    );
    const durationMinutes = Number(body.durationMinutes);

    if (userIds.length === 0 || videoIds.length === 0) {
      return NextResponse.json(
        { error: "Minimal 1 Customer dan 1 Video wajib dipilih." },
        { status: 400 }
      );
    }

    if (!durationMinutes || isNaN(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json(
        { error: "Durasi akses (dalam menit) harus lebih dari 0." },
        { status: 400 }
      );
    }

    const [validCustomers, validVideos] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: { in: userIds },
          role: "CUSTOMER",
          deletedAt: null,
        },
        select: { id: true },
      }),
      prisma.video.findMany({
        where: {
          id: { in: videoIds },
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);

    if (validCustomers.length === 0) {
      return NextResponse.json(
        { error: "Customer yang dipilih tidak valid atau telah dihapus." },
        { status: 404 }
      );
    }

    if (validVideos.length === 0) {
      return NextResponse.json(
        { error: "Video yang dipilih tidak ditemukan atau telah dihapus." },
        { status: 404 }
      );
    }

    const now = new Date();
    const roundedDurationMinutes = Math.round(durationMinutes);

    const createdPermissions = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const customer of validCustomers) {
        for (const video of validVideos) {
          // Revoke any overlapping unstarted or active permission for this (userId, videoId) pair
          await tx.videoPermission.updateMany({
            where: {
              userId: customer.id,
              videoId: video.id,
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            data: {
              revokedAt: now,
            },
          });

          // Automatically resolve any PENDING request for this (userId, videoId) pair
          const pendingReq = await tx.accessRequest.findFirst({
            where: {
              userId: customer.id,
              videoId: video.id,
              status: "PENDING",
            },
            orderBy: { requestedAt: "desc" },
          });

          let linkedRequestId: string | null = null;
          if (pendingReq) {
            await tx.accessRequest.update({
              where: { id: pendingReq.id },
              data: {
                status: "APPROVED",
                reviewedAt: now,
                grantedDurationMinutes: roundedDurationMinutes,
                note: pendingReq.note
                  ? `${pendingReq.note} (Disetujui via Direct Grant)`
                  : "Disetujui via Direct Grant",
              },
            });
            linkedRequestId = pendingReq.id;
          }

          // Countdown does not start until customer opens Watch Video
          const perm = await tx.videoPermission.create({
            data: {
              userId: customer.id,
              videoId: video.id,
              requestId: linkedRequestId,
              durationMinutes: roundedDurationMinutes,
              grantedAt: now,
              startedAt: null,
              expiresAt: null,
            },
          });

          results.push(perm);
        }
      }

      return results;
    });

    return NextResponse.json(
      {
        permissions: createdPermissions,
        grantedCount: createdPermissions.length,
        customerCount: validCustomers.length,
        videoCount: validVideos.length,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Direct grant permission error:", error);
    return NextResponse.json(
      { error: "Gagal memberikan akses langsung." },
      { status: 500 }
    );
  }
}
