"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  VideoIcon,
  PlayIcon,
  ClockIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  XCircleIcon,
  LockIcon,
  SendIcon,
  HistoryIcon,
  Loader2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  RefreshCwIcon,
  BellRingIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EffectiveAccessState } from "@/lib/access";
import { useLanguage } from "@/lib/i18n";

export interface CustomerVideoCardItem {
  id: string;
  title: string;
  description: string | null;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  effectiveState: EffectiveAccessState;
  permissionId: string | null;
  durationMinutes: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  grantedAt: string | null;
  latestRequestNote: string | null;
}

export interface CustomerRequestHistoryItem {
  id: string;
  videoTitle: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  grantedDurationMinutes: number | null;
  requestedAt: string;
  reviewedAt: string | null;
  permissionStartedAt: string | null;
  permissionExpiresAt: string | null;
  permissionRevokedAt: string | null;
}

const SEEN_PERMISSIONS_STORAGE_KEY = "mediatama_seen_permission_ids";

function formatFileSizeMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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

export function CustomerDashboardClient({
  userName,
  videos,
  requestHistory,
}: {
  userName: string;
  videos: CustomerVideoCardItem[];
  requestHistory: CustomerRequestHistoryItem[];
}) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showHistory, setShowHistory] = useState<boolean>(true);
  const seenPermissionIdsRef = useRef<Set<string>>(new Set());

  // Request Modal State
  const [selectedVideo, setSelectedVideo] =
    useState<CustomerVideoCardItem | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load previously notified permission IDs from localStorage and poll for new grants
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SEEN_PERMISSIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) {
          seenPermissionIdsRef.current = new Set(parsed);
        }
      }
    } catch {
      // Ignore storage error
    }

    let mounted = true;

    async function checkNewGrants() {
      try {
        const res = await fetch("/api/customer/notifications", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          activePermissions?: Array<{
            id: string;
            videoId: string;
            videoTitle: string;
            durationMinutes: number;
            startedAt: string | null;
            expiresAt: string | null;
          }>;
        };

        if (!mounted || !data.activePermissions) return;

        let foundNewGrant = false;
        for (const perm of data.activePermissions) {
          if (!seenPermissionIdsRef.current.has(perm.id)) {
            seenPermissionIdsRef.current.add(perm.id);
            foundNewGrant = true;

            toast.success(
              t(
                `Akses Video Disetujui: "${perm.videoTitle}" (${perm.durationMinutes} menit). Waktu hitung mundur baru akan berjalan saat Anda klik Tonton Video!`,
                `Video Access Granted: "${perm.videoTitle}" (${perm.durationMinutes} mins). The countdown timer will only start when you click Watch Video!`
              ),
              { duration: 7000 }
            );
          }
        }

        if (foundNewGrant) {
          try {
            window.localStorage.setItem(
              SEEN_PERMISSIONS_STORAGE_KEY,
              JSON.stringify(Array.from(seenPermissionIdsRef.current))
            );
          } catch {
            // Ignore write error
          }
          router.refresh();
        }
      } catch {
        // Ignore poll error
      }
    }

    checkNewGrants();
    const pollInterval = setInterval(checkNewGrants, 5000);
    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, [router, t]);

  const activeVideos = videos.filter((v) => {
    if (v.effectiveState !== "ACTIVE") return false;
    if (v.expiresAt === null) return true; // Not started yet -> still active
    return new Date(v.expiresAt).getTime() - nowMs > 0;
  });

  const unstartedActiveVideos = activeVideos.filter(
    (v) => v.expiresAt === null
  );

  const pendingRequestsCount = videos.filter(
    (v) => v.effectiveState === "PENDING"
  ).length;

  function openRequestDialog(video: CustomerVideoCardItem) {
    setSelectedVideo(video);
    setNote("");
  }

  async function handleRequestSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedVideo) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: selectedVideo.id,
          note: note.trim() || undefined,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error ||
            t(
              "Gagal mengajukan permintaan akses.",
              "Failed to submit access request."
            )
        );
        setIsSubmitting(false);
        return;
      }

      toast.success(
        t(
          `Permintaan akses untuk "${selectedVideo.title}" berhasil dikirim!`,
          `Access request for "${selectedVideo.title}" submitted!`
        )
      );
      setSelectedVideo(null);
      setNote("");
      router.refresh();
    } catch {
      toast.error(
        t(
          "Terjadi kesalahan jaringan saat mengirim permintaan.",
          "Network error while submitting request."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
  {/* Real-time Notification Banner when Customer has NEWLY Granted Unwatched Access */}
      {unstartedActiveVideos.length > 0 && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <BellRingIcon className="size-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    {t(
                      `Notifikasi Akses Baru: Anda memiliki ${unstartedActiveVideos.length} video yang baru disetujui Admin!`,
                      `New Access Notification: You have ${unstartedActiveVideos.length} newly approved video(s)!`
                    )}
                  </h3>
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    <SparklesIcon className="mr-1 size-3" />
                    {unstartedActiveVideos.length}{" "}
                    {t("Baru Disetujui", "Newly Granted")}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                  {t(
                    `Video (${unstartedActiveVideos.map((v) => `"${v.title}"`).join(", ")}) sudah diberi akses oleh Admin. Waktu hitung mundur TIDAK akan berkurang sebelum Anda mengklik tombol "Tonton Video". Notifikasi ini akan otomatis hilang setelah Anda mulai menonton.`,
                    `Video (${unstartedActiveVideos.map((v) => `"${v.title}"`).join(", ")}) has been granted by Admin. The countdown timer will NOT decrease until you click "Watch Video". This notification will automatically disappear once you start watching.`
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Greeting & Summary Cards */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t(`Selamat Datang, ${userName}`, `Welcome, ${userName}`)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "Jelajahi katalog video, ajukan permintaan akses menonton, dan pantau batas waktu izin menonton Anda.",
              "Browse the video catalog, request viewing permissions, and track your active access time limits."
            )}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t("Total Katalog Video", "Total Catalog Videos")}
              </CardTitle>
              <VideoIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{videos.length}</div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Video tersedia di sistem",
                  "Videos available in the system"
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t("Akses Menonton Aktif", "Active Viewing Passes")}
              </CardTitle>
              <ShieldCheckIcon className="size-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-emerald-600">
                  {activeVideos.length}
                </span>
                {unstartedActiveVideos.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  >
                    {unstartedActiveVideos.length}{" "}
                    {t("Siap Ditonton", "Ready to Start")}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("Video yang sedang terbuka", "Currently unlocked videos")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t("Menunggu Persetujuan", "Pending Approval")}
              </CardTitle>
              <ClockIcon className="size-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingRequestsCount}</div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Permintaan berstatus PENDING",
                  "Requests awaiting admin review"
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Video Catalog Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {t("Katalog Video", "Video Catalog")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(
                "Pilih video untuk ditonton atau ajukan permintaan akses menonton kepada Admin.",
                "Select an unlocked video to watch or request viewing access from an Administrator."
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCwIcon className="mr-1.5 size-3.5" />
            {t("Segarkan Status", "Refresh Status")}
          </Button>
        </div>

        {videos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <VideoIcon className="mb-3 size-10 text-muted-foreground/60" />
              <p className="font-medium">
                {t("Belum Ada Video Tersedia", "No Videos Available Yet")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Administrator belum mengunggah video ke dalam katalog.",
                  "The administrator has not uploaded any videos to the catalog yet."
                )}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => {
              const isStarted = video.expiresAt !== null;
              const expiresMs = video.expiresAt
                ? new Date(video.expiresAt).getTime()
                : 0;
              const remainingMs = isStarted ? expiresMs - nowMs : 0;

              // Only transition ACTIVE -> EXPIRED if it HAS started and remainingMs <= 0
              const currentState: EffectiveAccessState =
                video.effectiveState === "ACTIVE" &&
                isStarted &&
                remainingMs <= 0
                  ? "EXPIRED"
                  : video.effectiveState;

              const unstartedDurationMs =
                (video.durationMinutes ?? 60) * 60 * 1000;

              return (
                <Card
                  key={video.id}
                  className="flex flex-col justify-between transition-shadow hover:shadow-md"
                >
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <VideoIcon className="size-5" />
                      </div>
                      {currentState === "ACTIVE" && !isStarted && (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          <SparklesIcon className="mr-1 size-3" />
                          {t(
                            "Akses Diberikan (Siap Mulai)",
                            "Access Granted (Ready)"
                          )}
                        </Badge>
                      )}
                      {currentState === "ACTIVE" && isStarted && (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          <ShieldCheckIcon className="mr-1 size-3" />
                          {t("Akses Aktif", "Active Access")}
                        </Badge>
                      )}
                      {currentState === "PENDING" && (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        >
                          <ClockIcon className="mr-1 size-3" />
                          {t(
                            "Menunggu Konfirmasi Admin",
                            "Awaiting Admin Approval"
                          )}
                        </Badge>
                      )}
                      {currentState === "EXPIRED" && (
                        <Badge variant="destructive">
                          <AlertCircleIcon className="mr-1 size-3" />
                          {t("Waktu Akses Habis", "Access Expired")}
                        </Badge>
                      )}
                      {currentState === "REJECTED" && (
                        <Badge variant="destructive">
                          <XCircleIcon className="mr-1 size-3" />
                          {t("Permintaan Ditolak", "Request Rejected")}
                        </Badge>
                      )}
                      {currentState === "NO_ACCESS" && (
                        <Badge variant="outline">
                          <LockIcon className="mr-1 size-3" />
                          {t("Belum Ada Akses", "No Access")}
                        </Badge>
                      )}
                    </div>

                    <div>
                      <CardTitle className="line-clamp-1 text-base">
                        {video.title}
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs">
                        {video.description ||
                          t(
                            "Tidak ada deskripsi video.",
                            "No video description provided."
                          )}
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
                      <span>
                        Format:{" "}
                        {video.mimeType.replace("video/", "").toUpperCase()}
                      </span>
                      <span className="font-mono">
                        {formatFileSizeMB(video.fileSize)}
                      </span>
                    </div>

                    {/* Case 1: ACTIVE & NOT STARTED YET (Timer is paused at full duration!) */}
                    {currentState === "ACTIVE" && !isStarted && (
                      <div className="space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-emerald-800 dark:text-emerald-300">
                            {t("Kuota Durasi:", "Granted Duration:")}
                          </span>
                          <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            {formatCountdown(unstartedDurationMs)} (
                            {video.durationMinutes ?? 60} {t("mnt", "min")})
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90">
                          {t(
                            "⏸ Waktu belum berkurang. Hitung mundur dimulai saat klik Tonton Video.",
                            "⏸ Timer paused. Countdown starts when you click Watch Video."
                          )}
                        </p>
                      </div>
                    )}

                    {/* Case 2: ACTIVE & STARTED (Live countdown running) */}
                    {currentState === "ACTIVE" &&
                      isStarted &&
                      remainingMs > 0 && (
                        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                          <span className="font-medium text-emerald-800 dark:text-emerald-300">
                            {t(
                              "Sisa Waktu Menonton:",
                              "Remaining Watch Time:"
                            )}
                          </span>
                          <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            {formatCountdown(remainingMs)}
                          </span>
                        </div>
                      )}

                    {currentState === "EXPIRED" && video.expiresAt && (
                      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {t("Berakhir pada:", "Expired at:")}{" "}
                        {new Date(video.expiresAt).toLocaleString(locale)}
                      </div>
                    )}

                    {currentState === "REJECTED" && video.latestRequestNote && (
                      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {t("Catatan:", "Note:")} {video.latestRequestNote}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="border-t pt-3">
                    {currentState === "ACTIVE" && (
                      <Link
                        href={`/dashboard/watch/${video.id}`}
                        className="w-full"
                      >
                        <Button className="w-full" size="default">
                          <PlayIcon className="mr-1.5 size-4" />
                          {!isStarted
                            ? t(
                                "Tonton Video (Mulai Waktu)",
                                "Watch Video (Start Timer)"
                              )
                            : t("Lanjutkan Menonton", "Continue Watching")}
                        </Button>
                      </Link>
                    )}

                    {currentState === "PENDING" && (
                      <Button className="w-full" variant="secondary" disabled>
                        <ClockIcon className="mr-1.5 size-4" />
                        {t(
                          "Menunggu Konfirmasi Admin",
                          "Awaiting Admin Approval"
                        )}
                      </Button>
                    )}

                    {currentState === "NO_ACCESS" && (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => openRequestDialog(video)}
                      >
                        <SendIcon className="mr-1.5 size-4" />
                        {t("Minta Akses Menonton", "Request Viewing Access")}
                      </Button>
                    )}

                    {(currentState === "EXPIRED" ||
                      currentState === "REJECTED") && (
                      <Button
                        className="w-full"
                        variant="default"
                        onClick={() => openRequestDialog(video)}
                      >
                        <SendIcon className="mr-1.5 size-4" />
                        {t("Minta Akses Ulang", "Request Access Again")}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Request History Section */}
      <section className="space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HistoryIcon className="size-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">
                    {t("Riwayat Permintaan Akses", "Access Request History")} (
                    {requestHistory.length})
                  </CardTitle>
                  <CardDescription>
                    {t(
                      "Daftar riwayat pengajuan akses video beserta status dan batas waktu kedaluwarsa.",
                      "Complete audit log of your video access requests, approval status, and expiration times."
                    )}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory((prev) => !prev)}
              >
                {showHistory ? (
                  <>
                    {t("Sembunyikan", "Hide")}{" "}
                    <ChevronUpIcon className="ml-1 size-4" />
                  </>
                ) : (
                  <>
                    {t("Tampilkan", "Show")}{" "}
                    <ChevronDownIcon className="ml-1 size-4" />
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showHistory && (
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Judul Video", "Video Title")}</TableHead>
                      <TableHead>
                        {t("Waktu Request", "Requested At")}
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        {t("Durasi Disetujui", "Granted Duration")}
                      </TableHead>
                      <TableHead>
                        {t("Batas Waktu Akses", "Access Expiration")}
                      </TableHead>
                      <TableHead>{t("Catatan", "Note")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestHistory.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-muted-foreground"
                        >
                          {t(
                            "Belum ada riwayat permintaan akses video.",
                            "No video access request history yet."
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      requestHistory.map((item) => {
                        const isNotStartedYet =
                          item.status === "APPROVED" &&
                          !item.permissionRevokedAt &&
                          item.permissionExpiresAt === null;
                        const isExpired =
                          item.permissionExpiresAt &&
                          new Date(item.permissionExpiresAt).getTime() <= nowMs;
                        const isRevoked = Boolean(item.permissionRevokedAt);

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.videoTitle}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(item.requestedAt).toLocaleString(
                                locale
                              )}
                            </TableCell>
                            <TableCell>
                              {item.status === "PENDING" && (
                                <Badge variant="secondary">PENDING</Badge>
                              )}
                              {item.status === "APPROVED" && (
                                <Badge
                                  variant={
                                    isRevoked || isExpired
                                      ? "outline"
                                      : "default"
                                  }
                                >
                                  {isRevoked
                                    ? t("DICABUT ADMIN", "REVOKED")
                                    : isNotStartedYet
                                      ? t(
                                          "DISETUJUI (BELUM DIMULAI)",
                                          "APPROVED (NOT STARTED)"
                                        )
                                      : isExpired
                                        ? t(
                                            "APPROVED (HABIS)",
                                            "APPROVED (EXPIRED)"
                                          )
                                        : t(
                                            "APPROVED (AKTIF)",
                                            "APPROVED (ACTIVE)"
                                          )}
                                </Badge>
                              )}
                              {item.status === "REJECTED" && (
                                <Badge variant="destructive">REJECTED</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {item.grantedDurationMinutes
                                ? `${item.grantedDurationMinutes} ${t("menit", "mins")}`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {isNotStartedYet
                                ? t(
                                    "Menunggu klik Tonton Video",
                                    "Waiting for first watch"
                                  )
                                : item.permissionExpiresAt
                                  ? new Date(
                                      item.permissionExpiresAt
                                    ).toLocaleString(locale)
                                  : "-"}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                              {item.note || "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      </section>

      {/* Request Access Dialog */}
      <Dialog
        open={Boolean(selectedVideo)}
        onOpenChange={(open) => !open && setSelectedVideo(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedVideo?.effectiveState === "EXPIRED" ||
              selectedVideo?.effectiveState === "REJECTED"
                ? t("Minta Akses Menonton Ulang", "Request Video Access Again")
                : t("Minta Akses Menonton Video", "Request Video Access")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Ajukan permintaan kepada Admin untuk membuka akses menonton video",
                "Submit a request to the Administrator to unlock viewing access for"
              )}{" "}
              <strong>{selectedVideo?.title}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="request-note">
                {t("Catatan / Alasan Permintaan", "Request Note / Reason")}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({t("Opsional", "Optional")})
                </span>
              </Label>
              <Textarea
                id="request-note"
                placeholder={t(
                  "Contoh: Mohon izin akses menonton materi training ini...",
                  "e.g., Requesting permission to watch this training module..."
                )}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedVideo(null)}
              >
                {t("Batal", "Cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                {t("Kirim Permintaan", "Submit Request")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
