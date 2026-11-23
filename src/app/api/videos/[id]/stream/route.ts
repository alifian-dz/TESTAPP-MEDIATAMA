import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAuth } from "@/lib/auth";
import { resolveVideoPath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createSafeFileReadableStream(
  filePath: string,
  options?: { start: number; end: number }
): ReadableStream<Uint8Array> {
  let fileStream: fs.ReadStream | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      fileStream = fs.createReadStream(filePath, options);

      fileStream.on("data", (chunk: Buffer | string) => {
        const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buffer));
      });

      fileStream.on("end", () => {
        controller.close();
      });

      fileStream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      if (fileStream) {
        fileStream.destroy();
        fileStream = null;
      }
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: videoId } = await context.params;
    const now = new Date();

    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video || video.deletedAt !== null) {
      return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }

    // If customer, strictly enforce that customer is not soft-deleted and holds an active VideoPermission
    if (session.role === "CUSTOMER") {
      const [customerUser, validPermission] = await Promise.all([
        prisma.user.findUnique({
          where: { id: session.userId },
          select: { deletedAt: true },
        }),
        prisma.videoPermission.findFirst({
          where: {
            userId: session.userId,
            videoId,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: { grantedAt: "desc" },
        }),
      ]);

      if (!customerUser || customerUser.deletedAt !== null || !validPermission) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Waktu akses menonton telah habis atau Anda tidak memiliki izin aktif.",
          },
          {
            status: 403,
            headers: {
              "Cache-Control": "private, no-store, no-cache, must-revalidate",
            },
          }
        );
      }

      // Activate countdown if the permission was not yet started
      if (validPermission.expiresAt === null) {
        const expiresAt = new Date(
          now.getTime() + validPermission.durationMinutes * 60 * 1000
        );
        await prisma.videoPermission.update({
          where: { id: validPermission.id },
          data: {
            startedAt: now,
            expiresAt,
          },
        });
      }
    }

    const filePath = resolveVideoPath(video.storedFileName);

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return NextResponse.json(
        { error: "Physical video file not found on server storage." },
        { status: 404 }
      );
    }

    const fileSize = stat.size;
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (!match) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
          },
        });
      }

      const startStr = match[1];
      const endStr = match[2];

      let start = startStr ? parseInt(startStr, 10) : 0;
      let end = endStr ? parseInt(endStr, 10) : fileSize - 1;

      if (!startStr && endStr) {
        const suffixLength = parseInt(endStr, 10);
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      }

      if (
        isNaN(start) ||
        isNaN(end) ||
        start < 0 ||
        end < start ||
        start >= fileSize ||
        end >= fileSize
      ) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
          },
        });
      }

      const chunkSize = end - start + 1;
      const webStream = createSafeFileReadableStream(filePath, { start, end });

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": video.mimeType,
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      });
    }

    const webStream = createSafeFileReadableStream(filePath);

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": video.mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Protected video stream error:", error);
    return NextResponse.json(
      { error: "Failed to stream video." },
      { status: 500 }
    );
  }
}
