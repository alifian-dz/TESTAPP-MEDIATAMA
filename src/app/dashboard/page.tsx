import { requireCustomerPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveEffectiveAccessState } from "@/lib/access";
import { LogoutButton } from "@/components/logout-button";
import { LanguageToggle } from "@/components/language-toggle";
import { Badge } from "@/components/ui/badge";
import { VideoIcon } from "lucide-react";
import {
  CustomerDashboardClient,
  CustomerVideoCardItem,
  CustomerRequestHistoryItem,
} from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function CustomerDashboardPage() {
  const session = await requireCustomerPage();
  const now = new Date();

  const [videos, userPermissions, userRequests] = await Promise.all([
    prisma.video.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.videoPermission.findMany({
      where: { userId: session.userId },
      orderBy: { grantedAt: "desc" },
    }),
    prisma.accessRequest.findMany({
      where: {
        userId: session.userId,
        video: { deletedAt: null },
      },
      orderBy: { requestedAt: "desc" },
      include: {
        video: {
          select: { title: true },
        },
        videoPermission: {
          select: {
            id: true,
            durationMinutes: true,
            startedAt: true,
            expiresAt: true,
            revokedAt: true,
          },
        },
      },
    }),
  ]);

  const videoCards: CustomerVideoCardItem[] = videos.map(
    (video: (typeof videos)[number]) => {
      const nonRevokedPermissions = userPermissions.filter(
        (p: (typeof userPermissions)[number]) =>
          p.videoId === video.id && p.revokedAt === null
      );
      const allVideoPermissions = userPermissions.filter(
        (p: (typeof userPermissions)[number]) => p.videoId === video.id
      );
      const videoRequests = userRequests.filter(
        (r: (typeof userRequests)[number]) => r.videoId === video.id
      );

      const latestNonRevokedPermission = nonRevokedPermissions[0] ?? null;
      const latestAnyPermission = allVideoPermissions[0] ?? null;
      const latestRequest = videoRequests[0] ?? null;

      const derived = deriveEffectiveAccessState({
        latestNonRevokedPermission,
        latestAnyPermission,
        latestRequest,
        now,
      });

      return {
        id: video.id,
        title: video.title,
        description: video.description,
        fileSize: video.fileSize,
        mimeType: video.mimeType,
        createdAt: video.createdAt.toISOString(),
        effectiveState: derived.state,
        permissionId: derived.permissionId,
        durationMinutes: derived.durationMinutes,
        startedAt: derived.startedAt,
        expiresAt: derived.expiresAt,
        grantedAt: derived.grantedAt,
        latestRequestNote: derived.latestRequestNote,
      };
    }
  );

  const requestHistory: CustomerRequestHistoryItem[] = userRequests.map(
    (req: (typeof userRequests)[number]) => ({
      id: req.id,
      videoTitle: req.video.title,
      status: req.status,
      note: req.note,
      grantedDurationMinutes:
        req.grantedDurationMinutes ??
        req.videoPermission?.durationMinutes ??
        null,
      requestedAt: req.requestedAt.toISOString(),
      reviewedAt: req.reviewedAt ? req.reviewedAt.toISOString() : null,
      permissionStartedAt: req.videoPermission?.startedAt
        ? req.videoPermission.startedAt.toISOString()
        : null,
      permissionExpiresAt: req.videoPermission?.expiresAt
        ? req.videoPermission.expiresAt.toISOString()
        : null,
      permissionRevokedAt: req.videoPermission?.revokedAt
        ? req.videoPermission.revokedAt.toISOString()
        : null,
    })
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <VideoIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">
                Mediatama Customer Portal
              </h1>
              <p className="text-xs text-muted-foreground">
                Time-Bound Video Access Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none">{session.name}</p>
              <p className="text-xs text-muted-foreground">{session.email}</p>
            </div>
            <Badge variant="secondary">CUSTOMER</Badge>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <CustomerDashboardClient
          userName={session.name}
          videos={videoCards}
          requestHistory={requestHistory}
        />
      </main>
    </div>
  );
}
