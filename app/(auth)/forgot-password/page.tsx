"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { EMAIL_RE } from "@/lib/validation";

function ForgotPasswordForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ email: string; minutes: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    setFormError(null);
    if (!EMAIL_RE.test(value)) {
      setError(t.validation.email);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      const result = await authApi.requestPasswordReset(value);
      setSent({ email: result.email, minutes: Math.max(1, Math.round(result.code_expires_in / 60)) });
    } catch (err) {
      setFormError(errorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-tight">{t.auth.forgotTitle}</h1>
        <p className="text-[15px] text-muted">{t.auth.forgotText}</p>
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}

      {sent ? (
        // Same message whether or not the account exists: the backend does not
        // reveal it, and neither does the page.
        <Alert tone="success">{fmt(t.auth.forgotSent, { email: sent.email, minutes: sent.minutes })}</Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field label={t.auth.email} error={error}>
            {(props) => (
              <Input {...props} type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <Button type="submit" size="lg" loading={submitting} className="mt-2 h-[52px]">
            {submitting ? t.auth.forgotSending : t.auth.forgotButton}
          </Button>
        </form>
      )}

      <p className="text-center text-[15px]">
        <Link href={`/login${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="font-semibold text-brand-ink hover:underline">
          {t.auth.backToLogin}
        </Link>
      </p>
    </>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
