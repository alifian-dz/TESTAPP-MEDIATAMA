import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  SessionPayload,
  verifySessionToken,
} from "@/lib/session";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Server-side auth guard for API routes & Server Actions.
 * Throws AuthError if unauthenticated.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Authentication required", 401);
  }
  return session;
}

/**
 * Server-side admin guard for API routes & Server Actions.
 * Throws AuthError if unauthenticated or not an ADMIN.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    throw new AuthError("Forbidden: Admin access required", 403);
  }
  return session;
}

/**
 * Page-level auth guard for Server Components. Redirects if unauthorized.
 */
export async function requireAdminPage(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return session;
}

export async function requireCustomerPage(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "CUSTOMER") {
    redirect("/admin");
  }

  // Ensure soft-deleted customers cannot keep browsing /dashboard with an old JWT cookie
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { deletedAt: true },
  });
  if (!user || user.deletedAt !== null) {
    redirect("/api/auth/logout");
  }

  return session;
}
