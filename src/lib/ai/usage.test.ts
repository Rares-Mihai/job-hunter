import { describe, expect, it } from "vitest";
import { describeLimit, readLimit } from "./usage";

describe("readLimit", () => {
  it("uses a positive whole number from the environment", () => {
    expect(readLimit("50", 20)).toBe(50);
  });

  it("falls back on anything else", () => {
    expect(readLimit(undefined, 20)).toBe(20);
    expect(readLimit("", 20)).toBe(20);
    expect(readLimit("0", 20)).toBe(20);
    expect(readLimit("-5", 20)).toBe(20);
    expect(readLimit("2.5", 20)).toBe(20);
    expect(readLimit("lots", 20)).toBe(20);
  });
});

describe("describeLimit", () => {
  it("tells the user which limit was reached", () => {
    expect(describeLimit("user-limit")).toContain("You have used");
    expect(describeLimit("total-limit")).toContain("The app has reached");
  });
});
