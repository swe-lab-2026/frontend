import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/en";
import kk from "@/lib/i18n/kk";
import ru from "@/lib/i18n/ru";
import { PRICE_RE, isStrongPassword } from "@/lib/validation";

describe("password rules (mirror backend RegisterRequest)", () => {
  it.each([
    ["Biletflow2026", true],
    ["biletflow2026", false],
    ["BILETFLOW2026", false],
    ["Biletflow", false],
    ["Bf1", false],
  ])("%s -> %s", (password, ok) => expect(isStrongPassword(password)).toBe(ok));
});

describe("price format", () => {
  it.each([["0", true], ["5000", true], ["49.99", true], ["1.999", false], ["-5", false], ["abc", false]])(
    "%s -> %s",
    (price, ok) => expect(PRICE_RE.test(price)).toBe(ok),
  );
});

describe("dictionaries", () => {
  const keys = (obj: object, prefix = ""): string[] =>
    Object.entries(obj).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`])).sort();

  it("ru and kk define exactly the English keys", () => {
    expect(keys(ru)).toEqual(keys(en));
    expect(keys(kk)).toEqual(keys(en));
  });
});
