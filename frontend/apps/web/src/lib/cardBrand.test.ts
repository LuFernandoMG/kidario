import { describe, expect, it } from "vitest";

import {
  CARD_EXPIRATION_MONTH_OPTIONS,
  buildCardExpirationYearOptions,
  detectCardBrand,
  formatCardCvv,
  formatCardExpirationMonth,
  formatCardExpirationYear,
  formatCardNumber,
  isFutureCardExpirationYear,
  isValidCardExpirationMonth,
  normalizeCardExpirationMonth,
} from "@/lib/cardBrand";

describe("cardBrand helpers", () => {
  it("formats card number using four-digit groups", () => {
    expect(formatCardNumber("4000000000000010")).toBe("4000 0000 0000 0010");
    expect(formatCardNumber("4000 0000 0000 0010 9999")).toBe("4000 0000 0000 0010");
  });

  it("detects common card brands", () => {
    expect(detectCardBrand("4000 0000 0000 0010")?.label).toBe("Visa");
    expect(detectCardBrand("5555 5555 5555 4444")?.label).toBe("Mastercard");
    expect(detectCardBrand("3782 822463 10005")?.label).toBe("Amex");
    expect(detectCardBrand("6362 9700 0000 0000")?.label).toBe("Elo");
  });

  it("limits expiration month to valid month input", () => {
    expect(formatCardExpirationMonth("ab01")).toBe("01");
    expect(formatCardExpirationMonth("12")).toBe("12");
    expect(formatCardExpirationMonth("13")).toBe("1");
    expect(formatCardExpirationMonth("00")).toBe("");
    expect(normalizeCardExpirationMonth("9")).toBe("09");
    expect(isValidCardExpirationMonth("09")).toBe(true);
    expect(isValidCardExpirationMonth("9")).toBe(false);
  });

  it("accepts only future four-digit expiration years", () => {
    expect(formatCardExpirationYear("2030", "", 2026)).toBe("2030");
    expect(formatCardExpirationYear("2026", "202", 2026)).toBe("202");
    expect(formatCardExpirationYear("20ab27", "", 2026)).toBe("2027");
    expect(isFutureCardExpirationYear("2030", 2026)).toBe(true);
    expect(isFutureCardExpirationYear("2026", 2026)).toBe(false);
    expect(isFutureCardExpirationYear("2051", 2026)).toBe(false);
  });

  it("limits cvv to numeric input with four digits", () => {
    expect(formatCardCvv("12a345")).toBe("1234");
  });

  it("builds dropdown options for expiration date", () => {
    expect(CARD_EXPIRATION_MONTH_OPTIONS).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
    ]);
    expect(buildCardExpirationYearOptions(2026)).toEqual(
      expect.arrayContaining(["2027", "2050"]),
    );
    expect(buildCardExpirationYearOptions(2026)).not.toContain("2026");
    expect(buildCardExpirationYearOptions(2050)).toEqual([]);
  });
});
