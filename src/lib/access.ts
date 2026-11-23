import { RequestStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type EffectiveAccessState =
  | "ACTIVE"
  | "PENDING"
  | "EXPIRED"
  | "REJECTED"
  | "NO_ACCESS";

export interface DerivedAccessStatus {
  state: EffectiveAccessState;
  permissionId: string | null;
  durationMinutes: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  grantedAt: string | null;
  latestRequestId: string | null;
  latestRequestStatus: RequestStatus | null;
  latestRequestNote: string | null;
}

/**
 * Pure helper to derive one of 5 effective UI states from the latest non-revoked
 * VideoPermission (or latest permission overall) and latest AccessRequest:
 * 1. ACTIVE: Latest non-revoked permission exists AND either:
 *    - `expiresAt === null` (granted by Admin, not yet started watching by customer — timer paused!), OR
 *    - `expiresAt > now` (customer has clicked Watch and timer is currently counting down)
 * 2. PENDING: Not ACTIVE, and latest request has status === 'PENDING'
 * 3. EXPIRED / REJECTED: Not ACTIVE, not PENDING — compares timestamps between the most
 *    recent past permission and a REJECTED request.
 * 4. NO_ACCESS: No prior request or permission
 */
export function deriveEffectiveAccessState(params: {
  latestNonRevokedPermission: {
    id?: string;
    durationMinutes?: number;
    startedAt?: Date | null;
    expiresAt: Date | null;
    grantedAt: Date;
  } | null;
  latestAnyPermission?: {
    id?: string;
    durationMinutes?: number;
    startedAt?: Date | null;
    expiresAt: Date | null;
    grantedAt: Date;
    revokedAt: Date | null;
  } | null;
  latestRequest: {
    id: string;
    status: RequestStatus;
    note: string | null;
    requestedAt?: Date;
    reviewedAt?: Date | null;
  } | null;
  now?: Date;
}): DerivedAccessStatus {
  const now = params.now ?? new Date();
  const { latestNonRevokedPermission, latestAnyPermission, latestRequest } =
    params;

  // 1. ACTIVE: either not started yet (expiresAt === null) or started and expiresAt > now
  if (
    latestNonRevokedPermission &&
    (latestNonRevokedPermission.expiresAt === null ||
      latestNonRevokedPermission.expiresAt.getTime() > now.getTime())
  ) {
    return {
      state: "ACTIVE",
      permissionId: latestNonRevokedPermission.id ?? null,
      durationMinutes: latestNonRevokedPermission.durationMinutes ?? null,
      startedAt: latestNonRevokedPermission.startedAt
        ? latestNonRevokedPermission.startedAt.toISOString()
        : null,
      expiresAt: latestNonRevokedPermission.expiresAt
        ? latestNonRevokedPermission.expiresAt.toISOString()
        : null,
      grantedAt: latestNonRevokedPermission.grantedAt.toISOString(),
      latestRequestId: latestRequest?.id ?? null,
      latestRequestStatus: latestRequest?.status ?? null,
      latestRequestNote: latestRequest?.note ?? null,
    };
  }

  // 2. PENDING
  if (latestRequest && latestRequest.status === "PENDING") {
    return {
      state: "PENDING",
      permissionId: null,
      durationMinutes: null,
      startedAt: null,
      expiresAt: null,
      grantedAt: null,
      latestRequestId: latestRequest.id,
      latestRequestStatus: latestRequest.status,
      latestRequestNote: latestRequest.note,
    };
  }

  // Determine the most relevant past permission (non-revoked expired or revoked)
  const pastPermission =
    latestNonRevokedPermission &&
    latestNonRevokedPermission.expiresAt !== null &&
    latestNonRevokedPermission.expiresAt.getTime() <= now.getTime()
      ? latestNonRevokedPermission
      : latestAnyPermission ?? null;

  const hasPastPermission = Boolean(pastPermission);
  const isLatestRequestRejected =
    Boolean(latestRequest) && latestRequest?.status === "REJECTED";

  // 3 & 4. Compare timestamps when both a past permission and a REJECTED request exist
  if (
    hasPastPermission &&
    pastPermission &&
    isLatestRequestRejected &&
    latestRequest
  ) {
    const permissionEventMs = Math.max(
      pastPermission.grantedAt.getTime(),
      pastPermission.expiresAt ? pastPermission.expiresAt.getTime() : 0
    );
    const rejectedEventMs = (
      latestRequest.reviewedAt ??
      latestRequest.requestedAt ??
      new Date(0)
    ).getTime();

    if (rejectedEventMs > permissionEventMs) {
      return {
        state: "REJECTED",
        permissionId: pastPermission.id ?? null,
        durationMinutes: pastPermission.durationMinutes ?? null,
        startedAt: pastPermission.startedAt
          ? pastPermission.startedAt.toISOString()
          : null,
        expiresAt: pastPermission.expiresAt
          ? pastPermission.expiresAt.toISOString()
          : null,
        grantedAt: pastPermission.grantedAt.toISOString(),
        latestRequestId: latestRequest.id,
        latestRequestStatus: latestRequest.status,
        latestRequestNote: latestRequest.note,
      };
    }

    return {
      state: "EXPIRED",
      permissionId: pastPermission.id ?? null,
      durationMinutes: pastPermission.durationMinutes ?? null,
      startedAt: pastPermission.startedAt
        ? pastPermission.startedAt.toISOString()
        : null,
      expiresAt: pastPermission.expiresAt
        ? pastPermission.expiresAt.toISOString()
        : null,
      grantedAt: pastPermission.grantedAt.toISOString(),
      latestRequestId: latestRequest.id,
      latestRequestStatus: latestRequest.status,
      latestRequestNote: latestRequest.note,
    };
  }

  if (hasPastPermission && pastPermission) {
    return {
      state: "EXPIRED",
      permissionId: pastPermission.id ?? null,
      durationMinutes: pastPermission.durationMinutes ?? null,
      startedAt: pastPermission.startedAt
        ? pastPermission.startedAt.toISOString()
        : null,
      expiresAt: pastPermission.expiresAt
        ? pastPermission.expiresAt.toISOString()
        : null,
      grantedAt: pastPermission.grantedAt.toISOString(),
      latestRequestId: latestRequest?.id ?? null,
      latestRequestStatus: latestRequest?.status ?? null,
      latestRequestNote: latestRequest?.note ?? null,
    };
  }

  if (isLatestRequestRejected && latestRequest) {
    return {
      state: "REJECTED",
      permissionId: null,
      durationMinutes: null,
      startedAt: null,
      expiresAt: null,
      grantedAt: null,
      latestRequestId: latestRequest.id,
      latestRequestStatus: latestRequest.status,
      latestRequestNote: latestRequest.note,
    };
  }

  // 5. NO_ACCESS
  return {
    state: "NO_ACCESS",
    permissionId: null,
    durationMinutes: null,
    startedAt: null,
    expiresAt: null,
    grantedAt: null,
    latestRequestId: latestRequest?.id ?? null,
    latestRequestStatus: latestRequest?.status ?? null,
    latestRequestNote: latestRequest?.note ?? null,
  };
}

/**
 * Fetches and computes the effective access status for a single (userId, videoId) pair.
 */
export async function getEffectiveAccessForVideo(
  userId: string,
  videoId: string
): Promise<DerivedAccessStatus> {
  const [latestNonRevokedPermission, latestAnyPermission, latestRequest] =
    await Promise.all([
      prisma.videoPermission.findFirst({
        where: { userId, videoId, revokedAt: null },
        orderBy: { grantedAt: "desc" },
      }),
      prisma.videoPermission.findFirst({
        where: { userId, videoId },
        orderBy: { grantedAt: "desc" },
      }),
      prisma.accessRequest.findFirst({
        where: { userId, videoId },
        orderBy: { requestedAt: "desc" },
      }),
    ]);

  return deriveEffectiveAccessState({
    latestNonRevokedPermission,
    latestAnyPermission,
    latestRequest,
  });
}
