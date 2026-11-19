import { describe, expect, it } from "vitest";
import { browserItemKey, browserOf, pickReport, type ExtensionState } from "./browsers.ts";

const report = (p: Partial<ExtensionState>): ExtensionState => ({
  domain: "example.com", audible: false, incognito: false, focused: true, at: 1000, ...p,
});

describe("browserOf", () => {
  it("recognises each supported browser", () => {
    expect(browserOf("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")).toBe("chrome");
    expect(browserOf("C:\\Users\\me\\AppData\\Local\\Chromium\\Application\\chrome.exe")).toBe("chromium");
    expect(browserOf("C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe")).toBe("brave");
    expect(browserOf("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe")).toBe("edge");
    expect(browserOf("C:\\Users\\me\\AppData\\Local\\Programs\\Opera\\opera.exe")).toBe("opera");
    expect(browserOf("C:\\Users\\me\\AppData\\Local\\Programs\\Opera GX\\opera.exe")).toBe("opera-gx");
    expect(browserOf("C:\\Users\\me\\AppData\\Local\\Vivaldi\\Application\\vivaldi.exe")).toBe("vivaldi");
    expect(browserOf("C:\\Program Files\\Figma\\figma.exe")).toBeNull();
    expect(browserOf(null)).toBeNull();
  });
  it("gives Opera GX and Chromium their own app entries", () => {
    expect(browserItemKey("opera-gx")).toBe("opera gx.exe");
    expect(browserItemKey("chromium")).toBe("chromium.exe");
    expect(browserItemKey("opera")).toBeNull();
  });
});

describe("pickReport", () => {
  const now = 10_000;
  it("prefers the report from the exact browser in front", () => {
    const m = new Map([
      ["brave", report({ domain: "brave.com", focused: false, at: 9000 })],
      ["chrome", report({ domain: "google.com", focused: true, at: 9500 })],
    ]);
    expect(pickReport("brave", m, now)?.domain).toBe("brave.com");
  });
  it("falls back to the focused report for disguised browsers (Vivaldi reports as chrome)", () => {
    const m = new Map([["chrome", report({ domain: "vivaldi.net", focused: true, at: 9000 })]]);
    expect(pickReport("vivaldi", m, now)?.domain).toBe("vivaldi.net");
  });
  it("doesn't give a browser without the extension another browser's tab", () => {
    const m = new Map([["chrome", report({ domain: "google.com", focused: false, at: 9000 })]]);
    expect(pickReport("edge", m, now)).toBeNull();
  });
  it("ignores stale reports", () => {
    const m = new Map([["edge", report({ at: now - 200_000 })]]);
    expect(pickReport("edge", m, now)).toBeNull();
  });
});
