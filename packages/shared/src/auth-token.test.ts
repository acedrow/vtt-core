import { describe, expect, it } from "vitest";
import { constantTimeEqual, createAuthToken, verifyAuthToken } from "./auth-token.js";

const SECRET = "test-secret";

describe("auth-token", () => {
  it("round-trips a valid token and preserves the role", async () => {
    const token = await createAuthToken("gm", SECRET);
    expect(await verifyAuthToken(token, SECRET)).toEqual({ role: "gm" });

    const playerToken = await createAuthToken("player", SECRET);
    expect(await verifyAuthToken(playerToken, SECRET)).toEqual({ role: "player" });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createAuthToken("gm", SECRET);
    expect(await verifyAuthToken(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await createAuthToken("player", SECRET);
    const [, signature] = token.split(".");
    const forged = `${btoa(JSON.stringify({ role: "gm", exp: Date.now() + 1000 }))}.${signature}`;
    expect(await verifyAuthToken(forged, SECRET)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await createAuthToken("gm", SECRET, -1000);
    expect(await verifyAuthToken(token, SECRET)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verifyAuthToken("garbage", SECRET)).toBeNull();
    expect(await verifyAuthToken("a.b.c", SECRET)).toBeNull();
  });

  it("constantTimeEqual compares strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});
