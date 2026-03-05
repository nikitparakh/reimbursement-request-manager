import { describe, expect, it } from "vitest";
import { inferTax } from "@/lib/reimbursements/serialize-receipts";

describe("inferTax", () => {
  it("returns explicit tax when positive", () => {
    expect(inferTax(8.5, 108.5, 100)).toBe(8.5);
  });

  it("prefers explicit tax over inferred gap", () => {
    expect(inferTax(5, 110, 100)).toBe(5);
  });

  it("infers tax from gap between total and line items sum", () => {
    expect(inferTax(0, 108.5, 100)).toBe(8.5);
  });

  it("returns 0 when total equals line items sum", () => {
    expect(inferTax(0, 100, 100)).toBe(0);
  });

  it("returns 0 when total is less than line items sum", () => {
    expect(inferTax(0, 90, 100)).toBe(0);
  });

  it("returns 0 when all values are zero", () => {
    expect(inferTax(0, 0, 0)).toBe(0);
  });

  it("rounds inferred tax to 2 decimal places", () => {
    expect(inferTax(0, 33.33, 30.0)).toBe(3.33);
  });

  it("handles floating-point precision for small amounts", () => {
    const result = inferTax(0, 10.1, 9.8);
    expect(result).toBeCloseTo(0.3, 2);
  });
});
