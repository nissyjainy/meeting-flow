import { describe, expect, it } from "vitest";
import {
  extractSupabaseProjectRef,
  formatSupabaseSchemaError,
  isSupabaseSchemaCacheError,
} from "./project-ref";

describe("extractSupabaseProjectRef", () => {
  it("extracts the project ref from a Supabase URL", () => {
    expect(extractSupabaseProjectRef("https://uzddznccxnolcarxykbc.supabase.co")).toBe(
      "uzddznccxnolcarxykbc",
    );
  });

  it("returns null for invalid URLs", () => {
    expect(extractSupabaseProjectRef("not-a-url")).toBeNull();
    expect(extractSupabaseProjectRef(undefined)).toBeNull();
  });
});

describe("isSupabaseSchemaCacheError", () => {
  it("detects PostgREST schema cache column errors", () => {
    expect(
      isSupabaseSchemaCacheError(
        "Could not find the 'capture_status' column of 'calendar_events' in the schema cache",
      ),
    ).toBe(true);
  });
});

describe("formatSupabaseSchemaError", () => {
  it("includes project ref and remediation hints", () => {
    const message = formatSupabaseSchemaError(
      "Could not find the 'capture_status' column of 'calendar_events' in the schema cache",
      "select calendar_events",
      "https://uzddznccxnolcarxykbc.supabase.co",
    );

    expect(message).toContain("uzddznccxnolcarxykbc");
    expect(message).toContain("select calendar_events");
    expect(message).toContain("NOTIFY pgrst");
  });
});
