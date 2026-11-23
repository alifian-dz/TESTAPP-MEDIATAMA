import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Hanya akun CUSTOMER yang dapat mengajukan permintaan akses." },
        { status: 403 }
      );
    }

    const customer = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { deletedAt: true },
    });

    if (!customer || customer.deletedAt !== null) {
      return NextResponse.json(
        { error: "Akun customer sudah tidak aktif." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      videoId?: string;
      note?: string;
      requestedDurationMinutes?: number;
    };

    const videoId = body.videoId?.trim();
    const note = body.note?.trim() || null;
    const requestedDurationMinutes =
      typeof body.requestedDurationMinutes === "number" &&
      body.requestedDurationMinutes > 0
        ? Math.floor(body.requestedDurationMinutes)
        : null;

    if (!videoId) {
      return NextResponse.json(
        { error: "ID video wajib diisi." },
        { status: 400 }
      );
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video || video.deletedAt !== null) {
      return NextResponse.json(
        { error: "Video tidak ditemukan atau telah dihapus." },
        { status: 404 }
      );
    }

    const now = new Date();

    // Active permission is either not yet started (expiresAt === null) or currently counting down (expiresAt > now)
    const activePermission = await prisma.videoPermission.findFirst({
      where: {
        userId: session.userId,
        videoId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    if (activePermission) {
      return NextResponse.json(
        {
          error:
            "Anda masih memiliki akses aktif untuk video ini. Silakan langsung menonton.",
        },
        { status: 409 }
      );
    }

    const pendingRequest = await prisma.accessRequest.findFirst({
      where: {
        userId: session.userId,
        videoId,
        status: "PENDING",
      },
    });

    if (pendingRequest) {
      return NextResponse.json(
        {
          error:
            "Permintaan akses untuk video ini masih menunggu konfirmasi Admin.",
        },
        { status: 409 }
      );
    }

    const accessRequest = await prisma.accessRequest.create({
      data: {
        userId: session.userId,
        videoId,
        status: "PENDING",
        note,
        requestedDurationMinutes,
      },
    });

    return NextResponse.json({ accessRequest }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Submit access request error:", error);
    return NextResponse.json(
      { error: "Gagal mengirim permintaan akses." },
      { status: 500 }
    );
  }
}
