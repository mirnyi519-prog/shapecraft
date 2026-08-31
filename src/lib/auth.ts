import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export type UserRole = "admin" | "partner";

export type SessionUser = {
  id: string;
  login: string;
  name: string;
  role: UserRole;
};

const SESSION_COOKIE = "shapecraft_session";
const SESSION_TTL = "30d";

function getSessionCookieOptions() {
  const secureCookie =
    process.env.COOKIE_SECURE === "true" ||
    process.env.COOKIE_SECURE === "1";

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookie,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getAuthSecret());
}

export { SESSION_COOKIE, getSessionCookieOptions };

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Админ" },
  { value: "partner", label: "Партнёр" },
];

export function isAdmin(role: string): boolean {
  return role === "admin";
}

export function isValidRole(role: string): role is UserRole {
  return role === "admin" || role === "partner";
}

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, getSessionCookieOptions());
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    const issuedAt = typeof payload.iat === "number" ? payload.iat : 0;
    const { getSessionEpoch } = await import("@/lib/access-control");
    const epoch = await getSessionEpoch();
    if (issuedAt < epoch) {
      return null;
    }

    const role = String(payload.role);
    // Миграция старых сессий owner → admin
    const normalizedRole: UserRole =
      role === "owner" || role === "admin" ? "admin" : "partner";

    return {
      id: String(payload.id),
      login: String(payload.login ?? payload.email),
      name: String(payload.name),
      role: normalizedRole,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (!isAdmin(session.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function getOwnerSplitPercent(): Promise<number> {
  const setting = await prisma.appSetting.findUnique({
    where: { id: "default" },
  });
  return setting?.ownerSplitPercent ?? 50;
}
