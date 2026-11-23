"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UsersIcon,
  VideoIcon,
  ClockIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function AdminOverviewClient({
  customerCount,
  videoCount,
  pendingRequestCount,
  activePermissionCount,
}: {
  customerCount: number;
  videoCount: number;
  pendingRequestCount: number;
  activePermissionCount: number;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("Ringkasan Admin", "Admin Overview")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Kelola akun customer, aset video privat, dan izin menonton berbatas waktu.",
            "Manage customer accounts, private video assets, and time-bound viewing permissions."
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("Total Customer", "Total Customers")}
            </CardTitle>
            <UsersIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerCount}</div>
            <p className="text-xs text-muted-foreground">
              {t("Akun customer terdaftar", "Provisioned customer accounts")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("Video Privat", "Private Videos")}
            </CardTitle>
            <VideoIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{videoCount}</div>
            <p className="text-xs text-muted-foreground">
              {t(
                "Tersimpan di penyimpanan privat lokal",
                "Stored in local private storage"
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("Permintaan Pending", "Pending Requests")}
            </CardTitle>
            <ClockIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequestCount}</div>
            <p className="text-xs text-muted-foreground">
              {t("Menunggu persetujuan Admin", "Awaiting review")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("Izin Akses Aktif", "Active Permissions")}
            </CardTitle>
            <ShieldCheckIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePermissionCount}</div>
            <p className="text-xs text-muted-foreground">
              {t("Akses video yang sedang berlaku", "Currently valid video passes")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              {t("Manajemen Customer", "Customer Management")}
            </CardTitle>
            <CardDescription>
              {t(
                "Buat, ubah, reset password, dan hapus akun customer. Customer tidak dapat mendaftar sendiri.",
                "Create, update, reset passwords, and remove customer accounts. Customers cannot self-register."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/customers">
              <Button>
                {t("Kelola Customer", "Manage Customers")}
                <ArrowRightIcon className="ml-2 size-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("Manajemen Video Privat", "Video Vault Management")}
            </CardTitle>
            <CardDescription>
              {t(
                "Unggah video MP4/WebM/Ogg ke disk privat server, pratinjau stream, ubah metadata, atau ganti file.",
                "Upload MP4/WebM/Ogg videos to private server disk, preview video streams, edit metadata, or replace files."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/videos">
              <Button>
                {t("Kelola Video", "Manage Videos")}
                <ArrowRightIcon className="ml-2 size-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("Persetujuan & Direct Grant", "Access Requests & Direct Grant")}
            </CardTitle>
            <CardDescription>
              {t(
                "Setujui permintaan akses customer dengan batas waktu, berikan akses langsung, atau cabut akses.",
                "Approve customer access requests with custom durations, grant direct access, or revoke permissions."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/requests">
              <Button>
                {t("Kelola Akses", "Manage Access")}
                <ArrowRightIcon className="ml-2 size-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
