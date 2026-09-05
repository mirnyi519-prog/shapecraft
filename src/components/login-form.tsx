"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";

type CaptchaState = {
  id: string;
  question: string;
};

export function LoginForm({ initiallyBlocked = false }: { initiallyBlocked?: boolean }) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null);
  const [loginBlocked, setLoginBlocked] = useState(initiallyBlocked);
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

  useEffect(() => {
    if (loginBlocked) {
      return;
    }
    void loadCaptcha();
  }, [loadCaptcha, loginBlocked]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loginBlocked) {
      return;
    }

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
        captchaAnswer,
      }),
    });

    const data = (await response.json()) as {
      error?: string;
      captchaRequired?: boolean;
      loginBlocked?: boolean;
      attemptsLeft?: number;
    };

    if (!response.ok) {
      if (data.loginBlocked) {
        setLoginBlocked(true);
        setError(
          data.error ??
            "Доступ запрещён. Слишком много неудачных попыток входа.",
        );
        setLoading(false);
        return;
      }

      setError(
        data.attemptsLeft !== undefined
          ? `${data.error ?? "Ошибка входа"} Осталось попыток: ${data.attemptsLeft}.`
          : (data.error ?? "Ошибка входа"),
      );
      await loadCaptcha();
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (loginBlocked) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
        <p className="font-medium">Вход для этого устройства заблокирован</p>
        <p>
          Слишком много неудачных попыток. Кнопка «Вход» скрыта. Разблокировку
          может сделать администратор в разделе «Безопасность».
        </p>
      </div>
    );
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
      {captcha ? (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
          <p className="text-sm font-medium">Проверка</p>
          <p className="text-sm text-[var(--muted)]">
            Решите пример:{" "}
            <span className="font-semibold text-[var(--text)]">
              {captcha.question}
            </span>
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
      ) : (
        <p className="text-sm text-[var(--muted)]">Загрузка проверки…</p>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button
        type="submit"
        className="min-h-11 w-full"
        disabled={loading || !captcha}
      >
        {loading ? "Вход..." : "Войти"}
      </Button>
    </form>
  );
}
