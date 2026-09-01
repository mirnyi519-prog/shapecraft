import { loadProjectEnv } from "./load-env";

loadProjectEnv();

async function main() {
  const force = process.argv.includes("--force");
  const baseUrl =
    process.env.WORLD_PUBLISH_URL?.replace(/\/api\/world\/import\/?$/, "") ??
    "https://shapecraft.ru";
  const login = process.env.OWNER_LOGIN ?? "admin";
  const password = process.env.OWNER_PASSWORD;

  if (!password) {
    throw new Error("OWNER_PASSWORD не задан в .env");
  }

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });

  if (!loginResponse.ok) {
    const data = (await loginResponse.json()) as { error?: string };
    throw new Error(data.error ?? `Ошибка входа (${loginResponse.status})`);
  }

  const cookie = loginResponse.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("Сервер не вернул cookie сессии");
  }

  const sessionCookie = cookie.split(";")[0];
  const syncResponse = await fetch(`${baseUrl}/api/world/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ force }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = (await syncResponse.json()) as {
    error?: string;
    articleCount?: number;
    weekLabel?: string;
    imagesLoaded?: number;
    batchId?: string;
  };

  if (!syncResponse.ok) {
    throw new Error(data.error ?? `Ошибка синхронизации (${syncResponse.status})`);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
