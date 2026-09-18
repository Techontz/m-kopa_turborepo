import { describe, expect, it } from "vitest";

import { CODE128_PATTERNS, code128 } from "./barcode";

describe("code128", () => {
  it("has 106 symbols of 11 modules each", () => {
    expect(CODE128_PATTERNS).toHaveLength(106);
    for (const pattern of CODE128_PATTERNS) {
      expect([...pattern].reduce((sum, width) => sum + Number(width), 0)).toBe(11);
    }
  });

  it("encodes start B, the text, checksum and stop", () => {
    // Start B + 11 characters + checksum = 13 symbols of 11 modules, plus the 13-module stop.
    const widths = code128("C2026093077");
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(13 * 11 + 13);
    expect(widths.slice(0, 6).join("")).toBe("211214");
  });

  it("computes the weighted checksum", () => {
    // "PJJ123C": 104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879; 879 mod 103 = 55 ("311321").
    const widths = code128("PJJ123C").join("");
    expect(widths.slice(-13, -7)).toBe("311321");
  });
});
