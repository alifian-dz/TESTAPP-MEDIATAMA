import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireAuth();
    if (session.role !== "CUSTOMER") {
      return NextResponse.json({ activePermissions: [] });
    }

    const now = new Date();

    const activePermissions = await prisma.videoPermission.findMany({
      where: {
        userId: session.userId,
        revokedAt: null,
        video: { deletedAt: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { grantedAt: "desc" },
      select: {
        id: true,
        videoId: true,
        durationMinutes: true,
        grantedAt: true,
        startedAt: true,
        expiresAt: true,
        video: {
          select: {
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      activePermissions: activePermissions.map((p: (typeof activePermissions)[number]) => ({
        id: p.id,
        videoId: p.videoId,
        videoTitle: p.video.title,
        durationMinutes: p.durationMinutes,
        grantedAt: p.grantedAt.toISOString(),
        startedAt: p.startedAt ? p.startedAt.toISOString() : null,
        expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch customer notifications" },
      { status: 500 }
    );
  }
}
