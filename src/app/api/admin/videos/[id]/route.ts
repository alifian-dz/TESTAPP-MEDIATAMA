import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";
import {
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_VIDEO_FILE_SIZE_BYTES,
  ensureVideoStorageDir,
  getExtensionFromMimeType,
  resolveVideoPath,
} from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const existing = await prisma.video.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const title = (formData.get("title") as string | null)?.trim();
    const descriptionRaw = (formData.get("description") as string | null)?.trim();
    const description = descriptionRaw ? descriptionRaw : null;
    const file = formData.get("file");

    if (!title) {
      return NextResponse.json(
        { error: "Video title is required." },
        { status: 400 }
      );
    }

    const updateData: {
      title: string;
      description: string | null;
      originalName?: string;
      storedFileName?: string;
      fileSize?: number;
      mimeType?: string;
    } = {
      title,
      description,
    };

    let oldStoredFileNameToDelete: string | null = null;

    if (file instanceof File && file.size > 0) {
      if (
        !ALLOWED_VIDEO_MIME_TYPES.includes(
          file.type as (typeof ALLOWED_VIDEO_MIME_TYPES)[number]
        )
      ) {
        return NextResponse.json(
          {
            error: `Unsupported video format (${file.type || "unknown"}). Allowed formats: MP4, WebM, Ogg.`,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: "Video file exceeds the 100MB maximum size limit." },
          { status: 400 }
        );
      }

      await ensureVideoStorageDir();

      const ext = getExtensionFromMimeType(file.type, file.name);
      const newStoredFileName = `${crypto.randomUUID()}${ext}`;
      const newTargetPath = resolveVideoPath(newStoredFileName);

      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(newTargetPath, Buffer.from(arrayBuffer));

      updateData.originalName = file.name;
      updateData.storedFileName = newStoredFileName;
      updateData.fileSize = file.size;
      updateData.mimeType = file.type;
      oldStoredFileNameToDelete = existing.storedFileName;
    }

    const video = await prisma.video.update({
      where: { id },
      data: updateData,
    });

    if (oldStoredFileNameToDelete) {
      try {
        const oldFilePath = resolveVideoPath(oldStoredFileNameToDelete);
        await fs.unlink(oldFilePath);
      } catch {
        // Ignore if previous physical file was already missing
      }
    }

    return NextResponse.json({ video });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Update video error:", error);
    return NextResponse.json(
      { error: "Failed to update video." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const existing = await prisma.video.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }

    const now = new Date();

    // Soft delete the video record, revoke active permissions, and reject pending requests
    await prisma.$transaction([
      prisma.video.update({
        where: { id },
        data: { deletedAt: now },
      }),
      prisma.videoPermission.updateMany({
        where: {
          videoId: id,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: {
          revokedAt: now,
          expiresAt: now,
        },
      }),
      prisma.accessRequest.updateMany({
        where: {
          videoId: id,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          reviewedAt: now,
          note: "Video archived (soft deleted) by Administrator.",
        },
      }),
    ]);

    return NextResponse.json({ success: true, softDeleted: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Soft delete video error:", error);
    return NextResponse.json(
      { error: "Failed to delete video." },
      { status: 500 }
    );
  }
}
