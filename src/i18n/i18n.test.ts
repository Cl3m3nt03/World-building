import { beforeAll, describe, expect, test } from "vitest";
import en from "./en.json";
import fr from "./fr.json";
import { DEFAULT_LANGUAGE, i18n, initI18n, isLanguage } from "./index";

test("fr.json and en.json have exactly the same keys", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
});

test("no translation is empty", () => {
  for (const value of [...Object.values(fr), ...Object.values(en)]) {
    expect(value.trim()).not.toBe("");
  }
});

describe("i18n runtime", () => {
  beforeAll(async () => {
    await initI18n();
  });

  test("starts in French", () => {
    expect(DEFAULT_LANGUAGE).toBe("fr");
    expect(i18n.t("shell.actions.settings")).toBe("Réglages");
  });

  test("switches to English", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("shell.actions.settings")).toBe("Settings");
    await i18n.changeLanguage("fr");
  });

  test("only accepts supported languages", () => {
    expect(isLanguage("fr")).toBe(true);
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("de")).toBe(false);
  });
});
