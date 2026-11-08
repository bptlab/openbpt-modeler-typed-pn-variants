import createModdle from "../../vendor/moddle";
import { MODELER_DI_PREFIX, MODELER_PREFIX } from "../../vendor/util/constants";
import { createIdGenerator } from "../discovery/ids";
import type { Bounds, Point } from "../layout/geometry";
import type { NetLayout } from "../layout/types";
import type { DiscoveredNet } from "../types";

/** The parts of the (untyped) moddle that the export uses. */
type ModdleElement = Record<string, unknown>;
interface Moddle {
  create(type: string, properties?: ModdleElement): ModdleElement;
  toXML(
    element: ModdleElement,
    options?: { format?: boolean },
  ): Promise<{ xml: string }>;
}

const model = (type: string) => `${MODELER_PREFIX}:${type}`;
const diagram = (type: string) => `${MODELER_DI_PREFIX}:${type}`;

/**
 * Writes the net as modeler XML: builds the moddle tree (model and diagram, with the ids,
 * names and structure of the modeler's empty diagram) and serializes it with the
 * moddle's `toXML`, like the modeler's `saveXML`.
 *
 * @throws Error if the layout lacks bounds for a node or waypoints for an arc
 */
export async function writeNetXml(
  net: DiscoveredNet,
  layout: NetLayout,
): Promise<string> {
  const moddle = createModdle() as unknown as Moddle;
  const nextId = createIdGenerator();
  const bounds = ({ x, y, width, height }: Bounds) =>
    moddle.create("dc:Bounds", { x, y, width, height });
  const point = ({ x, y }: Point) => moddle.create("dc:Point", { x, y });
  const label = (id: string) => {
    const labelBounds = layout.labels.get(id);
    return labelBounds
      ? {
          label: moddle.create(diagram("DiagramLabel"), {
            bounds: bounds(labelBounds),
          }),
        }
      : {};
  };

  const dataClasses = new Map(
    net.dataClasses.map(({ id, name, alias }) => [
      id,
      moddle.create(model("DataClass"), { id, name, alias, valueType: "ID" }),
    ]),
  );
  const dataClass = (id: string) => dataClasses.get(id)!;

  const nodes = new Map<string, ModdleElement>();
  for (const place of net.places) {
    nodes.set(
      place.id,
      moddle.create(model("Place"), {
        id: place.id,
        name: place.label,
        color: place.color.map(dataClass),
      }),
    );
  }
  for (const transition of net.transitions) {
    nodes.set(
      transition.id,
      moddle.create(
        model("Transition"),
        transition.isSilent
          ? { id: transition.id, isSilent: true }
          : { id: transition.id, name: transition.name },
      ),
    );
  }

  const arcs = net.arcs.map((arc) => {
    const place = nodes.get(arc.placeId)!;
    const transition = nodes.get(arc.transitionId)!;
    const [source, target] =
      arc.direction === "input" ? [place, transition] : [transition, place];
    const inscription = moddle.create(model("Inscription"), {
      id: nextId("Inscription"),
      inscriptionElements: arc.inscription.map((element) =>
        moddle.create(model("InscriptionElement"), {
          id: nextId("InscriptionElement"),
          dataClass: dataClass(element.dataClassId),
          variableName: element.variableName,
          isGenerated: element.isGenerated,
        }),
      ),
    });
    return moddle.create(model("Arc"), {
      id: arc.id,
      source,
      target,
      inscription,
      ...(arc.variableTypeId
        ? { variableType: dataClass(arc.variableTypeId) }
        : {}),
    });
  });

  const modelElement = moddle.create(model("Model"), {
    id: "model_1",
    name: "Model 1",
    modelElements: [...nodes.values(), ...arcs],
    declarations: [...dataClasses.values()],
  });

  const shapes = [...net.places, ...net.transitions].map(({ id }) => {
    const nodeBounds = layout.nodes.get(id);
    if (!nodeBounds) throw new Error(`The layout has no bounds for ${id}.`);
    return moddle.create(diagram("DiagramShape"), {
      id: `${id}_di`,
      modelElement: nodes.get(id),
      bounds: bounds(nodeBounds),
      ...label(id),
    });
  });
  const edges = net.arcs.map((arc, index) => {
    const waypoints = layout.arcs.get(arc.id);
    if (!waypoints || waypoints.length < 2) {
      throw new Error(`The layout has no waypoints for ${arc.id}.`);
    }
    return moddle.create(diagram("DiagramEdge"), {
      id: `${arc.id}_di`,
      modelElement: arcs[index],
      waypoint: waypoints.map(point),
      ...label(arc.id),
    });
  });

  const definitions = moddle.create(model("Definitions"), {
    model: modelElement,
    diagram: moddle.create(diagram("Diagram"), {
      id: "model_1_di",
      plane: moddle.create(diagram("Plane"), {
        id: "model_1_plane",
        modelElement,
        planeElements: [...shapes, ...edges],
      }),
    }),
  });
  const { xml } = await moddle.toXML(definitions, { format: true });
  return xml;
}
