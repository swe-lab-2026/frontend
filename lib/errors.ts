import { ApiError } from "@/lib/api/client";
import type { Dictionary } from "@/lib/i18n/en";

/** Localized, user-facing message for any thrown value. */
export function errorMessage(error: unknown, t: Dictionary): string {
  if (error instanceof ApiError) {
    const known = (t.errors as Record<string, string>)[error.code];
    if (known) return known;
    // Next's dev proxy answers 500 with a non-JSON body when the backend is down.
    if (error.code === "HTTP_ERROR" && error.status >= 500) return t.common.networkError;
    return error.message || t.common.unknownError;
  }
  if (error instanceof TypeError) return t.common.networkError;
  return t.common.unknownError;
}

/** Backend field errors (Pydantic) keyed by field name, empty for other errors. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError && error.code === "VALIDATION_ERROR" ? error.fieldErrors() : {};
}

/** Translates the backend's publish-readiness strings, falling back to the raw text. */
export function publishErrorLabel(message: string, t: Dictionary): string {
  return (t.publishErrors as Record<string, string>)[message] ?? message;
}
