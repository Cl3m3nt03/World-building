/// <reference lib="webworker" />
// The graph's force simulation, off the main thread (see simulation.ts).
import { createSimulationHost, type SimCommand } from "./simulation";

const scope = self as unknown as DedicatedWorkerGlobalScope;

const handle = createSimulationHost((event) => {
  // The positions' buffer is handed over, not copied.
  scope.postMessage(event, [event.positions.buffer]);
});

scope.onmessage = (message: MessageEvent<SimCommand>) => handle(message.data);
