import { useEffect, useRef } from "react";
import type { Settings } from "./settings";
import {
  createSimulationHost,
  type SimCommand,
  type SimEvent,
  type SimLinkInput,
  type SimNodeInput,
} from "./simulation";

/** Where the simulation runs: a Web Worker, or the main thread without one (tests). */
type Runner = { send: (command: SimCommand) => void; close: () => void };

function startRunner(onEvent: (event: SimEvent) => void): Runner {
  if (typeof Worker !== "undefined") {
    const worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (message: MessageEvent<SimEvent>) => onEvent(message.data);
    return { send: (command) => worker.postMessage(command), close: () => worker.terminate() };
  }
  const handle = createSimulationHost(onEvent);
  return { send: handle, close: () => handle({ type: "stop" }) };
}

/**
 * Runs the force simulation of `nodes` and `links`. The latest positions
 * (x, y per node, in the order of `nodes`) are kept in `positions`, and
 * `onTick` is called at each step, to draw. Starts again when the nodes or
 * the links change; the settings only reheat it.
 */
export function useSimulation({
  nodes,
  links,
  settings,
  onTick,
}: {
  nodes: SimNodeInput[];
  links: SimLinkInput[];
  settings: Settings;
  onTick: () => void;
}) {
  const runner = useRef<Runner | null>(null);
  const positions = useRef<Float32Array>(new Float32Array(0));
  const settled = useRef(false);
  const tick = useRef(onTick);
  tick.current = onTick;
  const latestSettings = useRef(settings);
  latestSettings.current = settings;

  useEffect(() => {
    const current = startRunner((event) => {
      positions.current = event.positions;
      settled.current = event.settled;
      tick.current();
    });
    runner.current = current;
    return () => {
      current.close();
      runner.current = null;
    };
  }, []);

  useEffect(() => {
    positions.current = new Float32Array(nodes.length * 2);
    settled.current = false;
    runner.current?.send({ type: "init", nodes, links, settings: latestSettings.current });
  }, [nodes, links]);

  const firstSettings = useRef(true);
  useEffect(() => {
    if (firstSettings.current) {
      firstSettings.current = false;
      return;
    }
    runner.current?.send({ type: "settings", settings });
  }, [settings]);

  return {
    positions,
    settled,
    send: (command: SimCommand) => runner.current?.send(command),
  };
}
