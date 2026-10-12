"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "@/components/chrome";
import { PageLoader } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";

// Client-side route protection. The backend still enforces every permission;
// this only keeps signed-out users from seeing empty screens.
export default function AppLayout({ children }: LayoutProps<"/">) {
  const { status } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return <PageLoader label={t.common.loading} />;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pb-16 pt-8 sm:px-6">{children}</main>
    </div>
  );
}
