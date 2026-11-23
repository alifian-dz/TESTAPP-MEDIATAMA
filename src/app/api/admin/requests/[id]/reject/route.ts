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

    let adminNote: string | undefined;
    try {
      const body = (await request.json()) as { note?: string };
      adminNote = body.note?.trim();
    } catch {
      // Optional JSON body
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
    const updatedRequest = await prisma.accessRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedAt: now,
        note: adminNote
          ? existingRequest.note
            ? `${existingRequest.note} | Alasan Tolak: ${adminNote}`
            : `Alasan Tolak: ${adminNote}`
          : existingRequest.note,
      },
    });

    return NextResponse.json({ updatedRequest });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Reject request error:", error);
    return NextResponse.json(
      { error: "Gagal menolak permintaan akses." },
      { status: 500 }
    );
  }
}
