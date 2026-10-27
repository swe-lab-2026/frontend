"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LOCALE_LABELS, LOCALES, type Locale, useI18n } from "@/lib/i18n/I18nProvider";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-ink">
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9a2 2 0 0 0 2-2V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1a2 2 0 0 0 0 4v1a2 2 0 0 0 0 4v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1a2 2 0 0 0 0-4V9z" />
          <path d="M13 5v14" strokeDasharray="2 2" />
        </svg>
      </span>
      <span className="text-xl font-bold tracking-tight">BiletFlow</span>
    </Link>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{t.common.language}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="h-11 cursor-pointer appearance-none rounded-xl border border-line bg-surface pl-3.5 pr-8 text-[15px] text-ink"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}

/** Header for signed-out pages: logo and language only. */
export function PublicHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo />
        <LanguageSwitcher />
      </div>
    </header>
  );
}

export function AppHeader() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const nav = [
    { href: "/catalog", label: t.nav.catalog },
    { href: "/events", label: t.nav.dashboard },
    { href: "/profile", label: t.nav.profile },
  ];
  const initials = user ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase() : "";

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-7">
          <Logo href="/events" />
          <nav aria-label={t.nav.dashboard} className="flex flex-wrap gap-1">
            {nav.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "rounded-full bg-chip px-4 py-2.5 text-[15px] font-semibold text-ink"
                      : "rounded-full px-4 py-2.5 text-[15px] font-medium text-ink-2 hover:bg-chip"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user && (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink"
              title={`${user.first_name} ${user.last_name}`}
              aria-hidden="true"
            >
              {initials}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-11 rounded-xl px-3 text-[15px] font-medium text-muted hover:bg-chip hover:text-ink"
          >
            {t.nav.signOut}
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * Header for attendee pages, which work signed in or out: signed-in users get
 * a link to their cabinet, everyone else a sign-in link that returns here.
 */
export function SiteHeader() {
  const { t } = useI18n();
  const { status, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.refresh();
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-7">
          <Logo href="/catalog" />
          <nav aria-label={t.nav.catalog} className="flex flex-wrap gap-1">
            <Link
              href="/catalog"
              aria-current={pathname === "/catalog" ? "page" : undefined}
              className="rounded-full px-4 py-2.5 text-[15px] font-medium text-ink-2 hover:bg-chip aria-[current=page]:bg-chip aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            >
              {t.nav.catalog}
            </Link>
            {status === "authenticated" && (
              <Link href="/events" className="rounded-full px-4 py-2.5 text-[15px] font-medium text-ink-2 hover:bg-chip">
                {t.nav.dashboard}
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {status === "authenticated" ? (
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-11 rounded-xl px-3 text-[15px] font-medium text-muted hover:bg-chip hover:text-ink"
            >
              {t.nav.signOut}
            </button>
          ) : status === "anonymous" ? (
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="inline-flex h-11 items-center rounded-xl bg-ink px-4 text-[15px] font-semibold text-white hover:bg-black"
            >
              {t.nav.signIn}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
