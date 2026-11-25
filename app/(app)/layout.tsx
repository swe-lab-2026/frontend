import { Suspense } from "react";
import { SiteFrame } from "@/components/chrome";
import { RequireAuth } from "@/components/support/RequireAuth";

// Client-side route protection. The backend still enforces every permission;
// this only keeps signed-out users from seeing empty screens.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SiteFrame>
      <Suspense>
        <RequireAuth>{children}</RequireAuth>
      </Suspense>
    </SiteFrame>
  );
}
