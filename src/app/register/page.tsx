"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.body.error.code === "EMAIL_ALREADY_REGISTERED") {
        setError(t("register.error.emailTaken"));
      } else {
        setError(t("login.error.generic"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="top-bar">
        <LanguageSwitcher />
      </header>
      <main className="page">
        <h1>{t("register.title")}</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">
            {t("login.email")}
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label htmlFor="password">
            {t("login.password")}
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting}>
            {t("register.submit")}
          </button>
        </form>
        <p>
          <Link href="/">{t("register.loginInstead")}</Link>
        </p>
      </main>
    </>
  );
}
