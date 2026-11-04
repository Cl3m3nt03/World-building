// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { motionMs } from "./navigation";

const TOKEN = "--bz-duration-test";

describe("motionMs", () => {
  afterEach(() => document.documentElement.style.removeProperty(TOKEN));

  it("reads a duration token in milliseconds or seconds", () => {
    document.documentElement.style.setProperty(TOKEN, "160ms");
    expect(motionMs(TOKEN)).toBe(160);
    document.documentElement.style.setProperty(TOKEN, "0.2s");
    expect(motionMs(TOKEN)).toBe(200);
  });

  it("is 0 under reduced motion, where the tokens are 0, and for an unknown token", () => {
    document.documentElement.style.setProperty(TOKEN, "0ms");
    expect(motionMs(TOKEN)).toBe(0);
    expect(motionMs("--bz-duration-none")).toBe(0);
  });
});
