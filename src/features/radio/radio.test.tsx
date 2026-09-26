// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useUiStore } from "@/app/stores/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Asset } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { RadioButton } from "./components/RadioButton";
import { type Track, useRadio } from "./player";

function sound(letter: string, name: string): Asset {
  return {
    id: `${letter.repeat(64)}.mp3`,
    name,
    kind: "audio",
    mime: "audio/mpeg",
    size: 1024,
    width: null,
    height: null,
    createdAt: "2026-09-26T10:00:00Z",
  };
}

const SOUNDS = [sound("a", "Taverne.mp3"), sound("b", "Forêt.mp3"), sound("c", "Tempête.mp3")];
const TRACKS: Track[] = SOUNDS.map(({ id, name }) => ({ id, name }));

let play: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  mockIPC((command) => (command === "list_assets" ? SOUNDS : null));
  useUiStore.setState({ radioVolume: 70, radioMode: "loop" });
  useRadio.getState().stop();
  useRadio.setState({ tracks: [] });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

const currentName = () =>
  useRadio.getState().tracks.find((track) => track.id === useRadio.getState().currentId)?.name;

test("plays the tracks in order and loops back to the first", () => {
  useRadio.getState().setTracks(TRACKS);

  useRadio.getState().play();
  expect(currentName()).toBe("Taverne.mp3");
  expect(useRadio.getState().playing).toBe(true);
  useRadio.getState().next();
  useRadio.getState().next();
  expect(currentName()).toBe("Tempête.mp3");
  useRadio.getState().next();
  expect(currentName()).toBe("Taverne.mp3");
  useRadio.getState().previous();
  expect(currentName()).toBe("Tempête.mp3");
});

test("shuffle never picks the current track again", () => {
  useRadio.getState().setTracks(TRACKS);
  useUiStore.setState({ radioMode: "shuffle" });
  useRadio.getState().play(TRACKS[1]?.id);

  for (let i = 0; i < 20; i += 1) {
    const before = useRadio.getState().currentId;
    useRadio.getState().next();
    expect(useRadio.getState().currentId).not.toBe(before);
  }
});

test("at the end of a track, repeat-one replays it and loop moves on", () => {
  useRadio.getState().setTracks(TRACKS);
  useRadio.getState().play();
  const audio = play.mock.contexts.at(-1) as HTMLAudioElement;

  useUiStore.setState({ radioMode: "repeatOne" });
  audio.dispatchEvent(new Event("ended"));
  expect(currentName()).toBe("Taverne.mp3");

  useUiStore.setState({ radioMode: "loop" });
  audio.dispatchEvent(new Event("ended"));
  expect(currentName()).toBe("Forêt.mp3");
});

test("the volume follows the settings", () => {
  useRadio.getState().setTracks(TRACKS);
  useRadio.getState().play();
  const audio = play.mock.contexts.at(-1) as HTMLAudioElement;
  expect(audio.volume).toBeCloseTo(0.7);

  useUiStore.getState().setRadioVolume(25);
  expect(audio.volume).toBeCloseTo(0.25);
});

test("stops when the current track leaves the media library", () => {
  useRadio.getState().setTracks(TRACKS);
  useRadio.getState().play(TRACKS[2]?.id);

  useRadio.getState().setTracks(TRACKS.slice(0, 2));

  expect(useRadio.getState().currentId).toBeNull();
  expect(useRadio.getState().playing).toBe(false);
});

async function renderButton() {
  const rootRoute = createRootRoute({ component: () => <RadioButton worldId="demo" /> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const view = render(
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  await router.load();
  return view;
}

test("the popover plays a track, changes the mode, and the music stops with the world", async () => {
  const view = await renderButton();

  fireEvent.click(await screen.findByRole("button", { name: "Radio" }));
  fireEvent.click(await screen.findByRole("button", { name: "Forêt.mp3" }));
  expect(play).toHaveBeenCalled();
  expect(await screen.findByRole("button", { name: "Pause" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Radio, lecture en cours" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Aléatoire" }));
  expect(useUiStore.getState().radioMode).toBe("shuffle");
  fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "40" } });
  expect(useUiStore.getState().radioVolume).toBe(40);

  act(() => view.unmount());
  expect(useRadio.getState().playing).toBe(false);
  expect(useRadio.getState().currentId).toBeNull();
});
