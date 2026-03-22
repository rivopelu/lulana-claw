import { describe, expect, it } from "bun:test";
import { generateId, generateProfilePicture } from "../../src/libs/string-utils";

describe("generateId", () => {
  it("should return a string", () => {
    expect(typeof generateId()).toBe("string");
  });

  it("should not contain dashes", () => {
    expect(generateId()).not.toContain("-");
  });

  it("should be uppercase", () => {
    const id = generateId();
    expect(id).toBe(id.toUpperCase());
  });

  it("should be 32 characters long", () => {
    expect(generateId()).toHaveLength(32);
  });

  it("should generate unique values", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId()));
    expect(ids.size).toBe(200);
  });
});

describe("generateProfilePicture", () => {
  it("should return a URL string", () => {
    const url = generateProfilePicture("John");
    expect(url).toContain("https://");
  });

  it("should embed the name in the URL", () => {
    expect(generateProfilePicture("Alice")).toContain("Alice");
  });

  it("should include background=random parameter", () => {
    expect(generateProfilePicture("Test")).toContain("background=random");
  });

  it("should use ui-avatars.com domain", () => {
    expect(generateProfilePicture("Test")).toContain("ui-avatars.com");
  });
});
