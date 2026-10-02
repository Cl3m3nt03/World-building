import { expect, test } from "vitest";
import type { MapContent, MapPin } from "@/lib/bindings";
import {
  addLayer,
  hiddenLayers,
  layerItemCount,
  moveLayer,
  neighbourLayer,
  removeLayer,
  renameLayer,
  setLayerVisible,
} from "./layers";

function pin(id: string, layerId: string): MapPin {
  return {
    id,
    layerId,
    cardId: null,
    x: 0.5,
    y: 0.5,
    icon: "flag",
    color: "red",
    label: "",
    size: 1,
  };
}

const CONTENT: MapContent = {
  layers: [
    { id: "fond", name: "Fond", visible: true },
    { id: "villes", name: "Villes", visible: true },
    { id: "routes", name: "Routes", visible: true },
  ],
  pins: [pin("p1", "villes"), pin("p2", "routes")],
  zones: [],
  texts: [],
};

const names = (content: MapContent) => content.layers.map((layer) => layer.id);

test("layers are added on top, renamed, hidden and moved", () => {
  const added = addLayer(CONTENT, { id: "noms", name: "Noms" });
  expect(names(added)).toEqual(["fond", "villes", "routes", "noms"]);
  expect(added.layers.at(-1)?.visible).toBe(true);
  expect(renameLayer(CONTENT, "villes", "Cités").layers[1]?.name).toBe("Cités");

  const hidden = setLayerVisible(CONTENT, "villes", false);
  expect([...hiddenLayers(hidden)]).toEqual(["villes"]);

  expect(names(moveLayer(CONTENT, "routes", 0))).toEqual(["routes", "fond", "villes"]);
  expect(moveLayer(CONTENT, "routes", 3)).toBe(CONTENT);
  expect(moveLayer(CONTENT, "nowhere", 0)).toBe(CONTENT);
});

test("a removed layer gives its content to its neighbour, or takes it along", () => {
  expect(neighbourLayer(CONTENT, "villes")?.id).toBe("fond");
  expect(neighbourLayer(CONTENT, "fond")?.id).toBe("villes");
  expect(layerItemCount(CONTENT, "villes")).toBe(1);

  const moved = removeLayer(CONTENT, "villes", "move");
  expect(names(moved)).toEqual(["fond", "routes"]);
  expect(moved.pins.map((p) => p.layerId)).toEqual(["fond", "routes"]);

  const deleted = removeLayer(CONTENT, "villes", "delete");
  expect(deleted.pins.map((p) => p.id)).toEqual(["p2"]);

  const single: MapContent = {
    ...CONTENT,
    layers: [{ id: "fond", name: "Fond", visible: true }],
    pins: [],
  };
  expect(removeLayer(single, "fond", "delete")).toBe(single);
});
