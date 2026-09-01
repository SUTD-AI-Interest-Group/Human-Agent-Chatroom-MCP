import { describe, expect, it } from "vitest";
import { messageBodySchema, roomCodeSchema, safeSearchTerm } from "@/lib/validation";

describe("input validation", () => {
  it("accepts only a six-digit code", () => {
    expect(roomCodeSchema.safeParse("123456").success).toBe(true);
    expect(roomCodeSchema.safeParse("12345").success).toBe(false);
    expect(roomCodeSchema.safeParse("abcdef").success).toBe(false);
  });

  it("trims messages and enforces the content limit", () => {
    expect(messageBodySchema.parse("  hello  ")).toBe("hello");
    expect(messageBodySchema.safeParse(" ").success).toBe(false);
    expect(messageBodySchema.safeParse("a".repeat(4_001)).success).toBe(false);
  });

  it("removes PostgREST wildcard characters from search terms", () => {
    expect(safeSearchTerm("  100%_ready\\  ")).toBe("100ready");
  });
});
