import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "session_token";

export type UserRole = "ADMIN" | "CUSTOMER";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || "mediatama-super-secret-jwt-key-2026-phase-1";
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (
      typeof payload.userId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.name === "string" &&
      (payload.role === "ADMIN" || payload.role === "CUSTOMER")
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
    }
    return null;
  } catch {
    return null;
  }
}
