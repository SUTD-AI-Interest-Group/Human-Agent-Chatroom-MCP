import { describe, expect, it } from "vitest";
import {
  createAgentToken,
  hashAgentToken,
  roomCode,
  temporaryDisplayName,
  tokenHashesMatch,
} from "@/lib/identity";

describe("ephemeral identity helpers", () => {
  it("creates six-digit room codes", () => {
    for (let index = 0; index < 100; index += 1) {
      expect(roomCode()).toMatch(/^\d{6}$/);
    }
  });

  it("creates readable temporary names", () => {
    expect(temporaryDisplayName()).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("creates high-entropy tokens and stable non-plaintext hashes", () => {
    const token = createAgentToken();
    const hash = hashAgentToken(token);
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(tokenHashesMatch(hash, hashAgentToken(token))).toBe(true);
    expect(tokenHashesMatch(hash, hashAgentToken(createAgentToken()))).toBe(false);
  });
});
