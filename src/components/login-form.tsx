"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button, Input } from "@/components/ui";

type CaptchaState = {
  id: string;
  question: string;
};

export function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadCaptcha = useCallback(async () => {
    const response = await fetch("/api/auth/captcha", { cache: "no-store" });
    if (!response.ok) {
      setError("Не удалось загрузить проверку. Обновите страницу.");
      return;
    }

    const data = (await response.json()) as CaptchaState;
    setCaptcha(data);
    setCaptchaAnswer("");
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        login,
        password,
        captchaId: captcha?.id,
        captchaAnswer: captchaRequired ? captchaAnswer : undefined,
      }),
    });

    const data = (await response.json()) as {
      error?: string;
      captchaRequired?: boolean;
    };

    if (!response.ok) {
      setError(data.error ?? "Ошибка входа");

      if (data.captchaRequired) {
        setCaptchaRequired(true);
        await loadCaptcha();
      }

      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Логин"
        type="text"
        autoComplete="username"
        value={login}
        onChange={(event) => setLogin(event.target.value)}
        required
      />
      <Input
        label="Пароль"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {captchaRequired && captcha ? (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
          <p className="text-sm font-medium">Проверка</p>
          <p className="text-sm text-[var(--muted)]">
            Решите пример: <span className="font-semibold text-[var(--text)]">{captcha.question}</span>
          </p>
          <Input
            label="Ответ"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={captchaAnswer}
            onChange={(event) => setCaptchaAnswer(event.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => void loadCaptcha()}
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            Другой пример
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" className="min-h-11 w-full" disabled={loading}>
        {loading ? "Вход..." : "Войти"}
      </Button>
    </form>
  );
}
