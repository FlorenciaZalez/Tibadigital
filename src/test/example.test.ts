import { describe, it, expect } from "vitest";
import { computeFinalPrice, roundUpPrice } from "@/lib/pricing";

describe("pricing rounding", () => {
  it("rounds raw prices up to the next multiple of 10", () => {
    expect(roundUpPrice(1213)).toBe(1220);
    expect(roundUpPrice(1218)).toBe(1220);
    expect(roundUpPrice(1220)).toBe(1220);
  });

  it("applies markup and then rounds up to the next multiple of 10", () => {
    expect(computeFinalPrice(1103, 10)).toBe(1220);
  });
});
