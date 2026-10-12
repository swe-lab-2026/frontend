// Client-side checks mirror the backend's Pydantic rules so users see errors
// before a round trip; the backend remains the source of truth.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function passwordRules(password: string) {
  return {
    length: password.length >= 8 && password.length <= 128,
    mixedCase: /[a-zа-яё]/.test(password) && /[A-ZА-ЯЁ]/.test(password),
    digit: /\d/.test(password),
  };
}

export function isStrongPassword(password: string): boolean {
  const rules = passwordRules(password);
  return rules.length && rules.mixedCase && rules.digit;
}

/** Up to 2 decimal places, non-negative. */
export const PRICE_RE = /^\d+(\.\d{1,2})?$/;
