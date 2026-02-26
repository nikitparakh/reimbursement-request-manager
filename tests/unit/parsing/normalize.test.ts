import { describe, expect, it } from "vitest";
import { normalizeExtractedText } from "@/lib/parsing/normalize";

describe("receipt normalization", () => {
  it("detects W9 documents", () => {
    const result = normalizeExtractedText("Form W-9 Request for Taxpayer Identification Number");
    expect(result.documentType).toBe("W9");
  });

  it("extracts a total amount when available", () => {
    const result = normalizeExtractedText("Order Total: $42.15\nReceipt");
    expect(result.total).toBe(42.15);
  });
});
