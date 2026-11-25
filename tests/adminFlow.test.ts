import { describe, expect, it } from "vitest";
import { canDispute, disputeMoves, parseSetting, reportMoves } from "@/lib/adminFlow";
import { imageProblem, MAX_IMAGE_BYTES } from "@/lib/images";

describe("review steps", () => {
  it("never reopens a closed record", () => {
    for (const status of ["RESOLVED", "REJECTED"]) expect(disputeMoves(status)).toEqual([]);
    for (const status of ["RESOLVED", "DISMISSED"]) expect(reportMoves(status)).toEqual([]);
  });
  it("returns a report, but not a dispute, to the queue", () => {
    expect(reportMoves("UNDER_REVIEW")).toContain("OPEN");
    expect(disputeMoves("UNDER_REVIEW")).not.toContain("OPEN");
  });
  it("offers nothing for a status it does not know", () => {
    expect(reportMoves("NEW")).toEqual([]);
    expect(disputeMoves("NEW")).toEqual([]);
  });
  it("disputes only payments that took money", () => {
    expect(["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"].every(canDispute)).toBe(true);
    expect(["PENDING", "FAILED", "CANCELLED"].some(canDispute)).toBe(false);
  });
});

describe("parseSetting", () => {
  it.each([["1000", "1000"], [" 2.5 ", "2.5"], ["2,75", "2.75"], ["0", "0"], ["20", "20"]])("accepts %s", (value, out) =>
    expect(parseSetting(value, 1000)).toBe(out));
  it.each(["", "-1", "1.234", "1e3", "abc", "1001"])("refuses %s", (value) => expect(parseSetting(value, 1000)).toBeNull());
});

describe("imageProblem", () => {
  it("accepts an image at the limit", () => expect(imageProblem({ type: "image/png", size: MAX_IMAGE_BYTES })).toBeNull());
  it("names what is wrong", () => {
    expect(imageProblem({ type: "image/svg+xml", size: 10 })).toBe("UNSUPPORTED_IMAGE");
    expect(imageProblem({ type: "image/webp", size: MAX_IMAGE_BYTES + 1 })).toBe("UPLOAD_TOO_LARGE");
    expect(imageProblem({ type: "image/jpeg", size: 0 })).toBe("EMPTY_UPLOAD");
  });
});
