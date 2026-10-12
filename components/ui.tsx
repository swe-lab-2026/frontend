import Link from "next/link";
import { forwardRef, useId } from "react";
import type { EventStatus } from "@/lib/api/types";

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ---------- Buttons ----------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline" | "dark";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover disabled:bg-[#e1e4e8] disabled:text-muted",
  secondary: "border border-field bg-surface text-ink hover:bg-canvas disabled:text-subtle",
  ghost: "bg-transparent text-ink-2 hover:bg-chip disabled:text-subtle",
  danger: "bg-danger text-white hover:bg-[#a82b08] disabled:opacity-60",
  "danger-outline": "border border-[#f0b8b1] bg-surface text-danger-ink hover:bg-danger-soft",
  dark: "bg-ink text-white hover:bg-black disabled:opacity-60",
};

const SIZES: Record<Size, string> = {
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-6 text-base",
};

function buttonClass(variant: Variant, size: Size, extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type LinkButtonProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function LinkButton({ variant = "primary", size = "md", className, ...rest }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Form fields ----------

const FIELD_BASE =
  "w-full min-w-0 rounded-xl border bg-surface px-3.5 text-base text-ink placeholder:text-subtle focus:outline-2 focus:outline-offset-1 focus:outline-brand disabled:bg-[#f7f8f9] disabled:text-muted";

type FieldProps = {
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  optionalLabel?: string;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string; className: string }) => React.ReactNode;
};

/** Label + control + hint/error, wired for accessibility. */
export function Field({ label, error, hint, optionalLabel, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-msg`;
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optionalLabel && <span className="font-normal text-muted"> · {optionalLabel}</span>}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? messageId : undefined,
        className: cx(FIELD_BASE, error ? "border-[#d92d20]" : "border-field"),
      })}
      {error ? (
        <span id={messageId} className="text-[13px] text-danger-ink">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className="text-[13px] text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx("h-12", className)} {...rest} />;
  },
);

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("resize-y py-3 leading-normal", className)} {...rest} />;
}

export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("h-12 px-3", className)} {...rest} />;
}

export function Checkbox({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
      <input type="checkbox" className="h-5 w-5 accent-brand" {...rest} />
      {label}
    </label>
  );
}

// ---------- Surfaces and feedback ----------

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx("flex flex-col gap-5 rounded-2xl bg-surface p-6 sm:p-7", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action, id }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-xl font-bold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = "success" | "error" | "info" | "warning";

const ALERT_TONES: Record<Tone, string> = {
  success: "bg-brand-soft text-brand-ink",
  error: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
  warning: "bg-warn-soft text-[#6b4500]",
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm leading-normal", ALERT_TONES[tone])}>
      {tone === "success" ? <CheckIcon className="mt-0.5 shrink-0" /> : <InfoIcon className="mt-0.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-chip text-ink-2",
  success: "bg-brand-soft text-brand-ink",
  warning: "bg-warn-soft text-warn-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<EventStatus, keyof typeof BADGE_TONES> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  UNPUBLISHED: "warning",
  CANCELLED: "danger",
  COMPLETED: "info",
};

export function StatusBadge({ status, label }: { status: EventStatus; label: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{label}</Badge>;
}

export function PageLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-muted" role="status">
      <Spinner className="h-5 w-5" />
      {label}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {children}
    </Link>
  );
}

// ---------- Icons ----------

type IconProps = { className?: string; size?: number };

export function CheckIcon({ className, size = 18 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CrossIcon({ className, size = 18 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function InfoIcon({ className, size = 18 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function PlusIcon({ className, size = 18 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
