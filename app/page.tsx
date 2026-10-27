"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageLoader } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";

// Entry point: signed-in users go to their cabinet, visitors to the public catalog.
export default function Home() {
  const { status } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/events");
    if (status === "anonymous") router.replace("/catalog");
  }, [status, router]);

  return <PageLoader label={t.common.loading} />;
}
