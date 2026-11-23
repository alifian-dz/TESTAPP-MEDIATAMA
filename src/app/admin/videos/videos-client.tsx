"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UploadIcon,
  PlayIcon,
  PencilIcon,
  Trash2Icon,
  Loader2Icon,
  VideoIcon,
  SearchIcon,
  HistoryIcon,
  ClockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import { useLanguage } from "@/lib/i18n";

export interface VideoAccessHistoryEntry {
  id: string;
  source: "REQUEST" | "DIRECT_GRANT";
  customerName: string;
  customerEmail: string;
  customerDeleted: boolean;
  requestStatus: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  requestedAt: string | null;
  approvedOrReviewedAt: string | null;
  durationMinutes: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  sortTimestampMs: number;
}

export interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  originalName: string;
  storedFileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  activePermissionsCount: number;
  totalHistoryCount: number;
  accessHistory: VideoAccessHistoryEntry[];
}

function formatFileSizeMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function formatDateTimeWithSeconds(iso: string | null, locale: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
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

export function VideosClient({
  initialVideos,
}: {
  initialVideos: VideoRow[];
}) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Upload Dialog State
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Edit Dialog State
  const [editVideo, setEditVideo] = useState<VideoRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Preview Dialog State
  const [previewVideo, setPreviewVideo] = useState<VideoRow | null>(null);

  // Access History Dialog State
  const [historyVideoId, setHistoryVideoId] = useState<string | null>(null);

  // Delete Dialog State
  const [deleteVideo, setDeleteVideo] = useState<VideoRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const historyVideo =
    initialVideos.find((v) => v.id === historyVideoId) ?? null;

  const filteredVideos = initialVideos.filter((v) => {
    const q = searchQuery.toLowerCase();
    return (
      v.title.toLowerCase().includes(q) ||
      (v.description && v.description.toLowerCase().includes(q)) ||
      v.originalName.toLowerCase().includes(q)
    );
  });

  function openEditDialog(video: VideoRow) {
    setEditVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description || "");
    setEditFile(null);
  }

  async function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!uploadFile) {
      toast.error(
        t(
          "Pilih file video untuk diunggah.",
          "Please select a video file to upload."
        )
      );
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", uploadTitle);
      formData.append("description", uploadDescription);
      formData.append("file", uploadFile);

      const response = await fetch("/api/admin/videos", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error || t("Gagal mengunggah video", "Failed to upload video")
        );
        setIsUploading(false);
        return;
      }

      toast.success(
        t(
          "Video berhasil diunggah ke penyimpanan privat",
          "Video uploaded to private storage"
        )
      );
      setUploadOpen(false);
      setUploadTitle("");
      setUploadDescription("");
      setUploadFile(null);
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat mengunggah video",
          "Network error during video upload"
        )
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editVideo) return;

    setIsEditing(true);
    try {
      const formData = new FormData();
      formData.append("title", editTitle);
      formData.append("description", editDescription);
      if (editFile) {
        formData.append("file", editFile);
      }

      const response = await fetch(`/api/admin/videos/${editVideo.id}`, {
        method: "PATCH",
        body: formData,
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error || t("Gagal memperbarui video", "Failed to update video")
        );
        setIsEditing(false);
        return;
      }

      toast.success(
        t("Video berhasil diperbarui", "Video updated successfully")
      );
      setEditVideo(null);
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat memperbarui video",
          "Network error while updating video"
        )
      );
    } finally {
      setIsEditing(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteVideo) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/videos/${deleteVideo.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error || t("Gagal menghapus video", "Failed to delete video")
        );
        setIsDeleting(false);
        return;
      }

      toast.success(
        t(
          `Video "${deleteVideo.title}" berhasil dihapus (soft delete)`,
          `Soft-deleted video "${deleteVideo.title}"`
        )
      );
      setDeleteVideo(null);
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat menghapus video",
          "Network error while deleting video"
        )
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("Manajemen Video Privat", "Video Vault Management")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Unggah video fisik ke penyimpanan privat server (storage/videos/), lihat riwayat akses customer, pratinjau stream, dan kelola metadata.",
              "Upload physical videos to private server disk (storage/videos/), inspect customer access history, preview streams, and manage metadata."
            )}
          </p>
        </div>

        <Button onClick={() => setUploadOpen(true)}>
          <UploadIcon className="mr-1.5 size-4" />
          {t("Unggah Video", "Upload Video")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {t("Daftar Video Diunggah", "Uploaded Videos")} (
                {filteredVideos.length})
              </CardTitle>
              <CardDescription>
                {t(
                  "Klik tombol \"Riwayat Akses\" pada video untuk melihat detail siapa saja customer yang mengajukan/diberi akses beserta jam:menit:detik lengkap.",
                  "Click \"Access History\" on any video to view all customers who requested or received access with full HH:MM:SS timestamps."
                )}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                placeholder={t(
                  "Cari judul atau nama file...",
                  "Search title or filename..."
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("Judul & Deskripsi", "Title & Description")}
                  </TableHead>
                  <TableHead>Format / MIME</TableHead>
                  <TableHead>{t("Ukuran File", "File Size")}</TableHead>
                  <TableHead>
                    {t("Akses & Riwayat", "Access & History")}
                  </TableHead>
                  <TableHead>{t("Tanggal Unggah", "Upload Date")}</TableHead>
                  <TableHead className="text-right">
                    {t("Aksi", "Actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVideos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-28 text-center text-muted-foreground"
                    >
                      {t(
                        'Belum ada video yang diunggah. Klik "Unggah Video" untuk menambahkan video privat pertama.',
                        'No videos uploaded yet. Click "Upload Video" to add your first private video.'
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVideos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell className="max-w-xs">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <VideoIcon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {video.title}
                            </p>
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {video.description ||
                                t("Tanpa deskripsi", "No description")}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground/80">
                              {video.storedFileName}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{video.mimeType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatFileSizeMB(video.fileSize)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={
                              video.activePermissionsCount > 0
                                ? "default"
                                : "secondary"
                            }
                          >
                            {video.activePermissionsCount}{" "}
                            {t("aktif", "active")}
                          </Badge>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setHistoryVideoId(video.id)}
                          >
                            <HistoryIcon className="mr-1 size-3" />
                            {t("Riwayat Akses", "Access History")} (
                            {video.totalHistoryCount})
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(video.createdAt).toLocaleDateString(locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setPreviewVideo(video)}
                          >
                            <PlayIcon className="mr-1 size-3.5" />
                            {t("Pratinjau", "Preview")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(video)}
                          >
                            <PencilIcon className="mr-1 size-3.5" />
                            {t("Ubah", "Edit")}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteVideo(video)}
                          >
                            <Trash2Icon className="mr-1 size-3.5" />
                            {t("Hapus", "Delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Per-Video Customer Access History Dialog */}
      <Dialog
        open={Boolean(historyVideo)}
        onOpenChange={(open) => !open && setHistoryVideoId(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <HistoryIcon className="size-5 text-primary" />
              {t("Riwayat Akses Video:", "Video Access History:")}{" "}
              <span className="font-bold">{historyVideo?.title}</span>
            </DialogTitle>
            <DialogDescription>
              {t(
                "Detail log siapa saja Customer yang mengajukan atau diberi akses, kapan diajukan, kapan di-ACC, durasi, waktu mulai ditonton (Start), dan waktu habis (Jam:Menit:Detik).",
                "Detailed audit log of all Customers who requested or received access, request time, approval time, duration, watch start time, and exact expiration time (HH:MM:SS)."
              )}
            </DialogDescription>
          </DialogHeader>

          {historyVideo && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Customer", "Customer")}</TableHead>
                    <TableHead>
                      {t("Sumber & Status", "Source & Status")}
                    </TableHead>
                    <TableHead>
                      {t("Waktu Pengajuan", "Requested At")}
                    </TableHead>
                    <TableHead>
                      {t("Waktu Di-ACC / Diberikan", "Approved / Granted At")}
                    </TableHead>
                    <TableHead>{t("Durasi", "Duration")}</TableHead>
                    <TableHead>
                      {t("Waktu Mulai Tonton (Start)", "Watch Started At")}
                    </TableHead>
                    <TableHead>
                      {t(
                        "Waktu Habis / Kedaluwarsa",
                        "Expires / Ended At"
                      )}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyVideo.accessHistory.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-28 text-center text-muted-foreground"
                      >
                        {t(
                          "Belum ada riwayat customer yang mengajukan atau diberi akses pada video ini.",
                          "No customer access requests or permissions recorded for this video yet."
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyVideo.accessHistory.map((entry) => {
                      const isApproved = entry.requestStatus === "APPROVED";
                      const isRevoked = Boolean(entry.revokedAt);
                      const isNotStarted =
                        isApproved && !isRevoked && entry.expiresAt === null;
                      const expiresMs = entry.expiresAt
                        ? new Date(entry.expiresAt).getTime()
                        : 0;
                      const remainingMs =
                        isApproved && !isRevoked && entry.expiresAt !== null
                          ? expiresMs - nowMs
                          : 0;
                      const isCurrentlyActive =
                        isApproved &&
                        !isRevoked &&
                        (isNotStarted || remainingMs > 0);
                      const isExpired =
                        isApproved &&
                        !isRevoked &&
                        !isNotStarted &&
                        remainingMs <= 0;

                      return (
                        <TableRow key={entry.id}>
                          {/* Customer */}
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {entry.customerName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {entry.customerEmail}
                              </span>
                              {entry.customerDeleted && (
                                <Badge
                                  variant="outline"
                                  className="mt-1 w-fit text-[10px] text-destructive"
                                >
                                  {t("Akun Nonaktif", "Deactivated")}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Sumber & Status */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge variant="outline" className="text-[10px]">
                                  {entry.source === "DIRECT_GRANT"
                                    ? "Direct Grant"
                                    : "Via Request"}
                                </Badge>
                                {entry.requestStatus === "PENDING" && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  >
                                    PENDING
                                  </Badge>
                                )}
                                {entry.requestStatus === "REJECTED" && (
                                  <Badge variant="destructive">
                                    {t("DITOLAK", "REJECTED")}
                                  </Badge>
                                )}
                                {isCurrentlyActive && isNotStarted && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  >
                                    {t("SIAP MULAI", "READY TO START")}
                                  </Badge>
                                )}
                                {isCurrentlyActive && !isNotStarted && (
                                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                    {t("SEDANG AKTIF", "ACTIVE")} (
                                    {formatCountdown(remainingMs)})
                                  </Badge>
                                )}
                                {isExpired && (
                                  <Badge variant="secondary">
                                    {t("WAKTU HABIS", "EXPIRED")}
                                  </Badge>
                                )}
                                {isRevoked && (
                                  <Badge variant="destructive">
                                    {t("DICABUT ADMIN", "REVOKED")}
                                  </Badge>
                                )}
                              </div>
                              {entry.note && (
                                <span className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                                  {entry.note}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Waktu Pengajuan */}
                          <TableCell className="font-mono text-xs">
                            {entry.requestedAt ? (
                              formatDateTimeWithSeconds(
                                entry.requestedAt,
                                locale
                              )
                            ) : (
                              <span className="font-sans text-muted-foreground">
                                {t(
                                  "Langsung (Direct Grant)",
                                  "Direct Grant"
                                )}
                              </span>
                            )}
                          </TableCell>

                          {/* Waktu Di-ACC */}
                          <TableCell className="font-mono text-xs">
                            {entry.approvedOrReviewedAt
                              ? formatDateTimeWithSeconds(
                                  entry.approvedOrReviewedAt,
                                  locale
                                )
                              : "-"}
                          </TableCell>

                          {/* Durasi */}
                          <TableCell className="text-xs font-medium">
                            {entry.durationMinutes
                              ? `${entry.durationMinutes} ${t("menit", "mins")}`
                              : "-"}
                          </TableCell>

                          {/* Waktu Mulai Tonton (Start) */}
                          <TableCell className="font-mono text-xs">
                            {entry.startedAt ? (
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                {formatDateTimeWithSeconds(
                                  entry.startedAt,
                                  locale
                                )}
                              </span>
                            ) : isNotStarted ? (
                              <span className="inline-flex items-center gap-1 font-sans text-xs text-amber-700 dark:text-amber-400">
                                <ClockIcon className="size-3" />
                                {t(
                                  "Belum diklik Tonton",
                                  "Not started watching"
                                )}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>

                          {/* Waktu Habis / Kedaluwarsa */}
                          <TableCell className="font-mono text-xs">
                            {isRevoked && entry.revokedAt ? (
                              <div className="flex flex-col">
                                <span className="text-destructive">
                                  {formatDateTimeWithSeconds(
                                    entry.revokedAt,
                                    locale
                                  )}
                                </span>
                                <span className="font-sans text-[10px] text-destructive">
                                  ({t("Dicabut", "Revoked")})
                                </span>
                              </div>
                            ) : entry.expiresAt ? (
                              <span
                                className={
                                  isExpired
                                    ? "text-destructive"
                                    : "font-semibold text-foreground"
                                }
                              >
                                {formatDateTimeWithSeconds(
                                  entry.expiresAt,
                                  locale
                                )}
                              </span>
                            ) : isNotStarted ? (
                              <span className="font-sans text-xs text-muted-foreground">
                                {t(
                                  `Menunggu mulai (+${entry.durationMinutes ?? 0} mnt)`,
                                  `Starts on watch (+${entry.durationMinutes ?? 0}m)`
                                )}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Upload Video Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("Unggah Video Privat", "Upload Private Video")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Format didukung: MP4, WebM, Ogg (Maks 100MB). File disimpan dengan nama UUID di penyimpanan privat lokal.",
                "Supported formats: MP4, WebM, Ogg (Max 100MB). Files are saved with a UUID filename in private local storage."
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upload-title">
                {t("Judul Video", "Video Title")}
              </Label>
              <Input
                id="upload-title"
                placeholder="Onboarding Training Module 1"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-description">
                {t("Deskripsi", "Description")}
              </Label>
              <Textarea
                id="upload-description"
                placeholder={t(
                  "Ringkasan opsional mengenai isi video...",
                  "Optional summary of the video content..."
                )}
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-file">
                {t(
                  "File Video (MP4 / WebM / Ogg, maks 100MB)",
                  "Video File (MP4 / WebM / Ogg, max 100MB)"
                )}
              </Label>
              <Input
                id="upload-file"
                type="file"
                accept="video/mp4,video/webm,video/ogg"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                required
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {t("Terpilih:", "Selected:")}{" "}
                  <strong>{uploadFile.name}</strong> (
                  {formatFileSizeMB(uploadFile.size)})
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUploadOpen(false)}
              >
                {t("Batal", "Cancel")}
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                {t("Unggah Video", "Upload Video")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Video Dialog */}
      <Dialog
        open={Boolean(editVideo)}
        onOpenChange={(open) => !open && setEditVideo(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("Ubah Metadata & File Video", "Edit Video Metadata & File")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Perbarui judul dan deskripsi, atau unggah file video pengganti (menghapus file lama dari disk).",
                "Update title and description, or optionally upload a replacement video file (deletes old file from disk)."
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-video-title">
                {t("Judul Video", "Video Title")}
              </Label>
              <Input
                id="edit-video-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-video-description">
                {t("Deskripsi", "Description")}
              </Label>
              <Textarea
                id="edit-video-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-video-file">
                {t("Ganti File Video", "Replace Video File")}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {t(
                    `(Opsional — kosongkan untuk mempertahankan ${editVideo?.originalName || ""})`,
                    `(Optional — leave empty to keep ${editVideo?.originalName || ""})`
                  )}
                </span>
              </Label>
              <Input
                id="edit-video-file"
                type="file"
                accept="video/mp4,video/webm,video/ogg"
                onChange={(e) => setEditFile(e.target.files?.[0] || null)}
              />
              {editFile && (
                <p className="text-xs text-muted-foreground">
                  {t("File baru:", "New file:")}{" "}
                  <strong>{editFile.name}</strong> (
                  {formatFileSizeMB(editFile.size)})
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditVideo(null)}
              >
                {t("Batal", "Cancel")}
              </Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                {t("Simpan Perubahan", "Save Changes")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Video Preview Dialog */}
      <Dialog
        open={Boolean(previewVideo)}
        onOpenChange={(open) => !open && setPreviewVideo(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("Pratinjau Admin:", "Admin Preview:")} {previewVideo?.title}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Streaming aman dari penyimpanan privat",
                "Streaming securely from private storage"
              )}{" "}
              (<code>{previewVideo?.storedFileName}</code>) •{" "}
              {previewVideo && formatFileSizeMB(previewVideo.fileSize)}
            </DialogDescription>
          </DialogHeader>
          {previewVideo && (
            <div className="overflow-hidden rounded-lg bg-black">
              <video
                key={`${previewVideo.id}-${previewVideo.updatedAt}`}
                controls
                autoPlay
                className="aspect-video w-full"
                src={`/api/videos/${previewVideo.id}/stream`}
              >
                {t(
                  "Browser Anda tidak mendukung pemutaran video HTML5.",
                  "Your browser does not support HTML5 video playback."
                )}
              </video>
            </div>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Delete Video Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteVideo)}
        onOpenChange={(open) => !open && setDeleteVideo(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("Hapus Video (Soft Delete)", "Delete Video (Soft Delete)")}
            </DialogTitle>
            <DialogDescription>
              {t(
                `Apakah Anda yakin ingin menghapus "${deleteVideo?.title || ""}"? Video akan di-soft delete (deletedAt), seluruh izin akses aktif dicabut, dan histori audit tetap terjaga di database.`,
                `Are you sure you want to soft-delete "${deleteVideo?.title || ""}"? The video will be marked deleted (deletedAt), active viewing permissions will be revoked, and audit records will be preserved.`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteVideo(null)}
            >
              {t("Batal", "Cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              {t("Hapus Video", "Delete Video")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
