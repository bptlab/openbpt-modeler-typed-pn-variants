import type { DiscoveredArc } from "../types";
import {
  arcLabelBounds,
  boundsAround,
  centerOf,
  exitPoint,
  PLACE_SIZE,
  placeLabelBounds,
  transitionSize,
  type Bounds,
  type NodeShape,
  type Point,
} from "./geometry";
import type { LayoutAlgorithm, NetLayout } from "./types";

const MARGIN = 100;
/** Horizontal distance between the centers of neighboring layers. */
const LAYER_GAP = 150;
/** Vertical distance between the centers of nodes in one layer. */
const ROW_GAP = 100;
/** How far an input and an output arc between the same nodes are moved apart. */
const PARALLEL_ARC_OFFSET = 8;

/**
 * A simple layered layout, left to right. A node's layer is its breadth-first distance
 * from the nodes without incoming arcs (nodes that are not reached, i.e. on cycles
 * without entry, start new searches). Within a layer, nodes are stacked in the order
 * they were reached, and each layer is centered vertically. Arcs are straight lines
 * between the shape borders; labels are where the modeler would put them.
 */
export const simpleLayout: LayoutAlgorithm = (net) => {
  const transitionsById = new Map(net.transitions.map((t) => [t.id, t]));
  const nodeIds = [
    ...net.transitions.map(({ id }) => id),
    ...net.places.map(({ id }) => id),
  ];

  const successors = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  const hasIncoming = new Set<string>();
  for (const arc of net.arcs) {
    const [source, target] = arcEnds(arc);
    successors.get(source)?.push(target);
    hasIncoming.add(target);
  }

  const layerOf = new Map<string, number>();
  const layers: string[][] = [];
  const addToLayer = (id: string, layer: number) => {
    layerOf.set(id, layer);
    (layers[layer] ??= []).push(id);
  };
  const breadthFirst = (roots: string[]) => {
    const queue = roots.filter((id) => !layerOf.has(id));
    queue.forEach((id) => addToLayer(id, 0));
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      for (const next of successors.get(id) ?? []) {
        if (!layerOf.has(next)) {
          addToLayer(next, layerOf.get(id)! + 1);
          queue.push(next);
        }
      }
    }
  };
  breadthFirst(nodeIds.filter((id) => !hasIncoming.has(id)));
  for (const id of nodeIds) breadthFirst([id]);

  const nodes = new Map<string, Bounds>();
  const maxRows = Math.max(0, ...layers.map((layer) => layer.length));
  layers.forEach((layer, layerIndex) => {
    const top = MARGIN + ((maxRows - layer.length) * ROW_GAP) / 2;
    layer.forEach((id, row) => {
      const transition = transitionsById.get(id);
      const size = transition
        ? transitionSize(transition.isSilent)
        : PLACE_SIZE;
      nodes.set(
        id,
        boundsAround(
          { x: MARGIN + layerIndex * LAYER_GAP, y: top + row * ROW_GAP },
          size,
        ),
      );
    });
  });

  const layout: NetLayout = { nodes, arcs: new Map(), labels: new Map() };
  for (const place of net.places) {
    layout.labels.set(place.id, placeLabelBounds(nodes.get(place.id)!));
  }

  const arcsPerPair = new Map<string, number>();
  const pairKey = (arc: DiscoveredArc) =>
    JSON.stringify([arc.placeId, arc.transitionId]);
  for (const arc of net.arcs) {
    arcsPerPair.set(pairKey(arc), (arcsPerPair.get(pairKey(arc)) ?? 0) + 1);
  }
  for (const arc of net.arcs) {
    const waypoints = straightArc(
      arc,
      nodes.get(arc.placeId)!,
      nodes.get(arc.transitionId)!,
      arcsPerPair.get(pairKey(arc))! > 1,
    );
    layout.arcs.set(arc.id, waypoints);
    layout.labels.set(arc.id, arcLabelBounds(waypoints));
  }
  return layout;
};

/** [source, target] node ids of an arc. */
function arcEnds(arc: DiscoveredArc): [string, string] {
  return arc.direction === "input"
    ? [arc.placeId, arc.transitionId]
    : [arc.transitionId, arc.placeId];
}

/**
 * A straight arc between the borders of the place and the transition. If there is an arc
 * in the other direction too, both are moved apart (to opposite sides) so both are visible.
 */
function straightArc(
  arc: DiscoveredArc,
  place: Bounds,
  transition: Bounds,
  hasReverseArc: boolean,
): Point[] {
  const placeCenter = centerOf(place);
  const transitionCenter = centerOf(transition);
  let offset: Point = { x: 0, y: 0 };
  if (hasReverseArc) {
    const dx = transitionCenter.x - placeCenter.x;
    const dy = transitionCenter.y - placeCenter.y;
    const length = Math.hypot(dx, dy) || 1;
    const side = arc.direction === "input" ? 1 : -1;
    offset = {
      x: (-dy / length) * PARALLEL_ARC_OFFSET * side,
      y: (dx / length) * PARALLEL_ARC_OFFSET * side,
    };
  }
  const shifted = (point: Point): Point => ({
    x: point.x + offset.x,
    y: point.y + offset.y,
  });

  const placeEnd: [Bounds, NodeShape, Point] = [
    place,
    "circle",
    shifted(placeCenter),
  ];
  const transitionEnd: [Bounds, NodeShape, Point] = [
    transition,
    "rectangle",
    shifted(transitionCenter),
  ];
  const [source, target] =
    arc.direction === "input"
      ? [placeEnd, transitionEnd]
      : [transitionEnd, placeEnd];
  return [
    exitPoint(source[0], source[1], source[2], target[2]),
    exitPoint(target[0], target[1], target[2], source[2]),
  ].map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) }));
}
