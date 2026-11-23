import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: requestId } = await context.params;

    const body = (await request.json()) as {
      durationMinutes?: number;
      note?: string;
    };

    const durationMinutes = Number(body.durationMinutes);
    if (!durationMinutes || isNaN(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json(
        { error: "Durasi akses (dalam menit) harus lebih dari 0." },
        { status: 400 }
      );
    }

    const existingRequest = await prisma.accessRequest.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: "Permintaan akses tidak ditemukan." },
        { status: 404 }
      );
    }

    if (existingRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "Permintaan akses ini sudah pernah diproses." },
        { status: 409 }
      );
    }

    const now = new Date();
    const roundedDurationMinutes = Math.round(durationMinutes);
    const adminNote = body.note?.trim();

    const result = await prisma.$transaction(async (tx) => {
      // Revoke any previous unstarted or active permission for the same (userId, videoId)
      await tx.videoPermission.updateMany({
        where: {
          userId: existingRequest.userId,
          videoId: existingRequest.videoId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: {
          revokedAt: now,
        },
      });

      const updatedRequest = await tx.accessRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedAt: now,
          grantedDurationMinutes: roundedDurationMinutes,
          note: adminNote
            ? existingRequest.note
              ? `${existingRequest.note} | Admin: ${adminNote}`
              : `Admin: ${adminNote}`
            : existingRequest.note,
        },
      });

      // Do NOT set startedAt or expiresAt yet!
      // Countdown only begins when the customer clicks "Tonton Video" / opens the watch page.
      const permission = await tx.videoPermission.create({
        data: {
          userId: existingRequest.userId,
          videoId: existingRequest.videoId,
          requestId: existingRequest.id,
          durationMinutes: roundedDurationMinutes,
          grantedAt: now,
          startedAt: null,
          expiresAt: null,
        },
      });

      return { updatedRequest, permission };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Approve request error:", error);
    return NextResponse.json(
      { error: "Gagal menyetujui permintaan akses." },
      { status: 500 }
    );
  }
}
