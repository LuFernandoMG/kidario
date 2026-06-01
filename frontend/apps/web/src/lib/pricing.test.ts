import { describe, expect, it } from "vitest";

import { calculateParentCheckoutTotalCents, calculateParentServiceFeeCents, formatCurrencyCents } from "@/lib/pricing";

describe("pricing helpers", () => {
  it("adds the parent service fee over the lesson base amount", () => {
    expect(calculateParentServiceFeeCents(32000)).toBe(2560);
    expect(calculateParentCheckoutTotalCents(32000)).toBe(34560);
    expect(formatCurrencyCents(34560)).toBe("R$ 345,60");
  });
});
