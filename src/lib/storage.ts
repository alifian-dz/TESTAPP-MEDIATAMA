import path from "path";
import fs from "fs/promises";

export const PRIVATE_VIDEO_DIR = path.join(process.cwd(), "storage", "videos");

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
] as const;

export const MAX_VIDEO_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * Safely resolves a storedFileName inside `storage/videos/` using `path.basename()`
 * to prevent path traversal attacks.
 */
export function resolveVideoPath(storedFileName: string): string {
  const safeBaseName = path.basename(storedFileName);
  if (!safeBaseName || safeBaseName !== storedFileName || safeBaseName.startsWith(".")) {
    throw new Error("Invalid video file name");
  }
  const resolved = path.resolve(PRIVATE_VIDEO_DIR, safeBaseName);
  const rootResolved = path.resolve(PRIVATE_VIDEO_DIR);
  if (!resolved.startsWith(rootResolved + path.sep)) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

export async function ensureVideoStorageDir(): Promise<void> {
  await fs.mkdir(PRIVATE_VIDEO_DIR, { recursive: true });
}

export function getExtensionFromMimeType(mimeType: string, originalName: string): string {
  const extFromMime: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/ogg": ".ogg",
  };
  if (extFromMime[mimeType]) {
    return extFromMime[mimeType];
  }
  const ext = path.extname(path.basename(originalName)).toLowerCase();
  return ext || ".mp4";
}
