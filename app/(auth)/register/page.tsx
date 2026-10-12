"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, CheckIcon, CrossIcon, Field, Input } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { EMAIL_RE, isStrongPassword, passwordRules } from "@/lib/validation";

type Form = { first_name: string; last_name: string; email: string; password: string };

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<Form>({ first_name: "", last_name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [formError, setFormError] = useState<React.ReactNode>(null);
  const [submitting, setSubmitting] = useState(false);

  const rules = passwordRules(form.password);
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.first_name.trim()) next.first_name = t.validation.required;
    if (!form.last_name.trim()) next.last_name = t.validation.required;
    if (!EMAIL_RE.test(form.email.trim())) next.email = t.validation.email;
    if (!isStrongPassword(form.password)) next.password = t.validation.password;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const email = form.email.trim();
      const result = await authApi.register({
        email,
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });
      router.push(`/verify-email?email=${encodeURIComponent(result.email)}&ttl=${result.code_expires_in}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_ALREADY_EXISTS") {
        setErrors({ email: t.errors.EMAIL_ALREADY_EXISTS });
      } else {
        setErrors(fieldErrors(error));
        setFormError(errorMessage(error, t));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const ruleList = [
    { ok: rules.length, label: t.auth.ruleLength },
    { ok: rules.mixedCase, label: t.auth.ruleCase },
    { ok: rules.digit, label: t.auth.ruleDigit },
  ];

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-tight">{t.auth.registerTitle}</h1>
        <p className="text-[15px] text-muted">{t.auth.registerSubtitle}</p>
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.auth.firstName} error={errors.first_name}>
            {(props) => <Input {...props} autoComplete="given-name" value={form.first_name} onChange={set("first_name")} maxLength={100} />}
          </Field>
          <Field label={t.auth.lastName} error={errors.last_name}>
            {(props) => <Input {...props} autoComplete="family-name" value={form.last_name} onChange={set("last_name")} maxLength={100} />}
          </Field>
        </div>
        <Field label={t.auth.email} error={errors.email}>
          {(props) => <Input {...props} type="email" autoComplete="email" value={form.email} onChange={set("email")} />}
        </Field>
        <Field label={t.auth.password} error={errors.password}>
          {(props) => (
            <Input {...props} type="password" autoComplete="new-password" value={form.password} onChange={set("password")} maxLength={128} />
          )}
        </Field>
        <ul className="-mt-2 flex flex-col gap-1 text-[13px]" aria-label={t.auth.passwordHint}>
          {ruleList.map((rule) => (
            <li key={rule.label} className={`flex items-center gap-1.5 ${rule.ok ? "text-brand-ink" : "text-muted"}`}>
              {rule.ok ? <CheckIcon size={14} /> : <CrossIcon size={14} />}
              {rule.label}
            </li>
          ))}
        </ul>
        <Button type="submit" size="lg" loading={submitting} className="mt-2 h-[52px]">
          {submitting ? t.auth.registering : t.auth.registerButton}
        </Button>
      </form>

      <p className="text-center text-[15px] text-muted">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-brand-ink hover:underline">
          {t.auth.signInButton}
        </Link>
      </p>
    </>
  );
}
