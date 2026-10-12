"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { EMAIL_RE } from "@/lib/validation";

function LoginForm() {
  const { t } = useI18n();
  const { login, status } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/events");
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = t.validation.email;
    if (!password) next.password = t.validation.required;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/events");
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_NOT_VERIFIED") {
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setFormError(errorMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-tight">{t.auth.signInTitle}</h1>
        <p className="text-[15px] text-muted">{t.auth.signInSubtitle}</p>
      </div>

      {params.get("verified") && <Alert tone="success">{t.auth.verified}</Alert>}
      {params.get("expired") && <Alert tone="info">{t.auth.sessionExpired}</Alert>}
      {formError && <Alert tone="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label={t.auth.email} error={errors.email}>
          {(props) => (
            <Input {...props} type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field label={t.auth.password} error={errors.password}>
          {(props) => (
            <Input {...props} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Button type="submit" size="lg" loading={submitting} className="mt-2 h-[52px]">
          {submitting ? t.auth.signingIn : t.auth.signInButton}
        </Button>
      </form>

      <p className="text-center text-[15px] text-muted">
        {t.auth.noAccount}{" "}
        <Link href="/register" className="font-semibold text-brand-ink hover:underline">
          {t.auth.register}
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
