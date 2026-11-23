import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin-nav";
import { LogoutButton } from "@/components/logout-button";
import { LanguageToggle } from "@/components/language-toggle";
import { Badge } from "@/components/ui/badge";
import { VideoIcon } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminPage();
  const now = new Date();

  const [pendingRequestsCount, allPermissions, activeRequests] =
    await Promise.all([
      prisma.accessRequest.count({
        where: {
          status: "PENDING",
          user: { deletedAt: null },
          video: { deletedAt: null },
        },
      }),
      prisma.videoPermission.findMany({
        where: {
          user: { deletedAt: null },
          video: { deletedAt: null },
        },
        orderBy: { grantedAt: "desc" },
        select: {
          userId: true,
          videoId: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
      prisma.accessRequest.findMany({
        where: {
          status: "PENDING",
          user: { deletedAt: null },
          video: { deletedAt: null },
        },
        select: {
          userId: true,
          videoId: true,
        },
      }),
    ]);

  const pendingPairs = new Set(
    activeRequests.map(
      (r: (typeof activeRequests)[number]) => `${r.userId}:${r.videoId}`
    )
  );
  const latestPermByPair = new Map<
    string,
    { expiresAt: Date | null; revokedAt: Date | null }
  >();

  for (const perm of allPermissions) {
    const key = `${perm.userId}:${perm.videoId}`;
    const existing = latestPermByPair.get(key);
    if (!existing) {
      latestPermByPair.set(key, perm);
    } else {
      const existingActive =
        existing.revokedAt === null &&
        (existing.expiresAt === null ||
          existing.expiresAt.getTime() > now.getTime());
      const permActive =
        perm.revokedAt === null &&
        (perm.expiresAt === null || perm.expiresAt.getTime() > now.getTime());
      if (permActive && !existingActive) {
        latestPermByPair.set(key, perm);
      }
    }
  }

  let expiredPermissionsCount = 0;
  for (const [key, perm] of latestPermByPair.entries()) {
    const isCurrentlyActive =
      perm.revokedAt === null &&
      (perm.expiresAt === null || perm.expiresAt.getTime() > now.getTime());
    if (!isCurrentlyActive && !pendingPairs.has(key)) {
      expiredPermissionsCount += 1;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 md:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full flex-col border-b bg-background md:w-64 md:border-r md:border-b-0">
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <VideoIcon className="size-4" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">Mediatama Vault</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Admin Console
              </p>
            </div>
          </div>
          <LanguageToggle />
        </div>

        <div className="flex-1 p-4">
          <AdminNav
            initialPendingCount={pendingRequestsCount}
            initialExpiredCount={expiredPermissionsCount}
          />
        </div>

        <div className="border-t p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {session.email}
              </p>
            </div>
            <Badge variant="default" className="ml-2 shrink-0">
              ADMIN
            </Badge>
          </div>
          <LogoutButton className="w-full justify-center" />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
