import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: permissionId } = await context.params;

    const existing = await prisma.videoPermission.findUnique({
      where: { id: permissionId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Data izin akses tidak ditemukan." },
        { status: 404 }
      );
    }

    const now = new Date();

    const permission = await prisma.videoPermission.update({
      where: { id: permissionId },
      data: {
        revokedAt: now,
        expiresAt:
          existing.expiresAt === null || existing.expiresAt > now
            ? now
            : existing.expiresAt,
      },
    });

    return NextResponse.json({ permission });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Revoke permission error:", error);
    return NextResponse.json(
      { error: "Gagal mencabut akses video." },
      { status: 500 }
    );
  }
}
