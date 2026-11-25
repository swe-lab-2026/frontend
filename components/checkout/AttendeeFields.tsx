"use client";

import { Field, Input } from "@/components/ui";
import { ATTENDEE_NAME_MAX, type AttendeeDraft, type AttendeeErrors, type AttendeeSlot, EMPTY_ATTENDEE } from "@/lib/attendees";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  slots: AttendeeSlot[];
  /** Ticket type names by id. */
  names: Record<string, string>;
  drafts: Record<string, AttendeeDraft>;
  errors: Record<string, AttendeeErrors>;
  disabled: boolean;
  onChange: (key: string, draft: AttendeeDraft) => void;
};

/** Name and email for every ticket in the selection. */
export function AttendeeFields({ slots, names, drafts, errors, disabled, onChange }: Props) {
  const { t } = useI18n();
  const message = (code: "required" | "email" | undefined) => code && t.validation[code];

  return (
    <div className="flex flex-col gap-5">
      {slots.map(({ key, ticket_type_id, number, total }) => {
        const draft = drafts[key] ?? EMPTY_ATTENDEE;
        return (
          <fieldset key={key} disabled={disabled} className="flex min-w-0 flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold text-ink-2">
              {total > 1 ? fmt(t.attend.attendeeOf, { ticket: names[ticket_type_id] ?? "", number, total }) : names[ticket_type_id]}
            </legend>
            <Field label={t.attend.attendeeName} error={message(errors[key]?.full_name)}>
              {(props) => (
                <Input
                  {...props}
                  value={draft.full_name}
                  maxLength={ATTENDEE_NAME_MAX}
                  autoComplete="off"
                  required
                  onChange={(e) => onChange(key, { ...draft, full_name: e.target.value })}
                />
              )}
            </Field>
            <Field label={t.attend.attendeeEmail} error={message(errors[key]?.email)}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={draft.email}
                  maxLength={254}
                  autoComplete="off"
                  required
                  onChange={(e) => onChange(key, { ...draft, email: e.target.value })}
                />
              )}
            </Field>
          </fieldset>
        );
      })}
    </div>
  );
}
