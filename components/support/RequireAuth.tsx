"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Alert, PageLoader } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Sends signed-out visitors to sign in and back here, query included. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, ended } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();

  useEffect(() => {
    if (status !== "anonymous") return;
    // After signing out, the next person need not land on this one's page.
    const next = query ? `${pathname}?${query}` : pathname;
    router.replace(ended === "signedOut" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  }, [status, ended, router, pathname, query]);

  if (status === "unreachable") return <Alert tone="error">{t.common.networkError}</Alert>;
  if (status !== "authenticated") return <PageLoader label={t.common.loading} />;
  return children;
}
