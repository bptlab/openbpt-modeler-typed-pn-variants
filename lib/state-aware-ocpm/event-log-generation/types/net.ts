/**
 * Internal representation of a typed Petri net, independent of diagram-js and moddle.
 */

/** Identifier of an object, i.e. the value a token holds for one data class (e.g. "Order_1"). */
export type ObjectId = string;

export interface NetDataClass {
  id: string;
  /** Falls back to the id if the model gives no name. Used as prefix for new object ids. */
  name: string;
  alias: string;
}

export interface NetInscriptionElement {
  dataClassId: string;
  variableName?: string;
  /** On output arcs: the transition creates a fresh object for this variable. */
  isGenerated: boolean;
}

/**
 * - `input`: place → transition, consumes tokens.
 * - `output`: transition → place, produces tokens.
 * - `inhibitor`: blocks the transition. It always reads from its place, no matter in
 *   which direction it was drawn (the modeler allows both and renders them the same way).
 */
export type NetArcKind = "input" | "output" | "inhibitor";

export interface NetArc {
  id: string;
  kind: NetArcKind;
  placeId: string;
  transitionId: string;
  /** Data class id of a variable arc (written `x[]`), if this is one. */
  variableTypeId?: string;
  isExactSynchronization: boolean;
  inscription: NetInscriptionElement[];
}

export interface NetPlace {
  id: string;
  name?: string;
  /** Data class ids of the place's color, in model order. */
  color: string[];
}

export interface NetTransition {
  id: string;
  name?: string;
  isSilent: boolean;
  /** Input and inhibitor arcs, in document order. */
  incoming: NetArc[];
  /** Output arcs, in document order. */
  outgoing: NetArc[];
}

export interface PetriNet {
  dataClasses: Map<string, NetDataClass>;
  places: Map<string, NetPlace>;
  /** In document order. */
  transitions: Map<string, NetTransition>;
}
