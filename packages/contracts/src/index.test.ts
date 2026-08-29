import { describe, expect, test } from "bun:test";

import {
  API_SCHEMA_VERSION,
  CONTRACTS_PACKAGE,
  SPIKE_PATH,
  TRANSPORT_ERROR_CODES,
  type ApiErrorEnvelope,
  type SpikeResponse,
} from "./index";

describe("@myelektra/contracts placeholder surface", () => {
  test("exposes its identity and schema version", () => {
    expect(CONTRACTS_PACKAGE).toBe("@myelektra/contracts");
    expect(API_SCHEMA_VERSION).toBe("0");
    expect(SPIKE_PATH).toBe("/spike");
  });

  test("every transport error code is a lowercase snake_case identifier", () => {
    for (const code of TRANSPORT_ERROR_CODES) {
      expect(code).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  test("envelope shapes are structurally satisfied", () => {
    const failure: ApiErrorEnvelope = {
      error: {
        code: "not_found",
        message: "No such route.",
        schemaVersion: API_SCHEMA_VERSION,
      },
    };
    const spike: SpikeResponse = {
      path: SPIKE_PATH,
      ok: true,
      domain: "@myelektra/domain",
      contracts: "@myelektra/contracts",
      predicate: true,
    };

    expect(failure.error.code).toBe("not_found");
    expect(spike.ok).toBe(true);
  });
});
