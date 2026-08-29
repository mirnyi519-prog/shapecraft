"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="min-h-11 rounded-full border border-[var(--border)] px-4 py-2 text-sm transition hover:bg-[var(--bg)]"
    >
      Выйти
    </button>
  );
}
