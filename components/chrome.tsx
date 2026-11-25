"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notifications/NotificationBell";
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

export function SiteFooter() {
  return <footer className="px-4 py-6 text-center text-[13px] text-muted">© 2026 BiletFlow · CSCI 361</footer>;
}

/** Header of the sign-in pages: logo and language only. */
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

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="shrink-0 whitespace-nowrap rounded-full px-3 py-2.5 text-[15px] font-medium text-ink-2 hover:bg-chip aria-[current=page]:bg-chip aria-[current=page]:font-semibold aria-[current=page]:text-ink"
    >
      {label}
    </Link>
  );
}

/**
 * The one header of every page outside sign-in. Some of those pages also work
 * signed out: there it shows only the catalog and a sign-in link that returns
 * to the same page.
 */
function SiteHeader() {
  const { t } = useI18n();
  const { status, user, logout } = useAuth();
  const pathname = usePathname();

  const initials = user ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase() : "";

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        <Logo href="/catalog" />
        {/* Below the first row on narrow screens, where it scrolls sideways instead of taking several rows. */}
        <nav aria-label={t.nav.menu} className="order-last -mx-1 flex w-full gap-1 overflow-x-auto p-1 xl:order-none xl:mx-0 xl:w-auto xl:flex-1 xl:overflow-visible xl:p-0">
          <NavLink href="/catalog" label={t.nav.catalog} />
          {user && (
            <>
              <NavLink href="/orders" label={t.nav.orders} />
              <NavLink href="/events" label={t.nav.dashboard} />
              <NavLink href="/support" label={t.nav.support} />
              <NavLink href="/profile" label={t.nav.profile} />
              {user.global_role === "PLATFORM_ADMIN" && <NavLink href="/admin" label={t.nav.admin} />}
            </>
          )}
        </nav>
        <div className="flex min-h-11 items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          {user && (
            <>
              <NotificationBell />
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink"
                title={`${user.first_name} ${user.last_name}`}
                aria-hidden="true"
              >
                {initials}
              </span>
              {/* Pages that need an account send signed-out visitors to sign-in themselves. */}
              <button
                type="button"
                onClick={logout}
                className="min-h-11 rounded-xl px-3 text-[15px] font-medium text-muted hover:bg-chip hover:text-ink"
              >
                {t.nav.signOut}
              </button>
            </>
          )}
          {status === "anonymous" && (
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="inline-flex h-11 items-center rounded-xl bg-ink px-4 text-[15px] font-semibold text-white hover:bg-black"
            >
              {t.nav.signIn}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** Header, page width and footer shared by every page outside sign-in. */
export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pb-16 pt-8 sm:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
