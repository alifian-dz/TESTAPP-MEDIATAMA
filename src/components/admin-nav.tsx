"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  UsersIcon,
  VideoIcon,
  ClockIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export const SEEN_EXPIRED_PERMISSIONS_KEY =
  "mediatama_admin_seen_expired_perm_ids";

export function getSeenExpiredPermissionIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_EXPIRED_PERMISSIONS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

export function markExpiredPermissionsAsSeen(ids: string[]): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  try {
    const existing = getSeenExpiredPermissionIds();
    for (const id of ids) {
      existing.add(id);
    }
    window.localStorage.setItem(
      SEEN_EXPIRED_PERMISSIONS_KEY,
      JSON.stringify(Array.from(existing))
    );
    window.dispatchEvent(new Event("mediatama-notifications-updated"));
  } catch {
    // Ignore storage error
  }
}

export function AdminNav({
  initialPendingCount = 0,
}: {
  initialPendingCount?: number;
  initialExpiredCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [unseenExpiredCount, setUnseenExpiredCount] = useState(0);
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    setPendingCount(initialPendingCount);
  }, [initialPendingCount]);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        pendingRequests?: number;
        pendingRequestIds?: string[];
        expiredPermissionIds?: string[];
        permissionsStateSignature?: string;
      };

      const nextPending =
        typeof data.pendingRequests === "number" ? data.pendingRequests : 0;
      const pendingIdsSig = Array.isArray(data.pendingRequestIds)
        ? data.pendingRequestIds.join(",")
        : "";
      const expiredIdsSig = Array.isArray(data.expiredPermissionIds)
        ? data.expiredPermissionIds.join(",")
        : "";
      const permStateSig = data.permissionsStateSignature ?? "";
      const nextSignature = `${nextPending}|${pendingIdsSig}|${expiredIdsSig}|${permStateSig}`;

      setPendingCount(nextPending);

      if (Array.isArray(data.expiredPermissionIds)) {
        // When Admin opens /admin/requests, automatically mark current expired permissions as seen so the badge disappears!
        if (pathname.startsWith("/admin/requests")) {
          markExpiredPermissionsAsSeen(data.expiredPermissionIds);
          setUnseenExpiredCount(0);
        } else {
          const seenSet = getSeenExpiredPermissionIds();
          const unseen = data.expiredPermissionIds.filter(
            (id) => !seenSet.has(id)
          );
          setUnseenExpiredCount(unseen.length);
        }
      }

      // If new pending requests or newly expired permissions arrived in the database while Admin is viewing the page,
      // automatically trigger router.refresh() so the table rows update in real-time without clicking Refresh!
      if (
        lastSignatureRef.current !== null &&
        lastSignatureRef.current !== nextSignature
      ) {
        router.refresh();
      }
      lastSignatureRef.current = nextSignature;
    } catch {
      // Ignore background poll error
    }
  }, [pathname, router]);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 3000);
    const handleCustomUpdate = () => {
      fetchCounts();
    };
    window.addEventListener(
      "mediatama-notifications-updated",
      handleCustomUpdate
    );
    return () => {
      clearInterval(interval);
      window.removeEventListener(
        "mediatama-notifications-updated",
        handleCustomUpdate
      );
    };
  }, [fetchCounts]);

  const totalRequestNotifications = pendingCount + unseenExpiredCount;

  const navItems = [
    {
      title: t("Ringkasan", "Overview"),
      href: "/admin",
      icon: LayoutDashboardIcon,
      exact: true,
      showBadges: false,
    },
    {
      title: t("Customer", "Customers"),
      href: "/admin/customers",
      icon: UsersIcon,
      exact: false,
      showBadges: false,
    },
    {
      title: t("Video", "Videos"),
      href: "/admin/videos",
      icon: VideoIcon,
      exact: false,
      showBadges: false,
    },
    {
      title: t("Permintaan Akses", "Access Requests"),
      href: "/admin/requests",
      icon: ClockIcon,
      exact: false,
      showBadges: true,
    },
  ];

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.title}</span>
            </div>

            {item.showBadges && totalRequestNotifications > 0 && (
              <div className="ml-2 flex shrink-0 items-center gap-1">
                {pendingCount > 0 && (
                  <span
                    title={t(
                      `${pendingCount} Permintaan Akses Baru (Pending)`,
                      `${pendingCount} Pending Access Request(s)`
                    )}
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none shadow-2xs",
                      isActive
                        ? "bg-amber-400 text-amber-950"
                        : "bg-amber-500 text-white"
                    )}
                  >
                    {pendingCount}
                  </span>
                )}
                {unseenExpiredCount > 0 && (
                  <span
                    title={t(
                      `${unseenExpiredCount} Akses Video Baru Habis Waktunya`,
                      `${unseenExpiredCount} Newly Expired Video Permission(s)`
                    )}
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none shadow-2xs",
                      isActive
                        ? "bg-red-500 text-white ring-1 ring-white/40"
                        : "bg-destructive text-white"
                    )}
                  >
                    {unseenExpiredCount}
                  </span>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
