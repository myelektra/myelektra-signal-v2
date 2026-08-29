import { describe, expect, test } from "bun:test";

import {
  ADAPTERS_BUILT_AGAINST_DOMAIN,
  ADAPTERS_PACKAGE,
  ADAPTERS_VERSION,
  type AdapterTransportError,
} from "./index";

describe("@myelektra/adapters placeholder surface", () => {
  test("exposes its identity", () => {
    expect(ADAPTERS_PACKAGE).toBe("@myelektra/adapters");
    expect(ADAPTERS_VERSION).toBe("0.0.0");
  });

  test("resolves the domain package across the workspace boundary", () => {
    // Proves adapters -> domain compiles and resolves at runtime.
    expect(ADAPTERS_BUILT_AGAINST_DOMAIN).toBe("0.0.0");
  });

  test("reuses the contracts transport error shape", () => {
    const failure: AdapterTransportError = {
      code: "rate_limited",
      message: "Provider throttled the request.",
      schemaVersion: "0",
    };
    expect(failure.code).toBe("rate_limited");
  });
});
