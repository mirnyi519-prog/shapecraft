import { NextResponse } from "next/server";
import { createCaptchaChallenge } from "@/lib/captcha";
import { clientIpFromRequest } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = rateLimit({
    key: `login-captcha:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (!limited.ok) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const challenge = createCaptchaChallenge();
  return NextResponse.json(challenge);
}
