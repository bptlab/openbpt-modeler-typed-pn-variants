import type { DiscoveredNet } from "../types";
import type { Bounds, Point } from "./geometry";

/** Positions for the diagram part (DI) of the exported net. */
export interface NetLayout {
  /** Place or transition id → bounds of its shape. */
  nodes: Map<string, Bounds>;
  /** Arc id → its waypoints (at least two). */
  arcs: Map<string, Point[]>;
  /**
   * Place or arc id → bounds of its label. Optional per element: the modeler positions
   * missing labels itself (below places, next to arcs).
   */
  labels: Map<string, Bounds>;
}

/**
 * Computes the positions for a discovered net. Every place and transition needs bounds and
 * every arc waypoints; `discoverOpid` takes a layout algorithm as option.
 */
export type LayoutAlgorithm = (net: DiscoveredNet) => NetLayout;
