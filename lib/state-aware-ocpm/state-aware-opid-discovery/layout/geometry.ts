/**
 * Geometry that any layout algorithm can reuse: the modeler's shape sizes, cropping lines
 * at shape borders, and the modeler's default label positions.
 */
import {
  DEFAULT_SHAPE_SIZE,
  SILENT_TRANSITION_SIZE,
} from "../../vendor/util/constants";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds extends Point, Size {}

/** Places are drawn as circles, transitions as rectangles. */
export type NodeShape = "circle" | "rectangle";

export const PLACE_SIZE: Size = DEFAULT_SHAPE_SIZE;

/** The modeler's sizes: 50 × 50, silent transitions 20 × 50. */
export function transitionSize(isSilent: boolean): Size {
  return isSilent ? SILENT_TRANSITION_SIZE : DEFAULT_SHAPE_SIZE;
}

export function boundsAround(center: Point, size: Size): Bounds {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    ...size,
  };
}

export function centerOf(bounds: Bounds): Point {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

/**
 * Where the ray from `start` (inside the shape) towards `towards` leaves the shape. Used to
 * end arcs at shape borders instead of shape centers.
 */
export function exitPoint(
  bounds: Bounds,
  shape: NodeShape,
  start: Point,
  towards: Point,
): Point {
  const dx = towards.x - start.x;
  const dy = towards.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return start;
  const direction = { x: dx / length, y: dy / length };

  let distance: number;
  if (shape === "circle") {
    const center = centerOf(bounds);
    const radius = Math.min(bounds.width, bounds.height) / 2;
    const offset = { x: start.x - center.x, y: start.y - center.y };
    const b = offset.x * direction.x + offset.y * direction.y;
    const c = offset.x * offset.x + offset.y * offset.y - radius * radius;
    distance = -b + Math.sqrt(Math.max(0, b * b - c));
  } else {
    const along = (from: number, d: number, min: number, max: number) =>
      d > 0 ? (max - from) / d : d < 0 ? (min - from) / d : Infinity;
    distance = Math.min(
      along(start.x, direction.x, bounds.x, bounds.x + bounds.width),
      along(start.y, direction.y, bounds.y, bounds.y + bounds.height),
    );
  }
  return {
    x: start.x + direction.x * distance,
    y: start.y + direction.y * distance,
  };
}

/** The modeler's default label size (`DEFAULT_LABEL_SIZE` in its `LabelUtil.js`). */
export const DEFAULT_LABEL_SIZE: Size = { width: 90, height: 20 };

/** Where the modeler puts a place label by default: centered below the place. */
export function placeLabelBounds(place: Bounds): Bounds {
  return boundsAround(
    {
      x: place.x + place.width / 2,
      y: place.y + place.height + DEFAULT_LABEL_SIZE.height / 2,
    },
    DEFAULT_LABEL_SIZE,
  );
}

const FLOW_LABEL_INDENT = 15;

/**
 * Where the modeler puts an arc label by default: at the middle segment, above it (or to
 * the right of vertical segments). Ported from `getFlowLabelPosition` in its `LabelUtil.js`.
 */
export function arcLabelBounds(waypoints: Point[]): Bounds {
  const mid = waypoints.length / 2 - 1;
  const first = waypoints[Math.floor(mid)];
  const second = waypoints[Math.ceil(mid + 0.01)];
  const angle = Math.atan((second.y - first.y) / (second.x - first.x));
  const position = {
    x: first.x + (second.x - first.x) / 2,
    y: first.y + (second.y - first.y) / 2,
  };
  if (Math.abs(angle) < Math.PI / 2) {
    position.y -= FLOW_LABEL_INDENT;
  } else {
    position.x += FLOW_LABEL_INDENT;
  }
  return boundsAround(position, DEFAULT_LABEL_SIZE);
}
