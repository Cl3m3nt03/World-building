import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const WORLD_NAME = "Monde E2E";

function builderzHome(): string {
  const home = process.env.BUILDERZ_HOME;
  if (!home) throw new Error("BUILDERZ_HOME is not set (see e2e/wdio.conf.ts)");
  return home;
}

describe("BuilderZ smoke test", () => {
  it("starts on the world list", async () => {
    const title = await $("h1=Mondes");
    await title.waitForDisplayed({ timeout: 30_000 });
  });

  it("creates a world and opens it", async () => {
    await $("button=Créer un monde").click();

    const name = await $("aria/Nom");
    await name.waitForDisplayed();
    await name.setValue(WORLD_NAME);

    // The default location comes from Rust: $BUILDERZ_HOME/worlds here.
    const location = await $("aria/Emplacement");
    await browser.waitUntil(async () => (await location.getValue()) !== "");
    expect(await location.getValue()).toContain(path.join(builderzHome(), "worlds"));

    await $("button=Créer").click();

    const currentWorld = await $("aria/Monde courant");
    await currentWorld.waitForDisplayed();
    await expect(currentWorld).toHaveText(expect.stringContaining(WORLD_NAME));
    await expect(browser).toHaveUrl(expect.stringContaining("/home"));
    await expect($("h1=Bienvenue")).toBeDisplayed();
  });

  it("wrote the world folder on disk", () => {
    const worldDir = path.join(builderzHome(), "worlds", WORLD_NAME);
    expect(existsSync(path.join(worldDir, "world.db"))).toBe(true);
    expect(existsSync(path.join(worldDir, "assets"))).toBe(true);
    const worldFile = JSON.parse(readFileSync(path.join(worldDir, "world.json"), "utf8"));
    expect(worldFile).toMatchObject({ format: "builderz-world", name: WORLD_NAME });
  });

  it("goes back to the world list, where the world is now recent", async () => {
    await $("button=Mondes").click();
    await expect($("h1=Mondes")).toBeDisplayed();
    await expect($(`aria/Ouvrir ${WORLD_NAME}`)).toBeDisplayed();
  });
});
