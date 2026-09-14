import http from "node:http";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const PORT = Number(process.env.TELEGRAM_RELAY_PORT || 3098);
const HOST = process.env.TELEGRAM_RELAY_HOST || "127.0.0.1";

function cleanEnv(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function sendTelegram(text) {
  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const chatIdRaw = cleanEnv(process.env.TELEGRAM_CHAT_ID);
  if (!token || !chatIdRaw) {
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы",
    };
  }

  const chatId = /^-?\d+$/.test(chatIdRaw) ? Number(chatIdRaw) : chatIdRaw;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: String(text || "").slice(0, 4000),
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        status: response.status,
        error: body?.description || `Telegram HTTP ${response.status}`,
      };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "network error",
    };
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/send") {
    try {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const result = await sendTelegram(payload.text);
      res.writeHead(result.ok ? 200 : 502);
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400);
      res.end(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : "bad request",
        }),
      );
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`telegram-relay on http://${HOST}:${PORT}`);
});
