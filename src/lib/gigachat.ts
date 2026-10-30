import { randomUUID } from "node:crypto";
import { request } from "node:https";
import { rootCertificates } from "node:tls";

/**
 * GigaChat (Сбер). Ключ авторизации — GIGACHAT_AUTH_KEY в .env сервера,
 * токен доступа живёт 30 минут и обновляется сам.
 */
const OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const API_URL = "https://api.giga.chat/v1";

/** Сертификаты Сбера выданы НУЦ Минцифры — его нет в стандартном списке Node. */
const RUSSIAN_TRUSTED_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIFwjCCA6qgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAxMjEwNDE1WhcNMzIwMjI3MjEwNDE1WjBwMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMSAwHgYDVQQDDBdSdXNzaWFuIFRydXN0ZWQgUm9v
dCBDQTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMfFOZ8pUAL3+r2n
qqE0Zp52selXsKGFYoG0GM5bwz1bSFtCt+AZQMhkWQheI3poZAToYJu69pHLKS6Q
XBiwBC1cvzYmUYKMYZC7jE5YhEU2bSL0mX7NaMxMDmH2/NwuOVRj8OImVa5s1F4U
zn4Kv3PFlDBjjSjXKVY9kmjUBsXQrIHeaqmUIsPIlNWUnimXS0I0abExqkbdrXbX
YwCOXhOO2pDUx3ckmJlCMUGacUTnylyQW2VsJIyIGA8V0xzdaeUXg0VZ6ZmNUr5Y
Ber/EAOLPb8NYpsAhJe2mXjMB/J9HNsoFMBFJ0lLOT/+dQvjbdRZoOT8eqJpWnVD
U+QL/qEZnz57N88OWM3rabJkRNdU/Z7x5SFIM9FrqtN8xewsiBWBI0K6XFuOBOTD
4V08o4TzJ8+Ccq5XlCUW2L48pZNCYuBDfBh7FxkB7qDgGDiaftEkZZfApRg2E+M9
G8wkNKTPLDc4wH0FDTijhgxR3Y4PiS1HL2Zhw7bD3CbslmEGgfnnZojNkJtcLeBH
BLa52/dSwNU4WWLubaYSiAmA9IUMX1/RpfpxOxd4Ykmhz97oFbUaDJFipIggx5sX
ePAlkTdWnv+RWBxlJwMQ25oEHmRguNYf4Zr/Rxr9cS93Y+mdXIZaBEE0KS2iLRqa
OiWBki9IMQU4phqPOBAaG7A+eP8PAgMBAAGjZjBkMB0GA1UdDgQWBBTh0YHlzlpf
BKrS6badZrHF+qwshzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzAS
BgNVHRMBAf8ECDAGAQH/AgEEMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsF
AAOCAgEAALIY1wkilt/urfEVM5vKzr6utOeDWCUczmWX/RX4ljpRdgF+5fAIS4vH
tmXkqpSCOVeWUrJV9QvZn6L227ZwuE15cWi8DCDal3Ue90WgAJJZMfTshN4OI8cq
W9E4EG9wglbEtMnObHlms8F3CHmrw3k6KmUkWGoa+/ENmcVl68u/cMRl1JbW2bM+
/3A+SAg2c6iPDlehczKx2oa95QW0SkPPWGuNA/CE8CpyANIhu9XFrj3RQ3EqeRcS
AQQod1RNuHpfETLU/A2gMmvn/w/sx7TB3W5BPs6rprOA37tutPq9u6FTZOcG1Oqj
C/B7yTqgI7rbyvox7DEXoX7rIiEqyNNUguTk/u3SZ4VXE2kmxdmSh3TQvybfbnXV
4JbCZVaqiZraqc7oZMnRoWrXRG3ztbnbes/9qhRGI7PqXqeKJBztxRTEVj8ONs1d
WN5szTwaPIvhkhO3CO5ErU2rVdUr89wKpNXbBODFKRtgxUT70YpmJ46VVaqdAhOZ
D9EUUn4YaeLaS8AjSF/h7UkjOibNc4qVDiPP+rkehFWM66PVnP1Msh93tc+taIfC
EYVMxjh8zNbFuoc7fzvvrFILLe7ifvEIUqSVIC/AzplM/Jxw7buXFeGP1qVCBEHq
391d/9RAfaZ12zkwFsl+IKwE/OZxW8AHa9i1p4GO0YSNuczzEm4=
-----END CERTIFICATE-----`;

const CA = [...rootCertificates, RUSSIAN_TRUSTED_ROOT_CA];

export type GigaFunctionCall = { name: string; arguments: Record<string, unknown> };

export type GigaMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; function_call?: GigaFunctionCall; functions_state_id?: string }
  | { role: "function"; name: string; content: string };

export type GigaFunction = {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
};

export type GigaReply = {
  message: Extract<GigaMessage, { role: "assistant" }>;
  finishReason: string;
  totalTokens: number;
};

export function gigachatConfigured(): boolean {
  return Boolean(process.env.GIGACHAT_AUTH_KEY?.trim());
}

function gigachatModel(): string {
  return process.env.GIGACHAT_MODEL?.trim() || "GigaChat-2";
}

function httpsJson<T>(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: init.method, headers: init.headers, ca: CA, timeout: 60_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if ((res.statusCode ?? 500) >= 400) {
          reject(new Error(`GigaChat HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(text) as T);
        } catch {
          reject(new Error(`GigaChat: не JSON — ${text.slice(0, 200)}`));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("GigaChat: таймаут")));
    req.on("error", reject);
    if (init.body) {
      req.write(init.body);
    }
    req.end();
  });
}

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.expiresAt - Date.now() > 60_000) {
    return token.value;
  }
  const key = process.env.GIGACHAT_AUTH_KEY?.trim();
  if (!key) {
    throw new Error("GIGACHAT_AUTH_KEY не задан");
  }
  const body = new URLSearchParams({ scope: process.env.GIGACHAT_SCOPE?.trim() || "GIGACHAT_API_PERS" }).toString();
  const result = await httpsJson<{ access_token: string; expires_at: number }>(OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      RqUID: randomUUID(),
      Authorization: `Basic ${key.replace(/^Basic\s+/i, "")}`,
      "Content-Length": String(Buffer.byteLength(body)),
    },
    body,
  });
  const expiresAt = result.expires_at < 1e12 ? result.expires_at * 1000 : result.expires_at;
  token = { value: result.access_token, expiresAt };
  return token.value;
}

export async function gigachatComplete(messages: GigaMessage[], functions: GigaFunction[] = []): Promise<GigaReply> {
  const body = JSON.stringify({
    model: gigachatModel(),
    messages,
    ...(functions.length > 0 ? { functions, function_call: "auto" } : {}),
    temperature: 0.4,
    max_tokens: 700,
  });
  const result = await httpsJson<{
    choices: { message: GigaReply["message"]; finish_reason: string }[];
    usage?: { total_tokens?: number };
  }>(`${API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Length": String(Buffer.byteLength(body)),
    },
    body,
  });
  const choice = result.choices[0];
  return {
    message: choice.message,
    finishReason: choice.finish_reason,
    totalTokens: result.usage?.total_tokens ?? 0,
  };
}
