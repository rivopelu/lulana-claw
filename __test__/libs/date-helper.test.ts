import { describe, expect, it } from "bun:test";
import DateHelper from "../../src/libs/date-helper";

describe("DateHelper", () => {
  describe("getEpochMs", () => {
    it("should return a number", () => {
      expect(typeof DateHelper.getEpochMs()).toBe("number");
    });

    it("should be within range of Date.now()", () => {
      const before = Date.now();
      const result = DateHelper.getEpochMs();
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });

    it("should return a positive integer", () => {
      expect(DateHelper.getEpochMs()).toBeGreaterThan(0);
    });

    it("should return values that increase over time", async () => {
      const first = DateHelper.getEpochMs();
      await new Promise((r) => setTimeout(r, 5));
      const second = DateHelper.getEpochMs();
      expect(second).toBeGreaterThanOrEqual(first);
    });
  });
});
