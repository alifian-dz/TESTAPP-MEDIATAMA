"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ClockIcon,
  AlertTriangleIcon,
  SendIcon,
  Loader2Icon,
  ShieldCheckIcon,
  VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "00:00:00";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

export function WatchPlayerClient({
  video,
  initialIsActive,
  expiresAtIso,
  hasPendingRequest,
}: {
  video: {
    id: string;
    title: string;
    description: string | null;
    mimeType: string;
    fileSize: number;
  };
  initialIsActive: boolean;
  expiresAtIso: string | null;
  hasPendingRequest: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isExpiredOrDenied, setIsExpiredOrDenied] = useState<boolean>(
    !initialIsActive
  );
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (!initialIsActive || !expiresAtIso) return 0;
    return Math.max(0, new Date(expiresAtIso).getTime() - Date.now());
  });

  const [pendingState, setPendingState] = useState<boolean>(hasPendingRequest);
  const [note, setNote] = useState<string>("");
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  const triggerHardCutoff = useCallback(() => {
    const el = videoRef.current;
    if (el) {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load(); // Flushes any pre-buffered video data in the browser media element
      } catch {
        // Ignore cleanup errors
      }
    }
    setIsExpiredOrDenied(true);
    setRemainingMs(0);
  }, []);

  useEffect(() => {
    if (!initialIsActive || !expiresAtIso || isExpiredOrDenied) {
      return;
    }

    const expiresMs = new Date(expiresAtIso).getTime();

    const tick = () => {
      const diff = expiresMs - Date.now();
      if (diff <= 0) {
        triggerHardCutoff();
        toast.error(
          t(
            "Waktu akses menonton Anda telah habis. Pemutaran video dihentikan otomatis.",
            "Your viewing access time has expired. Video playback has been automatically terminated."
          )
        );
      } else {
        setRemainingMs(diff);
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [initialIsActive, expiresAtIso, isExpiredOrDenied, triggerHardCutoff, t]);

  async function handleRequestAgain(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsRequesting(true);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          note:
            note.trim() ||
            t(
              "Permintaan perpanjangan / akses ulang setelah waktu menonton habis.",
              "Requesting access renewal after viewing time expired."
            ),
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error ||
            t(
              "Gagal mengirim permintaan akses ulang.",
              "Failed to submit renewal request."
            )
        );
        setIsRequesting(false);
        return;
      }

      toast.success(
        t(
          "Permintaan akses ulang berhasil dikirim! Menunggu persetujuan Admin.",
          "Access renewal request sent! Awaiting Administrator approval."
        )
      );
      setPendingState(true);
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat mengirim permintaan.",
          "Network error while submitting request."
        )
      );
    } finally {
      setIsRequesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="mr-1.5 size-4" />
            {t("Kembali ke Katalog Video", "Back to Video Catalog")}
          </Button>
        </Link>

        {!isExpiredOrDenied && (
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-2 shadow-xs ${
              remainingMs <= 60_000
                ? "border-destructive/50 bg-destructive/10 text-destructive animate-pulse"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            <ClockIcon className="size-4 shrink-0" />
            <div className="text-xs">
              <span className="font-medium">
                {t("Sisa Waktu Akses:", "Remaining Access Time:")}
              </span>{" "}
              <span className="ml-1 font-mono text-base font-bold">
                {formatCountdown(remainingMs)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Conditional Video Player OR Hard Cutoff Expired Alert Card */}
      {!isExpiredOrDenied ? (
        <Card className="overflow-hidden shadow-md">
          <div className="relative bg-black">
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              controlsList="nodownload"
              onContextMenu={(e) => e.preventDefault()}
              src={`/api/videos/${video.id}/stream`}
              onError={() => {
                triggerHardCutoff();
              }}
              className="aspect-video max-h-[70vh] w-full bg-black"
            >
              {t(
                "Browser Anda tidak mendukung pemutaran video HTML5.",
                "Your browser does not support HTML5 video playback."
              )}
            </video>
          </div>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-xl">{video.title}</CardTitle>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                <ShieldCheckIcon className="mr-1 size-3.5" />
                {t(
                  "Streaming Terproteksi (HTTP 206 Range)",
                  "Protected Stream (HTTP 206 Range)"
                )}
              </Badge>
            </div>
            <CardDescription>
              {video.description ||
                t(
                  "Tidak ada deskripsi tambahan.",
                  "No additional description."
                )}
            </CardDescription>
          </CardHeader>
          <CardContent className="border-t bg-muted/30 pt-4 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {t("Batas Waktu Akses:", "Access Expires At:")}{" "}
                <strong>
                  {expiresAtIso
                    ? new Date(expiresAtIso).toLocaleString(locale)
                    : "-"}
                </strong>
              </span>
              <span>
                {t(
                  "Pemutaran akan otomatis berhenti dan buffer dibersihkan saat waktu mencapai",
                  "Playback automatically stops and memory buffer is flushed when timer hits"
                )}{" "}
                <code>00:00:00</code>.
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mx-auto max-w-xl border-destructive/40 shadow-md">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangleIcon className="size-6" />
            </div>
            <CardTitle className="text-xl">
              {t(
                "Akses Waktu Menonton Telah Habis",
                "Viewing Access Time Has Expired"
              )}
            </CardTitle>
            <CardDescription>
              {t(
                `Batas waktu izin menonton Anda untuk video "${video.title}" telah berakhir atau belum aktif. Pemutaran video dan buffer memori telah dihentikan secara otomatis.`,
                `Your viewing permission for "${video.title}" has expired or is inactive. Video playback and memory buffers have been automatically terminated.`
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {pendingState ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm text-amber-800 dark:text-amber-300">
                <ClockIcon className="mx-auto mb-2 size-5" />
                <p className="font-semibold">
                  {t(
                    "Permintaan Akses Ulang Sedang Diproses",
                    "Access Renewal Request Pending"
                  )}
                </p>
                <p className="mt-1 text-xs">
                  {t(
                    "Permintaan Anda telah masuk ke antrean Admin. Silakan kembali ke dashboard dan tunggu persetujuan Admin.",
                    "Your request has been queued for Administrator review. Please return to the dashboard and wait for approval."
                  )}
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestAgain} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rewatch-note">
                    {t(
                      "Catatan Permintaan Akses Ulang (Opsional)",
                      "Access Renewal Note (Optional)"
                    )}
                  </Label>
                  <Textarea
                    id="rewatch-note"
                    placeholder={t(
                      "Contoh: Waktu menonton habis sebelum selesai, mohon perpanjangan akses...",
                      "e.g., Viewing time expired before finishing, requesting an extension..."
                    )}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isRequesting}
                >
                  {isRequesting ? (
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                  ) : (
                    <SendIcon className="mr-2 size-4" />
                  )}
                  {t("Minta Akses Ulang", "Request Access Again")}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="justify-center border-t pt-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <VideoIcon className="mr-1.5 size-4" />
                {t("Kembali ke Katalog Dashboard", "Return to Dashboard Catalog")}
              </Button>
            </Link>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
