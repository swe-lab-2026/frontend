"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Alert } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ADMIN_SECTIONS } from "./sections";

// Only hides screens that would be empty: every admin route checks the role
// on the server.
export default function AdminLayout({ children }: LayoutProps<"/">) {
  const { t } = useI18n();
  const { user } = useAuth();
  const pathname = usePathname();

  if (user?.global_role !== "PLATFORM_ADMIN") return <Alert tone="error">{t.admin.denied}</Alert>;
  return (
    <>
      <h1 className="text-[32px] font-bold tracking-tight">{t.admin.title}</h1>
      <nav aria-label={t.admin.title} className="flex flex-wrap gap-1 border-b border-[#e1e4e8]">
        {ADMIN_SECTIONS.map((key) => {
          const active = pathname === `/admin/${key}`;
          return (
            <Link
              key={key}
              href={`/admin/${key}`}
              aria-current={active ? "page" : undefined}
              className={active ? "-mb-px border-b-2 border-brand px-4 py-3 text-[15px] font-semibold text-ink" : "px-4 py-3 text-[15px] font-medium text-muted hover:text-ink"}
            >
              {t.admin.sections[key]}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}
