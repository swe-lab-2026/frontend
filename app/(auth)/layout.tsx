import { PublicHeader, SiteFooter } from "@/components/chrome";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-[460px] flex-col gap-6 rounded-[20px] bg-surface p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.06)] sm:p-10">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
