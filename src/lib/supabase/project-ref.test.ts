import { describe, expect, it } from "vitest";
import {
  extractJwtProjectRef,
  extractSupabaseProjectRef,
  formatSupabaseSchemaError,
  isSupabaseSchemaCacheError,
} from "./project-ref";

const SAMPLE_PROJECT_REF = "abcdefghijklmnop";

const SERVICE_ROLE_SAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzc5MTk4NjE4LCJleHAiOjIwOTQ3NzQ2MTh9.test";

describe("extractJwtProjectRef", () => {
  it("extracts ref from a Supabase service role JWT", () => {
    expect(extractJwtProjectRef(SERVICE_ROLE_SAMPLE)).toBe(SAMPLE_PROJECT_REF);
  });
});

describe("extractSupabaseProjectRef", () => {
  it("extracts the project ref from a Supabase URL", () => {
    expect(
      extractSupabaseProjectRef(`https://${SAMPLE_PROJECT_REF}.supabase.co`),
    ).toBe(SAMPLE_PROJECT_REF);
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
      `https://${SAMPLE_PROJECT_REF}.supabase.co`,
    );

    expect(message).toContain(SAMPLE_PROJECT_REF);
    expect(message).toContain("select calendar_events");
    expect(message).toContain("NOTIFY pgrst");
  });
});
