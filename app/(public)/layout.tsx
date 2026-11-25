import { SiteFrame } from "@/components/chrome";

// Attendee-facing pages. Unlike (app), these render for signed-out visitors;
// pages that need an account (an order) check the session themselves.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <SiteFrame>{children}</SiteFrame>;
}
