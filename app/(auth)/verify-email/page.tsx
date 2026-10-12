"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { EMAIL_RE } from "@/lib/validation";

// Matches the backend default EMAIL_CODE_RESEND_COOLDOWN_SECONDS; the real
// value comes back as retry_after once the user requests a resend.
const INITIAL_COOLDOWN_SECONDS = 60;

function VerifyForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const emailFromUrl = params.get("email") ?? "";
  const ttlSeconds = Number(params.get("ttl")) || 600;

  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(params.get("ttl") ? INITIAL_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function checkEmail(): boolean {
    const ok = EMAIL_RE.test(email.trim());
    setEmailError(ok ? undefined : t.validation.email);
    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    const codeOk = /^\d{6}$/.test(code);
    setCodeError(codeOk ? undefined : t.validation.code);
    if (!checkEmail() || !codeOk) return;

    setSubmitting(true);
    try {
      await authApi.verifyEmail(email.trim(), code);
      router.replace(`/login?verified=1&email=${encodeURIComponent(email.trim())}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_ALREADY_VERIFIED") {
        router.replace(`/login?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setFormError(errorMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setFormError(null);
    setNotice(null);
    if (!checkEmail()) return;
    setResending(true);
    try {
      const result = await authApi.resendVerification(email.trim());
      setCooldown(result.retry_after || INITIAL_COOLDOWN_SECONDS);
      setNotice(t.auth.resent);
    } catch (error) {
      const retryAfter = error instanceof ApiError ? Number(error.details.retry_after) : NaN;
      if (retryAfter > 0) setCooldown(retryAfter);
      setFormError(errorMessage(error, t));
    } finally {
      setResending(false);
    }
  }

  const minutes = Math.max(1, Math.round(ttlSeconds / 60));
  const mm = Math.floor(cooldown / 60);
  const ss = String(cooldown % 60).padStart(2, "0");

  return (
    <>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </svg>
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-tight">{t.auth.verifyTitle}</h1>
        <p className="text-[15px] leading-normal text-muted">
          {emailFromUrl ? fmt(t.auth.verifyText, { email: emailFromUrl, minutes }) : t.auth.verifyTextNoEmail}
        </p>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {formError && <Alert tone="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {!emailFromUrl && (
          <Field label={t.auth.email} error={emailError}>
            {(props) => <Input {...props} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
        )}
        <Field label={t.auth.code} error={codeError}>
          {(props) => (
            <Input
              {...props}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${props.className} h-16 text-center text-[28px] font-semibold tracking-[0.3em]`}
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={submitting} className="h-[52px]">
          {submitting ? t.auth.verifying : t.auth.verifyButton}
        </Button>
      </form>

      <div className="flex flex-col items-center gap-1.5">
        <Button variant="ghost" onClick={handleResend} disabled={cooldown > 0} loading={resending}>
          {t.auth.resend}
        </Button>
        {cooldown > 0 && (
          <span className="text-[13px] text-muted" aria-live="polite">
            {fmt(t.auth.resendIn, { time: `${mm}:${ss}` })}
          </span>
        )}
        {process.env.NODE_ENV === "development" && <span className="text-[13px] text-subtle">{t.auth.devCodeHint}</span>}
      </div>

      <p className="text-center text-[15px] text-muted">
        <Link href="/login" className="font-semibold text-brand-ink hover:underline">
          {t.auth.backToLogin}
        </Link>
      </p>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
