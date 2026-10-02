import type { MapContent, MapLayer } from "@/lib/bindings";

/**
 * Layers of a map (M4 step 4.4, docs/features/03-map.md). `content.layers`
 * is in display order: the first is drawn first, under the others. Pure
 * functions, tested in layers.test.ts.
 */

/** `content` with a new visible layer on top. */
export function addLayer(content: MapContent, layer: { id: string; name: string }): MapContent {
  return { ...content, layers: [...content.layers, { ...layer, visible: true }] };
}

export function renameLayer(content: MapContent, id: string, name: string): MapContent {
  return {
    ...content,
    layers: content.layers.map((layer) => (layer.id === id ? { ...layer, name } : layer)),
  };
}

export function setLayerVisible(content: MapContent, id: string, visible: boolean): MapContent {
  return {
    ...content,
    layers: content.layers.map((layer) => (layer.id === id ? { ...layer, visible } : layer)),
  };
}

/** `content` with the layer `id` moved to `index` (0 is the bottom). */
export function moveLayer(content: MapContent, id: string, index: number): MapContent {
  const from = content.layers.findIndex((layer) => layer.id === id);
  const layer = content.layers[from];
  if (!layer || index < 0 || index >= content.layers.length || index === from) return content;
  const layers = content.layers.filter((other) => other.id !== id);
  layers.splice(index, 0, layer);
  return { ...content, layers };
}

/** The layer that takes the content of `id` when it is removed: the one under it, else above. */
export function neighbourLayer(content: MapContent, id: string): MapLayer | undefined {
  const index = content.layers.findIndex((layer) => layer.id === id);
  return content.layers[index - 1] ?? content.layers[index + 1];
}

/** How many pins, zones and texts are on the layer `id`. */
export function layerItemCount(content: MapContent, id: string): number {
  return [...content.pins, ...content.zones, ...content.texts].filter((item) => item.layerId === id)
    .length;
}

/**
 * `content` without the layer `id`. Its pins, zones and texts move to the
 * neighbour layer (`"move"`) or go with it (`"delete"`). The last layer is
 * never removed.
 */
export function removeLayer(content: MapContent, id: string, keep: "move" | "delete"): MapContent {
  const target = neighbourLayer(content, id);
  if (!target) return content;
  const layers = content.layers.filter((layer) => layer.id !== id);
  if (keep === "delete") {
    return {
      layers,
      pins: content.pins.filter((pin) => pin.layerId !== id),
      zones: content.zones.filter((zone) => zone.layerId !== id),
      texts: content.texts.filter((text) => text.layerId !== id),
    };
  }
  const moved = <T extends { layerId: string }>(item: T): T =>
    item.layerId === id ? { ...item, layerId: target.id } : item;
  return {
    layers,
    pins: content.pins.map(moved),
    zones: content.zones.map(moved),
    texts: content.texts.map(moved),
  };
}

/** Ids of the hidden layers, to leave their content out of the view. */
export function hiddenLayers(content: MapContent): Set<string> {
  return new Set(content.layers.filter((layer) => !layer.visible).map((layer) => layer.id));
}
