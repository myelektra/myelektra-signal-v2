import { describe, expect, test } from "bun:test";

import { DOMAIN_PACKAGE, DOMAIN_VERSION, isNonEmptyString } from "./index";

describe("@myelektra/domain placeholder surface", () => {
  test("exposes its identity", () => {
    expect(DOMAIN_PACKAGE).toBe("@myelektra/domain");
    expect(DOMAIN_VERSION).toBe("0.0.0");
  });

  test("isNonEmptyString accepts non-blank strings", () => {
    expect(isNonEmptyString("signal")).toBe(true);
  });

  test("isNonEmptyString rejects blank strings and non-strings", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
  });
});
