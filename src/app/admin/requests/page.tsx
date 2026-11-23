import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AdminRequestsClient,
  AdminAccessRequestRow,
  AdminPermissionRow,
  SimpleCustomerOption,
  SimpleVideoOption,
} from "./requests-client";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  await requireAdminPage();

  const [requests, permissions, customers, videos] = await Promise.all([
    prisma.accessRequest.findMany({
      where: {
        user: { deletedAt: null },
        video: { deletedAt: null },
      },
      orderBy: { requestedAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        video: {
          select: { id: true, title: true },
        },
      },
    }),
    prisma.videoPermission.findMany({
      where: {
        user: { deletedAt: null },
        video: { deletedAt: null },
      },
      orderBy: { grantedAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        video: {
          select: { id: true, title: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "CUSTOMER", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.video.findMany({
      where: { deletedAt: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  const serializedRequests: AdminAccessRequestRow[] = requests.map(
    (r: (typeof requests)[number]) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      userEmail: r.user.email,
      videoId: r.videoId,
      videoTitle: r.video.title,
      status: r.status,
      note: r.note,
      grantedDurationMinutes: r.grantedDurationMinutes,
      requestedAt: r.requestedAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    })
  );

  const serializedPermissions: AdminPermissionRow[] = permissions.map(
    (p: (typeof permissions)[number]) => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.name,
      userEmail: p.user.email,
      videoId: p.videoId,
      videoTitle: p.video.title,
      requestId: p.requestId,
      durationMinutes: p.durationMinutes,
      grantedAt: p.grantedAt.toISOString(),
      startedAt: p.startedAt ? p.startedAt.toISOString() : null,
      expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
      revokedAt: p.revokedAt ? p.revokedAt.toISOString() : null,
    })
  );

  const customerOptions: SimpleCustomerOption[] = customers.map(
    (c: (typeof customers)[number]) => ({
      id: c.id,
      name: c.name,
      email: c.email,
    })
  );

  const videoOptions: SimpleVideoOption[] = videos.map(
    (v: (typeof videos)[number]) => ({
      id: v.id,
      title: v.title,
    })
  );

  return (
    <AdminRequestsClient
      requests={serializedRequests}
      permissions={serializedPermissions}
      customers={customerOptions}
      videos={videoOptions}
    />
  );
}
