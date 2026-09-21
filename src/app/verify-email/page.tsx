"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { TopBar } from "@/components/TopBar";

function VerifyEmailForm() {
  const { t } = useI18n();
  const email = useSearchParams().get("email") ?? "";
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setVerified(true);
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

  async function handleResend() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setNotice(t("verify.resendSent"));
    } catch (err) {
      if (err instanceof ApiError && err.body.error.code === "VERIFICATION_CODE_COOLDOWN") {
        setError(t("verify.resendCooldown"));
      } else {
        setError(t("verify.error.generic"));
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <TopBar />
      <main className="page">
        <h1>{t("verify.title")}</h1>
        {verified ? (
          <>
            <p role="status">{t("verify.success")}</p>
            <p>
              <Link href="/">{t("register.loginInstead")}</Link>
            </p>
          </>
        ) : (
          <>
            <p>{t("verify.instructions").replace("{email}", email)}</p>
            <form onSubmit={handleSubmit}>
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
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {notice && <p role="status">{notice}</p>}
              <button type="submit" disabled={submitting}>
                {t("verify.submit")}
              </button>
            </form>
            <p>
              <button type="button" onClick={handleResend} disabled={resending}>
                {t("verify.resend")}
              </button>
            </p>
          </>
        )}
      </main>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
