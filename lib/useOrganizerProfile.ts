"use client";

import { ApiError } from "@/lib/api/client";
import { organizersApi } from "@/lib/api/endpoints";
import type { OrganizerProfile } from "@/lib/api/types";
import { useApi } from "@/lib/useApi";

/**
 * Loads the caller's organizer profile. `profile` is null when the user has
 * none yet (backend answers 404 ORGANIZER_PROFILE_NOT_FOUND).
 */
export function useOrganizerProfile() {
  const { data, error, loading, reload, setData } = useApi<OrganizerProfile | null>(
    () =>
      organizersApi.me().catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
    [],
  );
  return { profile: data ?? null, setProfile: setData, loading, error, reload };
}
