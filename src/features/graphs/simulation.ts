import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { Settings } from "./settings";

/**
 * The force simulation of a graph (docs/features/04-graph.md): `d3-force`
 * with the settings of the spec. It runs in a Web Worker
 * (`simulation.worker.ts`), or on the main thread where there is none
 * (tests). Both speak the messages below.
 */

/** A node as the simulation sees it: an id, a radius, maybe a fixed place. */
export type SimNodeInput = {
  id: string;
  radius: number;
  x?: number | undefined;
  y?: number | undefined;
  /** Pinned: the node stays at (fx, fy). */
  fx?: number | undefined;
  fy?: number | undefined;
};

export type SimLinkInput = { source: string; target: string; weight: number };

/** Messages to the simulation. */
export type SimCommand =
  | { type: "init"; nodes: SimNodeInput[]; links: SimLinkInput[]; settings: Settings }
  | { type: "settings"; settings: Settings }
  /** A node dragged to (x, y), or let go (`null`). */
  | { type: "drag"; id: string; x: number | null; y: number | null }
  /** A node pinned at (x, y), or freed (`null`). */
  | { type: "fix"; id: string; x: number | null; y: number | null }
  | { type: "stop" };

/** Messages from the simulation: the positions, in the order of `init`'s nodes. */
export type SimEvent = { type: "tick"; positions: Float32Array; settled: boolean };

type Node = SimulationNodeDatum & { id: string; radius: number; pinned: boolean };
type Link = SimulationLinkDatum<Node> & { weight: number };

/** Below this, the simulation is settled and stops (d3's default). */
const ALPHA_MIN = 0.001;
/** How hot a change of settings makes the simulation again: gently. */
const REHEAT_ALPHA = 0.4;

function applySettings(simulation: Simulation<Node, Link>, links: Link[], settings: Settings) {
  const degree = new Map<string, number>();
  for (const link of links) {
    const source = link.source as Node | string;
    const target = link.target as Node | string;
    for (const end of [source, target]) {
      const id = typeof end === "string" ? end : end.id;
      degree.set(id, (degree.get(id) ?? 0) + 1);
    }
  }
  const endId = (end: Node | string | number) => (typeof end === "object" ? end.id : String(end));
  simulation
    .force(
      "link",
      forceLink<Node, Link>(links)
        .id((node) => node.id)
        .distance(settings.linkDistance)
        // d3's own default (1 / the smaller degree), scaled by the setting:
        // well-connected nodes are not pulled too hard.
        .strength(
          (link) =>
            settings.linkStrength /
            Math.max(
              1,
              Math.min(degree.get(endId(link.source)) ?? 1, degree.get(endId(link.target)) ?? 1),
            ),
        ),
    )
    .force("charge", forceManyBody<Node>().strength(-settings.repulsion).theta(0.9))
    .force(
      "collide",
      forceCollide<Node>((node) => node.radius * settings.collision),
    )
    .force("x", forceX<Node>(0).strength(settings.gravityX))
    .force("y", forceY<Node>(0).strength(settings.gravityY));
}

/**
 * A simulation driven by the messages above; `emit` receives the positions
 * at each tick. Returns the function handling a message.
 */
export function createSimulationHost(emit: (event: SimEvent) => void) {
  let simulation: Simulation<Node, Link> | null = null;
  let nodes: Node[] = [];
  let links: Link[] = [];
  let byId = new Map<string, Node>();
  let settings: Settings | null = null;

  const send = () => {
    const positions = new Float32Array(nodes.length * 2);
    nodes.forEach((node, index) => {
      positions[index * 2] = node.x ?? 0;
      positions[index * 2 + 1] = node.y ?? 0;
    });
    emit({ type: "tick", positions, settled: (simulation?.alpha() ?? 0) < ALPHA_MIN });
  };

  return (command: SimCommand) => {
    switch (command.type) {
      case "init": {
        simulation?.stop();
        settings = command.settings;
        nodes = command.nodes.map((input) => ({
          id: input.id,
          radius: input.radius,
          pinned: input.fx !== undefined && input.fy !== undefined,
          ...(input.x === undefined ? {} : { x: input.x }),
          ...(input.y === undefined ? {} : { y: input.y }),
          ...(input.fx === undefined ? {} : { fx: input.fx, x: input.fx }),
          ...(input.fy === undefined ? {} : { fy: input.fy, y: input.fy }),
        }));
        byId = new Map(nodes.map((node) => [node.id, node]));
        links = command.links
          .filter((link) => byId.has(link.source) && byId.has(link.target))
          .map((link) => ({ source: link.source, target: link.target, weight: link.weight }));
        simulation = forceSimulation<Node, Link>(nodes).alphaMin(ALPHA_MIN).on("tick", send);
        applySettings(simulation, links, settings);
        simulation.on("end", send);
        send();
        break;
      }
      case "settings": {
        settings = command.settings;
        if (!simulation) return;
        applySettings(simulation, links, settings);
        simulation.alpha(Math.max(simulation.alpha(), REHEAT_ALPHA)).restart();
        break;
      }
      case "drag": {
        const node = byId.get(command.id);
        if (!node || !simulation) return;
        if (command.x === null || command.y === null) {
          // Let go: a pinned node stays where it was dropped.
          if (!node.pinned) {
            node.fx = null;
            node.fy = null;
          }
          simulation.alphaTarget(0);
        } else {
          node.fx = command.x;
          node.fy = command.y;
          if (node.pinned) {
            node.x = command.x;
            node.y = command.y;
          }
          simulation.alphaTarget(0.3).restart();
        }
        break;
      }
      case "fix": {
        const node = byId.get(command.id);
        if (!node || !simulation) return;
        node.pinned = command.x !== null && command.y !== null;
        node.fx = command.x;
        node.fy = command.y;
        if (command.x !== null && command.y !== null) {
          node.x = command.x;
          node.y = command.y;
        }
        simulation.alpha(Math.max(simulation.alpha(), 0.1)).restart();
        break;
      }
      case "stop":
        simulation?.stop();
        simulation = null;
        break;
    }
  };
}
