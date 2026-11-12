"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Button, CheckIcon, CrossIcon, Field, Input } from "@/components/ui";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { EMAIL_RE, isStrongPassword, passwordRules } from "@/lib/validation";

type Errors = { email?: string; token?: string; password?: string; confirm?: string };

/**
 * Opened from the reset email: /reset-password?email=...&token=...
 * Email and token are prefilled from the link; if the link was cut off, both
 * can still be typed in.
 */
function ResetPasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const fromLink = Boolean(params.get("email") && params.get("token"));

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rules = passwordRules(password);
  const ruleList = [
    { ok: rules.length, label: t.auth.ruleLength },
    { ok: rules.mixedCase, label: t.auth.ruleCase },
    { ok: rules.digit, label: t.auth.ruleDigit },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = t.validation.email;
    if (token.trim().length < 16) next.token = t.validation.resetToken;
    if (!isStrongPassword(password)) next.password = t.validation.password;
    if (confirm !== password) next.confirm = t.validation.passwordMismatch;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const result = await authApi.resetPassword(email.trim(), token.trim(), password);
      router.replace(`/login?reset=1&email=${encodeURIComponent(result.email)}`);
    } catch (err) {
      const fields = fieldErrors(err);
      if (fields.new_password) setErrors({ password: fields.new_password });
      setFormError(errorMessage(err, t));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-tight">{t.auth.resetTitle}</h1>
        <p className="text-[15px] text-muted">{fromLink ? t.auth.resetText : t.auth.resetManualText}</p>
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {!fromLink && (
          <>
            <Field label={t.auth.email} error={errors.email}>
              {(props) => (
                <Input {...props} type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
            </Field>
            <Field label={t.auth.resetToken} error={errors.token}>
              {(props) => <Input {...props} autoComplete="one-time-code" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} />}
            </Field>
          </>
        )}
        <Field label={t.auth.newPassword} error={errors.password}>
          {(props) => <Input {...props} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <ul className="-mt-2 flex flex-col gap-1 text-[13px]" aria-label={t.auth.passwordHint}>
          {ruleList.map((rule) => (
            <li key={rule.label} className={`flex items-center gap-1.5 ${rule.ok ? "text-brand-ink" : "text-muted"}`}>
              {rule.ok ? <CheckIcon size={14} /> : <CrossIcon size={14} />}
              {rule.label}
            </li>
          ))}
        </ul>
        <Field label={t.auth.confirmPassword} error={errors.confirm}>
          {(props) => <Input {...props} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <Button type="submit" size="lg" loading={submitting} className="mt-2 h-[52px]">
          {submitting ? t.auth.resetting : t.auth.resetButton}
        </Button>
      </form>

      <p className="text-center text-[15px] text-muted">
        <Link href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="font-semibold text-brand-ink hover:underline">
          {t.auth.resetRequestNew}
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
