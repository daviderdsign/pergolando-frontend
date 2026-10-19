"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {loginDestination} from "@/lib/login-destination";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    const destination = loginDestination(window.location.search);
    apiFetch("/auth/me").then(() => { if (active) router.replace(destination); }).catch(() => {});
    return () => { active = false; };
  }, [router]);
  const { t, lang } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push(loginDestination(window.location.search));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.body.error.code === "INVALID_CREDENTIALS") {
          setError(t("login.error.invalidCredentials"));
        } else if (err.body.error.code === "ACCOUNT_LOCKED") {
          setError(t("login.error.accountLocked"));
        } else if (err.body.error.code === "EMAIL_NOT_VERIFIED") {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          return;
        } else {
          setError(t("login.error.generic"));
        }
      } else {
        setError(t("login.error.generic"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
        <h1>{lang==="en"?"Sign in to Pergolando.":"Accedi a Pergolando."}</h1><p className="pv-intro">{lang==="en"?"Your next project starts here.":"Il prossimo progetto comincia qui."}</p>
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
              autoComplete="current-password"
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
          <button className="pv-primary" type="submit" disabled={submitting}>
            {submitting?(lang==="en"?"Signing in…":"Accesso in corso…"):t("login.submit")}
          </button>
        </form>
        <p>
          <Link href="/forgot-password">{t("login.forgotPassword")}</Link>
        </p>
        <p>
          <Link href="/register">{t("login.registerInstead")}</Link>
        </p>
    </AuthShell>
  );
}
