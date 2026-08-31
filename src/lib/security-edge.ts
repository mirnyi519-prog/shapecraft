import { NextResponse } from "next/server";

const PROBE_PATTERNS: RegExp[] = [
  /(^|\/)\.env/i,
  /(^|\/)\.git(\/|$)/i,
  /wp-admin/i,
  /wp-login/i,
  /xmlrpc\.php/i,
  /phpmyadmin/i,
  /adminer/i,
  /cgi-bin/i,
  /\.php$/i,
  /\.asp$/i,
  /\.aspx$/i,
  /\.sql$/i,
  /\.bak$/i,
  /actuator/i,
  /vendor\/phpunit/i,
  /etc\/passwd/i,
  /eval-stdin/i,
  /shell\.php/i,
  /manager\/html/i,
];

export function isProbePath(pathname: string): boolean {
  return PROBE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src https://yandex.ru https://*.yandex.ru",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  return response;
}
