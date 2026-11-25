"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { PageLoader } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Sends signed-out visitors to sign in and back here, query included. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(query ? `${pathname}?${query}` : pathname)}`);
  }, [status, router, pathname, query]);

  if (status !== "authenticated") return <PageLoader label={t.common.loading} />;
  return children;
}
