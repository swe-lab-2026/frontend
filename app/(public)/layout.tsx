import { SiteHeader } from "@/components/chrome";

// Attendee-facing pages. Unlike (app), these render for signed-out visitors;
// pages that need an account (an order) check the session themselves.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pb-16 pt-8 sm:px-6">{children}</main>
      <footer className="px-4 py-6 text-center text-[13px] text-muted">© 2026 BiletFlow · CSCI 361</footer>
    </div>
  );
}
