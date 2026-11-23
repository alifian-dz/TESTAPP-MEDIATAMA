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

export async function GET() {
  try {
    await requireAdmin();
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
      },
    });

    return NextResponse.json({ videos });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch videos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

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

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "A valid video file is required." },
        { status: 400 }
      );
    }

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
    const storedFileName = `${crypto.randomUUID()}${ext}`;
    const targetPath = resolveVideoPath(storedFileName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(targetPath, Buffer.from(arrayBuffer));

    const video = await prisma.video.create({
      data: {
        title,
        description,
        originalName: file.name,
        storedFileName,
        fileSize: file.size,
        mimeType: file.type,
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Video upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload video." },
      { status: 500 }
    );
  }
}
