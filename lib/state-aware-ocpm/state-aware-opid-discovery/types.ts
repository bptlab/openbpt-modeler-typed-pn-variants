/**
 * The discovered OPID, before layout and export. The ids are the ids written to the XML.
 */

export interface DiscoveredDataClass {
  id: string;
  /** The object type name. */
  name: string;
  /** The shortest prefix of the name that no other data class name starts with. */
  alias: string;
}

export interface DiscoveredPlace {
  id: string;
  /** The state the place stands for; also its label. */
  label: string;
  /** The object type whose objects (or links) were in this state. */
  objectType: string;
  /** Data class ids, sorted by data class name like in the modeler. */
  color: string[];
}

/**
 * One part of a signature: objects of `objectType` moved from the states `from` to the
 * states `to` (both sorted).
 */
export interface SignatureTriple {
  objectType: string;
  from: string[];
  to: string[];
}

export interface DiscoveredVariable {
  name: string;
  dataClassId: string;
  /** Ids of the places its objects are consumed from (sorted). */
  from: string[];
  /** Ids of the places its objects are produced into (sorted). */
  to: string[];
  /** Its objects come from no place, i.e. the transition creates them. */
  isGenerated: boolean;
  /** At least one occurrence moves several objects this way. */
  isMultiple: boolean;
}

export interface DiscoveredTransition {
  id: string;
  /** The event type; undefined for silent transitions. */
  name?: string;
  isSilent: boolean;
  /** Sorted by object type (in declaration order of the log). */
  signature: SignatureTriple[];
  /** Number of events (or, for silent transitions, time points) with this signature. */
  occurrenceCount: number;
  variables: DiscoveredVariable[];
}

export interface DiscoveredInscriptionElement {
  dataClassId: string;
  variableName: string;
  isGenerated: boolean;
}

export interface DiscoveredArc {
  id: string;
  /** "input": place → transition, "output": transition → place. */
  direction: "input" | "output";
  placeId: string;
  transitionId: string;
  /** Sorted by data class name like in the modeler, then by variable name. */
  inscription: DiscoveredInscriptionElement[];
  /** The data class of the arc's variable that binds a set of objects, if any. */
  variableTypeId?: string;
}

export interface DiscoveredNet {
  dataClasses: DiscoveredDataClass[];
  places: DiscoveredPlace[];
  transitions: DiscoveredTransition[];
  arcs: DiscoveredArc[];
}
