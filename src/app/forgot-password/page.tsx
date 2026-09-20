"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setStep("reset");
    } catch {
      setError(t("verify.error.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, code, newPassword }),
      });
      setStep("done");
    } catch (err) {
      if (err instanceof ApiError && err.body.error.code === "VERIFICATION_CODE_INVALID") {
        setError(t("verify.error.invalidCode"));
      } else {
        setError(t("verify.error.generic"));
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
        {step === "request" && (
          <>
            <h1>{t("forgotPassword.title")}</h1>
            <p>{t("forgotPassword.instructions")}</p>
            <form onSubmit={handleRequest}>
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
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={submitting}>
                {t("forgotPassword.submit")}
              </button>
            </form>
            <p>
              <Link href="/">{t("forgotPassword.backToLogin")}</Link>
            </p>
          </>
        )}

        {step === "reset" && (
          <>
            <h1>{t("resetPassword.title")}</h1>
            <p>{t("resetPassword.instructions")}</p>
            <form onSubmit={handleReset}>
              <label htmlFor="code">
                {t("verify.code")}
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  minLength={6}
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <label htmlFor="newPassword">
                {t("resetPassword.newPassword")}
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={submitting}>
                {t("resetPassword.submit")}
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <h1>{t("resetPassword.title")}</h1>
            <p role="status">{t("resetPassword.success")}</p>
            <p>
              <Link href="/">{t("register.loginInstead")}</Link>
            </p>
          </>
        )}
      </main>
    </>
  );
}
