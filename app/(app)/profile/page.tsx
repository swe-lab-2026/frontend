"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, CardHeader, CheckIcon, Checkbox, Field, Input, PageLoader, Select } from "@/components/ui";
import { organizersApi, usersApi } from "@/lib/api/endpoints";
import type { OrganizerProfile, PayoutAccount } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { useOrganizerProfile } from "@/lib/useOrganizerProfile";
import { EMAIL_RE } from "@/lib/validation";

type Feedback = { tone: "success" | "error"; text: string } | null;

function AccountCard() {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.first_name = t.validation.required;
    if (!lastName.trim()) next.last_name = t.validation.required;
    setErrors(next);
    setFeedback(null);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      setUser(await usersApi.updateMe({ first_name: firstName.trim(), last_name: lastName.trim() }));
      setFeedback({ tone: "success", text: t.common.saved });
    } catch (error) {
      setErrors(fieldErrors(error));
      setFeedback({ tone: "error", text: errorMessage(error, t) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card aria-labelledby="account-h">
      <CardHeader
        id="account-h"
        title={t.profile.account}
        description={t.profile.accountHint}
        action={
          user.email_verified_at ? (
            <Badge tone="success">
              <CheckIcon size={14} />
              {t.profile.emailVerified}
            </Badge>
          ) : (
            <Badge tone="warning">{t.profile.emailNotVerified}</Badge>
          )
        }
      />
      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.auth.firstName} error={errors.first_name}>
            {(props) => <Input {...props} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} />}
          </Field>
          <Field label={t.auth.lastName} error={errors.last_name}>
            {(props) => <Input {...props} value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={100} />}
          </Field>
        </div>
        <Field label={t.auth.email}>{(props) => <Input {...props} value={user.email} disabled readOnly />}</Field>
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={saving}>
            {t.common.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}

type OrganizerForm = { display_name: string; legal_name: string; contact_email: string; contact_phone: string };

const VERIFICATION_TONES: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  NOT_SUBMITTED: "neutral",
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
};

function OrganizerCard({ profile, onSaved }: { profile: OrganizerProfile | null; onSaved: (p: OrganizerProfile) => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isNew = profile === null;
  const [form, setForm] = useState<OrganizerForm>({
    display_name: profile?.display_name ?? "",
    legal_name: profile?.legal_name ?? "",
    contact_email: profile?.contact_email ?? user?.email ?? "",
    contact_phone: profile?.contact_phone ?? "",
  });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof OrganizerForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.display_name.trim()) next.display_name = t.validation.required;
    if (form.contact_email.trim() && !EMAIL_RE.test(form.contact_email.trim())) next.contact_email = t.validation.email;
    if (isNew && !terms) next.terms = t.profile.termsRequired;
    setErrors(next);
    setFeedback(null);
    if (Object.keys(next).length) return;

    // Empty optional fields are sent as null so the backend clears them.
    const body = {
      display_name: form.display_name.trim(),
      legal_name: form.legal_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
    };
    setSaving(true);
    try {
      const saved = isNew
        ? await organizersApi.create({ ...body, terms_accepted: true })
        : await organizersApi.update(body);
      onSaved(saved);
      setFeedback({ tone: "success", text: t.common.saved });
    } catch (error) {
      setErrors(fieldErrors(error));
      setFeedback({ tone: "error", text: errorMessage(error, t) });
    } finally {
      setSaving(false);
    }
  }

  const status = profile?.verification_status;
  return (
    <Card aria-labelledby="org-h">
      <CardHeader
        id="org-h"
        title={t.profile.organizer}
        description={t.profile.organizerHint}
        action={
          status && (
            <Badge tone={VERIFICATION_TONES[status] ?? "neutral"}>
              {t.profile.verificationStatus}: {(t.verification as Record<string, string>)[status] ?? status}
            </Badge>
          )
        }
      />
      {isNew && <Alert tone="info">{t.dashboard.needProfile}</Alert>}
      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.profile.displayName} error={errors.display_name}>
            {(props) => <Input {...props} value={form.display_name} onChange={set("display_name")} maxLength={160} />}
          </Field>
          <Field label={t.profile.legalName} optionalLabel={t.common.optional} error={errors.legal_name}>
            {(props) => <Input {...props} value={form.legal_name} onChange={set("legal_name")} maxLength={200} />}
          </Field>
          <Field label={t.profile.contactEmail} optionalLabel={t.common.optional} error={errors.contact_email}>
            {(props) => <Input {...props} type="email" value={form.contact_email} onChange={set("contact_email")} />}
          </Field>
          <Field label={t.profile.contactPhone} optionalLabel={t.common.optional} error={errors.contact_phone}>
            {(props) => <Input {...props} type="tel" placeholder="+7 7XX XXX XX XX" value={form.contact_phone} onChange={set("contact_phone")} maxLength={32} />}
          </Field>
        </div>
        {isNew && (
          <div className="flex flex-col gap-1">
            <Checkbox label={t.profile.acceptTerms} checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            {errors.terms && <span className="text-[13px] text-danger-ink">{errors.terms}</span>}
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={saving}>
            {isNew ? t.profile.createOrganizer : t.common.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PayoutCard() {
  const { t } = useI18n();
  // The backend has no GET for payout accounts yet, so we can only show the
  // account returned by the last save in this session.
  const [current, setCurrent] = useState<PayoutAccount | null>(null);
  const [provider, setProvider] = useState("demo-bank");
  const [accountRef, setAccountRef] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!accountRef.trim()) {
      setError(t.validation.required);
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      setCurrent(await organizersApi.upsertPayoutAccount({ provider, external_account_ref: accountRef.trim(), is_default: isDefault }));
      setAccountRef("");
      setFeedback({ tone: "success", text: t.common.saved });
    } catch (err) {
      setFeedback({ tone: "error", text: errorMessage(err, t) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card aria-labelledby="payout-h">
      <CardHeader
        id="payout-h"
        title={
          <span className="flex items-center gap-2">
            {t.profile.payout} <Badge>{t.profile.demo}</Badge>
          </span>
        }
        description={t.profile.payoutHint}
      />
      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
      {current && (
        <div className="flex items-center gap-3.5 rounded-xl border border-line p-4">
          <span className="flex-1 text-[15px] font-semibold">
            {fmt(t.profile.currentPayout, { provider: current.provider, ref: current.external_account_ref })}
          </span>
          <Badge tone={current.status === "ACTIVE" ? "success" : "neutral"}>
            {(t.payoutStatus as Record<string, string>)[current.status] ?? current.status}
          </Badge>
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.profile.provider}>
            {(props) => (
              <Select {...props} value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="demo-bank">demo-bank</option>
              </Select>
            )}
          </Field>
          <Field label={t.profile.accountRef} error={error}>
            {(props) => <Input {...props} placeholder="KZ00 0000 0000 0000 0000" value={accountRef} onChange={(e) => setAccountRef(e.target.value)} maxLength={200} />}
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox label={t.profile.isDefault} checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          <Button type="submit" variant="secondary" size="lg" loading={saving}>
            {t.profile.savePayout}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function ProfilePage() {
  const { t } = useI18n();
  const { profile, setProfile, loading, error, reload } = useOrganizerProfile();

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">
      <h1 className="text-[32px] font-bold tracking-tight">{t.profile.title}</h1>
      <AccountCard />
      {loading ? (
        <PageLoader label={t.common.loading} />
      ) : error ? (
        <Alert tone="error">
          {errorMessage(error, t)}{" "}
          <button type="button" onClick={reload} className="font-semibold underline">
            {t.common.retry}
          </button>
        </Alert>
      ) : (
        <>
          <OrganizerCard profile={profile} onSaved={setProfile} />
          {profile && <PayoutCard />}
        </>
      )}
    </div>
  );
}
