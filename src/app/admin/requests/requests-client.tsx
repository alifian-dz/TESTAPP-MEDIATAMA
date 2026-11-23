"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  PlusCircleIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  getSeenExpiredPermissionIds,
  markExpiredPermissionsAsSeen,
} from "@/components/admin-nav";

export interface AdminAccessRequestRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  videoId: string;
  videoTitle: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  grantedDurationMinutes: number | null;
  requestedAt: string;
  reviewedAt: string | null;
}

export interface AdminPermissionRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  videoId: string;
  videoTitle: string;
  requestId: string | null;
  durationMinutes: number;
  grantedAt: string;
  startedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface SimpleCustomerOption {
  id: string;
  name: string;
  email: string;
}

export interface SimpleVideoOption {
  id: string;
  title: string;
}

type DurationUnit = "minutes" | "hours" | "days";

function convertToMinutes(value: number, unit: DurationUnit): number {
  if (unit === "hours") return value * 60;
  if (unit === "days") return value * 1440;
  return value;
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

export function AdminRequestsClient({
  requests,
  permissions,
  customers,
  videos,
}: {
  requests: AdminAccessRequestRow[];
  permissions: AdminPermissionRow[];
  customers: SimpleCustomerOption[];
  videos: SimpleVideoOption[];
}) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [activeTab, setActiveTab] = useState<"requests" | "permissions">(
    "requests"
  );
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED"
  >("ALL");

  const durationPresets = [
    { label: t("1 Menit (Testing)", "1 Min (Testing)"), minutes: 1 },
    { label: t("5 Menit", "5 Mins"), minutes: 5 },
    { label: t("1 Jam", "1 Hour"), minutes: 60 },
    { label: t("24 Jam (1 Hari)", "24 Hours (1 Day)"), minutes: 1440 },
    { label: t("3 Hari", "3 Days"), minutes: 4320 },
  ];

  // Approve Request Modal State
  const [approveTarget, setApproveTarget] =
    useState<AdminAccessRequestRow | null>(null);
  const [customValue, setCustomValue] = useState<string>("60");
  const [customUnit, setCustomUnit] = useState<DurationUnit>("minutes");
  const [approveNote, setApproveNote] = useState<string>("");
  const [isApproving, setIsApproving] = useState<boolean>(false);

  // Reject Request State
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Direct Grant Modal State (Many-to-Many: multiple customers & multiple videos)
  const [directGrantOpen, setDirectGrantOpen] = useState<boolean>(false);
  const [directUserIds, setDirectUserIds] = useState<string[]>(
    customers[0]?.id ? [customers[0].id] : []
  );
  const [directVideoIds, setDirectVideoIds] = useState<string[]>(
    videos[0]?.id ? [videos[0].id] : []
  );
  const [directValue, setDirectValue] = useState<string>("60");
  const [directUnit, setDirectUnit] = useState<DurationUnit>("minutes");
  const [isGranting, setIsGranting] = useState<boolean>(false);

  function toggleDirectCustomer(id: string) {
    setDirectUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleDirectVideo(id: string) {
    setDirectVideoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  // Revoke State
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredRequests = requests.filter((req) => {
    if (statusFilter === "ALL") return true;
    return req.status === statusFilter;
  });

  const [seenExpiredIds, setSeenExpiredIds] = useState<Set<string>>(() =>
    getSeenExpiredPermissionIds()
  );

  const activePermissions = permissions.filter(
    (p) =>
      !p.revokedAt &&
      (p.expiresAt === null || new Date(p.expiresAt).getTime() > nowMs)
  );

  const expiredOrRevokedPermissions = permissions.filter(
    (p) =>
      p.revokedAt ||
      (p.expiresAt !== null && new Date(p.expiresAt).getTime() <= nowMs)
  );

  const unseenExpiredPermissions = expiredOrRevokedPermissions.filter(
    (p) => !seenExpiredIds.has(p.id)
  );
  const unseenExpiredPermissionsCount = unseenExpiredPermissions.length;

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  // When Admin switches to the "permissions" tab, mark only truly unseen expired permissions as seen
  useEffect(() => {
    if (activeTab === "permissions" && unseenExpiredPermissionsCount > 0) {
      const unseenIds = expiredOrRevokedPermissions
        .filter((p) => !seenExpiredIds.has(p.id))
        .map((p) => p.id);
      if (unseenIds.length > 0) {
        markExpiredPermissionsAsSeen(unseenIds);
        setSeenExpiredIds(getSeenExpiredPermissionIds());
      }
    }
  }, [
    activeTab,
    unseenExpiredPermissionsCount,
    expiredOrRevokedPermissions,
    seenExpiredIds,
  ]);

  function openApproveDialog(req: AdminAccessRequestRow) {
    setApproveTarget(req);
    setCustomValue("60");
    setCustomUnit("minutes");
    setApproveNote("");
  }

  function applyApprovePreset(minutes: number) {
    setCustomValue(String(minutes));
    setCustomUnit("minutes");
  }

  function applyDirectPreset(minutes: number) {
    setDirectValue(String(minutes));
    setDirectUnit("minutes");
  }

  async function handleApproveSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!approveTarget) return;

    const numValue = Number(customValue);
    if (!numValue || isNaN(numValue) || numValue <= 0) {
      toast.error(
        t(
          "Masukkan nilai durasi yang valid (> 0).",
          "Please enter a valid duration (> 0)."
        )
      );
      return;
    }

    const durationMinutes = convertToMinutes(numValue, customUnit);
    setIsApproving(true);

    try {
      const response = await fetch(
        `/api/admin/requests/${approveTarget.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            durationMinutes,
            note: approveNote.trim() || undefined,
          }),
        }
      );

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error ||
            t("Gagal menyetujui permintaan.", "Failed to approve request.")
        );
        setIsApproving(false);
        return;
      }

      toast.success(
        t(
          `Akses diberikan kepada ${approveTarget.userName} selama ${durationMinutes} menit.`,
          `Granted access to ${approveTarget.userName} for ${durationMinutes} minutes.`
        )
      );
      setApproveTarget(null);
      window.dispatchEvent(new Event("mediatama-notifications-updated"));
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat menyetujui permintaan.",
          "Network error while approving request."
        )
      );
    } finally {
      setIsApproving(false);
    }
  }

  async function handleRejectRequest(req: AdminAccessRequestRow) {
    setRejectingId(req.id);
    try {
      const response = await fetch(`/api/admin/requests/${req.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error ||
            t("Gagal menolak permintaan.", "Failed to reject request.")
        );
        setRejectingId(null);
        return;
      }

      toast.success(
        t(
          `Permintaan dari ${req.userName} telah ditolak.`,
          `Request from ${req.userName} has been rejected.`
        )
      );
      window.dispatchEvent(new Event("mediatama-notifications-updated"));
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat menolak permintaan.",
          "Network error while rejecting request."
        )
      );
    } finally {
      setRejectingId(null);
    }
  }

  async function handleDirectGrantSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (directUserIds.length === 0 || directVideoIds.length === 0) {
      toast.error(
        t(
          "Pilih minimal 1 Customer dan 1 Video terlebih dahulu.",
          "Please select at least 1 Customer and 1 Video first."
        )
      );
      return;
    }

    const numValue = Number(directValue);
    if (!numValue || isNaN(numValue) || numValue <= 0) {
      toast.error(
        t(
          "Masukkan durasi akses yang valid (> 0).",
          "Please enter a valid access duration (> 0)."
        )
      );
      return;
    }

    const durationMinutes = convertToMinutes(numValue, directUnit);
    setIsGranting(true);

    try {
      const response = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: directUserIds,
          videoIds: directVideoIds,
          durationMinutes,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        grantedCount?: number;
        customerCount?: number;
        videoCount?: number;
      };
      if (!response.ok) {
        toast.error(
          data.error ||
            t(
              "Gagal memberikan akses langsung.",
              "Failed to grant direct access."
            )
        );
        setIsGranting(false);
        return;
      }

      toast.success(
        t(
          `Berhasil memberikan ${data.grantedCount ?? directUserIds.length * directVideoIds.length} akses langsung (${directUserIds.length} Customer × ${directVideoIds.length} Video) selama ${durationMinutes} menit!`,
          `Successfully granted ${data.grantedCount ?? directUserIds.length * directVideoIds.length} direct access passes (${directUserIds.length} Customer(s) × ${directVideoIds.length} Video(s)) for ${durationMinutes} minutes!`
        )
      );
      setDirectGrantOpen(false);
      setActiveTab("permissions");
      window.dispatchEvent(new Event("mediatama-notifications-updated"));
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat memberikan akses langsung.",
          "Network error while granting direct access."
        )
      );
    } finally {
      setIsGranting(false);
    }
  }

  async function handleRevokePermission(perm: AdminPermissionRow) {
    setRevokingId(perm.id);
    try {
      const response = await fetch(`/api/admin/permissions/${perm.id}/revoke`, {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error || t("Gagal mencabut akses.", "Failed to revoke access.")
        );
        setRevokingId(null);
        return;
      }

      toast.success(
        t(
          `Akses video "${perm.videoTitle}" untuk ${perm.userName} telah dicabut.`,
          `Revoked "${perm.videoTitle}" access for ${perm.userName}.`
        )
      );
      router.refresh();
    } catch {
      toast.error(
        t(
          "Kesalahan jaringan saat mencabut akses.",
          "Network error while revoking access."
        )
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t(
              "Manajemen Akses & Persetujuan Video",
              "Video Access & Approval Management"
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Setujui permintaan akses customer dengan batas waktu, berikan akses langsung (Direct Grant), atau cabut akses aktif.",
              "Approve customer access requests with custom time limits, grant direct access, or revoke active permissions."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCwIcon className="mr-1.5 size-3.5" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              if (directUserIds.length === 0 && customers[0]) {
                setDirectUserIds([customers[0].id]);
              }
              if (directVideoIds.length === 0 && videos[0]) {
                setDirectVideoIds([videos[0].id]);
              }
              setDirectGrantOpen(true);
            }}
          >
            <PlusCircleIcon className="mr-1.5 size-4" />
            {t(
              "Beri Akses Langsung (Direct Grant)",
              "Grant Direct Access"
            )}
          </Button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        <Button
          variant={activeTab === "requests" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("requests")}
        >
          <ClockIcon className="mr-1.5 size-4" />
          {t("Permintaan Masuk", "Incoming Requests")} ({requests.length})
          {pendingCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 bg-amber-500 text-white"
            >
              {pendingCount} Pending
            </Badge>
          )}
        </Button>

        <Button
          variant={activeTab === "permissions" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("permissions")}
        >
          <ShieldCheckIcon className="mr-1.5 size-4" />
          {t(
            `Akses Aktif & Direct Grant (${activePermissions.length} Aktif)`,
            `Active Permissions & Direct Grant (${activePermissions.length} Active)`
          )}
        </Button>
      </div>

      {/* Tab 1: Permintaan Masuk (AccessRequest) */}
      {activeTab === "requests" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>
                  {t(
                    "Daftar Permintaan Akses Customer",
                    "Customer Access Requests"
                  )}
                </CardTitle>
                <CardDescription>
                  {t(
                    "Tinjau permintaan akses menonton video dan tentukan durasi batas waktu akses.",
                    "Review video viewing requests and specify the access time limit."
                  )}
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map(
                  (st) => (
                    <Button
                      key={st}
                      variant={statusFilter === st ? "default" : "outline"}
                      size="xs"
                      onClick={() => setStatusFilter(st)}
                    >
                      {st}
                    </Button>
                  )
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Video</TableHead>
                    <TableHead>{t("Catatan", "Note")}</TableHead>
                    <TableHead>{t("Waktu Request", "Requested At")}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      {t("Durasi Diberikan", "Granted Duration")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("Aksi", "Actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-28 text-center text-muted-foreground"
                      >
                        {t(
                          `Tidak ada data permintaan akses dengan filter ${statusFilter}.`,
                          `No access requests matching filter ${statusFilter}.`
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <p className="font-medium">{req.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            {req.userEmail}
                          </p>
                        </TableCell>
                        <TableCell className="font-medium">
                          {req.videoTitle}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {req.note || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(req.requestedAt).toLocaleString(locale)}
                        </TableCell>
                        <TableCell>
                          {req.status === "PENDING" && (
                            <Badge
                              variant="secondary"
                              className="bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            >
                              PENDING
                            </Badge>
                          )}
                          {req.status === "APPROVED" && (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                              APPROVED
                            </Badge>
                          )}
                          {req.status === "REJECTED" && (
                            <Badge variant="destructive">REJECTED</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {req.grantedDurationMinutes
                            ? `${req.grantedDurationMinutes} ${t("menit", "mins")}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => openApproveDialog(req)}
                              >
                                <CheckCircle2Icon className="mr-1 size-3.5" />
                                {t("Setujui", "Approve")}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRejectRequest(req)}
                                disabled={rejectingId === req.id}
                              >
                                {rejectingId === req.id ? (
                                  <Loader2Icon className="mr-1 size-3.5 animate-spin" />
                                ) : (
                                  <XCircleIcon className="mr-1 size-3.5" />
                                )}
                                {t("Tolak", "Reject")}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("Selesai diproses", "Reviewed")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Akses Aktif & Direct Grant (VideoPermission) */}
      {activeTab === "permissions" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>
                  {t(
                    "Daftar Izin Akses Video (VideoPermission)",
                    "Video Permissions List"
                  )}
                </CardTitle>
                <CardDescription>
                  {t(
                    "Pantau sisa waktu menonton secara real-time atau cabut akses customer kapan saja.",
                    "Monitor remaining viewing time in real-time or revoke customer access at any moment."
                  )}
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setDirectGrantOpen(true)}>
                <PlusCircleIcon className="mr-1.5 size-4" />
                {t("Beri Akses Langsung", "Grant Direct Access")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Video</TableHead>
                    <TableHead>{t("Sumber Akses", "Grant Source")}</TableHead>
                    <TableHead>{t("Diberikan Pada", "Granted At")}</TableHead>
                    <TableHead>{t("Berakhir Pada", "Expires At")}</TableHead>
                    <TableHead>
                      {t("Status & Sisa Waktu", "Status & Time Remaining")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("Aksi", "Actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-28 text-center text-muted-foreground"
                      >
                        {t(
                          "Belum ada izin akses video yang diberikan.",
                          "No video permissions have been granted yet."
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    permissions.map((perm) => {
                      const isNotStarted = perm.expiresAt === null;
                      const expiresMs = perm.expiresAt
                        ? new Date(perm.expiresAt).getTime()
                        : 0;
                      const remainingMs = isNotStarted ? 0 : expiresMs - nowMs;
                      const isRevoked = Boolean(perm.revokedAt);
                      const isActive =
                        !isRevoked && (isNotStarted || remainingMs > 0);

                      return (
                        <TableRow key={perm.id}>
                          <TableCell>
                            <p className="font-medium">{perm.userName}</p>
                            <p className="text-xs text-muted-foreground">
                              {perm.userEmail}
                            </p>
                          </TableCell>
                          <TableCell className="font-medium">
                            {perm.videoTitle}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {perm.requestId ? "Via Request" : "Direct Grant"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(perm.grantedAt).toLocaleString(locale)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {isRevoked
                              ? "-"
                              : isNotStarted
                                ? t(
                                    `Belum ditonton (Kuota ${perm.durationMinutes} mnt)`,
                                    `Not watched yet (${perm.durationMinutes}m quota)`
                                  )
                                : perm.expiresAt
                                  ? new Date(perm.expiresAt).toLocaleString(
                                      locale
                                    )
                                  : "-"}
                          </TableCell>
                          <TableCell>
                            {isActive && isNotStarted ? (
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                >
                                  {t("SIAP MULAI", "READY TO START")}
                                </Badge>
                                <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                  {formatCountdown(
                                    perm.durationMinutes * 60 * 1000
                                  )}
                                </span>
                              </div>
                            ) : isActive ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                  {t("AKTIF", "ACTIVE")}
                                </Badge>
                                <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                  {formatCountdown(remainingMs)}
                                </span>
                              </div>
                            ) : isRevoked ? (
                              <Badge variant="destructive">
                                {t("DICABUT", "REVOKED")}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {t("KEDALUWARSA", "EXPIRED")}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isActive ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRevokePermission(perm)}
                                disabled={revokingId === perm.id}
                              >
                                {revokingId === perm.id ? (
                                  <Loader2Icon className="mr-1 size-3.5 animate-spin" />
                                ) : (
                                  <ShieldAlertIcon className="mr-1 size-3.5" />
                                )}
                                {t("Cabut Akses", "Revoke")}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {t("Tidak Aktif", "Inactive")}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approve Request Dialog */}
      <Dialog
        open={Boolean(approveTarget)}
        onOpenChange={(open) => !open && setApproveTarget(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t(
                "Setujui Permintaan & Atur Batas Waktu",
                "Approve Request & Set Time Limit"
              )}
            </DialogTitle>
            <DialogDescription>
              {t("Berikan izin menonton video", "Grant viewing access for")}{" "}
              <strong>{approveTarget?.videoTitle}</strong> {t("untuk", "to")}{" "}
              <strong>{approveTarget?.userName}</strong> (
              {approveTarget?.userEmail}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleApproveSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Preset Durasi Cepat", "Quick Duration Presets")}</Label>
              <div className="flex flex-wrap gap-2">
                {durationPresets.map((preset) => {
                  const isSelected =
                    customUnit === "minutes" &&
                    Number(customValue) === preset.minutes;
                  return (
                    <Button
                      key={preset.minutes}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="xs"
                      onClick={() => applyApprovePreset(preset.minutes)}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="approve-duration-val">
                  {t("Durasi Kustom", "Custom Duration")}
                </Label>
                <Input
                  id="approve-duration-val"
                  type="number"
                  min={1}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approve-duration-unit">
                  {t("Satuan Waktu", "Time Unit")}
                </Label>
                <select
                  id="approve-duration-unit"
                  value={customUnit}
                  onChange={(e) =>
                    setCustomUnit(e.target.value as DurationUnit)
                  }
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="minutes">{t("Menit", "Minutes")}</option>
                  <option value="hours">{t("Jam", "Hours")}</option>
                  <option value="days">{t("Hari", "Days")}</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {t(
                "Total durasi akses yang akan diberikan:",
                "Total access duration to be granted:"
              )}{" "}
              <strong>
                {convertToMinutes(Number(customValue) || 0, customUnit)}{" "}
                {t("menit", "minutes")}
              </strong>
            </div>

            <div className="space-y-2">
              <Label htmlFor="approve-note">
                {t("Catatan Admin", "Admin Note")}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({t("Opsional", "Optional")})
                </span>
              </Label>
              <Textarea
                id="approve-note"
                placeholder={t("Catatan persetujuan...", "Approval note...")}
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setApproveTarget(null)}
              >
                {t("Batal", "Cancel")}
              </Button>
              <Button type="submit" disabled={isApproving}>
                {isApproving && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                {t("Setujui & Aktifkan Akses", "Approve & Activate Access")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Direct Grant Dialog (Many-to-Many: Multi-Customer & Multi-Video) */}
      <Dialog open={directGrantOpen} onOpenChange={setDirectGrantOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t(
                "Beri Akses Langsung (Direct Grant — Many-to-Many)",
                "Grant Direct Video Access (Many-to-Many)"
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Pilih satu atau banyak Customer sekaligus serta satu atau banyak Video sekaligus untuk diberikan akses menonton beserta batas waktunya.",
                "Select one or multiple Customers and one or multiple Videos to grant time-bound access in bulk."
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDirectGrantSubmit} className="space-y-4">
            {/* Multi-select Customers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  {t("Pilih Customer", "Select Customers")} (
                  <span className="font-bold text-primary">
                    {directUserIds.length}
                  </span>{" "}
                  / {customers.length} {t("dipilih", "selected")})
                </Label>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      setDirectUserIds(customers.map((c) => c.id))
                    }
                  >
                    {t("Pilih Semua", "Select All")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setDirectUserIds([])}
                  >
                    {t("Reset", "Clear")}
                  </Button>
                </div>
              </div>

              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
                {customers.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    {t("Belum ada customer.", "No customers available.")}
                  </p>
                ) : (
                  customers.map((c) => {
                    const checked = directUserIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                          checked
                            ? "bg-primary/10 font-medium text-foreground"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDirectCustomer(c.id)}
                            className="size-4 rounded border-input accent-primary"
                          />
                          <div className="truncate">
                            <span>{c.name}</span>{" "}
                            <span className="text-muted-foreground">
                              ({c.email})
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Multi-select Videos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  {t("Pilih Video", "Select Videos")} (
                  <span className="font-bold text-primary">
                    {directVideoIds.length}
                  </span>{" "}
                  / {videos.length} {t("dipilih", "selected")})
                </Label>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setDirectVideoIds(videos.map((v) => v.id))}
                  >
                    {t("Pilih Semua", "Select All")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setDirectVideoIds([])}
                  >
                    {t("Reset", "Clear")}
                  </Button>
                </div>
              </div>

              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
                {videos.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    {t("Belum ada video.", "No videos available.")}
                  </p>
                ) : (
                  videos.map((v) => {
                    const checked = directVideoIds.includes(v.id);
                    return (
                      <label
                        key={v.id}
                        className={`flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                          checked
                            ? "bg-primary/10 font-medium text-foreground"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDirectVideo(v.id)}
                            className="size-4 rounded border-input accent-primary"
                          />
                          <span className="truncate">{v.title}</span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("Preset Durasi Cepat", "Quick Duration Presets")}</Label>
              <div className="flex flex-wrap gap-2">
                {durationPresets.map((preset) => {
                  const isSelected =
                    directUnit === "minutes" &&
                    Number(directValue) === preset.minutes;
                  return (
                    <Button
                      key={preset.minutes}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="xs"
                      onClick={() => applyDirectPreset(preset.minutes)}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="direct-duration-val">
                  {t("Durasi Kustom", "Custom Duration")}
                </Label>
                <Input
                  id="direct-duration-val"
                  type="number"
                  min={1}
                  value={directValue}
                  onChange={(e) => setDirectValue(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direct-duration-unit">
                  {t("Satuan Waktu", "Time Unit")}
                </Label>
                <select
                  id="direct-duration-unit"
                  value={directUnit}
                  onChange={(e) =>
                    setDirectUnit(e.target.value as DurationUnit)
                  }
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="minutes">{t("Menit", "Minutes")}</option>
                  <option value="hours">{t("Jam", "Hours")}</option>
                  <option value="days">{t("Hari", "Days")}</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <div>
                {t(
                  "Total kombinasi akses yang akan dibuat:",
                  "Total access passes to be created:"
                )}{" "}
                <strong>
                  {directUserIds.length} Customer × {directVideoIds.length}{" "}
                  Video = {directUserIds.length * directVideoIds.length}{" "}
                  {t("Izin Akses", "Access Passes")}
                </strong>
              </div>
              <div>
                {t(
                  "Durasi per akses (dimulai saat klik Tonton):",
                  "Duration per pass (starts on first watch):"
                )}{" "}
                <strong>
                  {convertToMinutes(Number(directValue) || 0, directUnit)}{" "}
                  {t("menit", "minutes")}
                </strong>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDirectGrantOpen(false)}
              >
                {t("Batal", "Cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  isGranting ||
                  directUserIds.length === 0 ||
                  directVideoIds.length === 0
                }
              >
                {isGranting && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                {t(
                  `Berikan ${directUserIds.length * directVideoIds.length} Akses Sekarang`,
                  `Grant ${directUserIds.length * directVideoIds.length} Access Pass(es) Now`
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
