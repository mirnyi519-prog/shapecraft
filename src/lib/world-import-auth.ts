import type { NextRequest } from "next/server";

export function isWorldImportAuthorized(request: NextRequest): boolean {
  const secret = process.env.WORLD_IMPORT_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  return request.headers.get("x-world-import-secret")?.trim() === secret;
}
