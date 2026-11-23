import { notFound } from "next/navigation";
import { requireCustomerPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { LanguageToggle } from "@/components/language-toggle";
import { Badge } from "@/components/ui/badge";
import { VideoIcon } from "lucide-react";
import { WatchPlayerClient } from "./watch-player-client";

export const dynamic = "force-dynamic";

export default async function CustomerWatchVideoPage(context: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCustomerPage();
  const { id: videoId } = await context.params;
  const now = new Date();

  const video = await prisma.video.findUnique({
    where: { id: videoId },
  });

  if (!video || video.deletedAt !== null) {
    notFound();
  }

  const [initialPermission, pendingRequest] = await Promise.all([
    prisma.videoPermission.findFirst({
      where: {
        userId: session.userId,
        videoId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { grantedAt: "desc" },
    }),
    prisma.accessRequest.findFirst({
      where: {
        userId: session.userId,
        videoId,
        status: "PENDING",
      },
    }),
  ]);

  let activePermission = initialPermission;

  // START COUNTDOWN ON FIRST WATCH:
  // If the customer has been granted permission (`expiresAt === null`),
  // start the timer NOW because they just clicked "Tonton Video" / opened the watch page!
  if (activePermission && activePermission.expiresAt === null) {
    const calculatedExpiresAt = new Date(
      now.getTime() + activePermission.durationMinutes * 60 * 1000
    );
    activePermission = await prisma.videoPermission.update({
      where: { id: activePermission.id },
      data: {
        startedAt: now,
        expiresAt: calculatedExpiresAt,
      },
    });
  }

  const initialIsActive = Boolean(activePermission);
  const expiresAtIso =
    activePermission && activePermission.expiresAt
      ? activePermission.expiresAt.toISOString()
      : null;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <VideoIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">
                Mediatama Video Player
              </h1>
              <p className="text-xs text-muted-foreground">
                Protected Time-Bound Video Stream
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

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <WatchPlayerClient
          video={{
            id: video.id,
            title: video.title,
            description: video.description,
            mimeType: video.mimeType,
            fileSize: video.fileSize,
          }}
          initialIsActive={initialIsActive}
          expiresAtIso={expiresAtIso}
          hasPendingRequest={Boolean(pendingRequest)}
        />
      </main>
    </div>
  );
}
