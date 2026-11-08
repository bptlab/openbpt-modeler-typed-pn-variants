import type { ObjectToken } from "./marking";
import type { ObjectId } from "./net";

/** One variable of a firing and the object ids it was bound to. */
export interface BoundVariable {
  dataClassId: string;
  dataClassName: string;
  variableName: string;
  /** Bound through a variable arc (`x[]`), so it may hold several object ids. */
  isVariable: boolean;
  values: ObjectId[];
  /** `input`: taken from the input places. `generated`: a fresh object created by the firing. */
  origin: "input" | "generated";
}

export interface PlaceTokens {
  placeId: string;
  placeName?: string;
  tokens: ObjectToken[];
}

export interface CreatedObject {
  id: ObjectId;
  dataClassId: string;
  dataClassName: string;
}

export interface TransitionFiring {
  /** 1-based position in the firing sequence. */
  step: number;
  transition: { id: string; name?: string; isSilent: boolean };
  binding: BoundVariable[];
  /** Tokens removed, per input place. */
  consumed: PlaceTokens[];
  /** Tokens added, per output place. */
  produced: PlaceTokens[];
  createdObjects: CreatedObject[];
}

export type TerminationReason = "noEnabledTransitions" | "maxEventsReached";

export interface NeverEnabledTransition {
  id: string;
  name?: string;
  reason: string;
}

export interface ObjectTypeSummary {
  dataClassId: string;
  dataClassName: string;
  /** Objects of this type created during the simulation. */
  created: number;
  /** The type's own maximum; undefined if it is only limited by `maxObjects`. */
  max?: number;
}

export interface SimulationResult {
  /** All firings, in order. */
  firings: TransitionFiring[];
  terminationReason: TerminationReason;
  /** Seed of the random generator. Passing it again reproduces the run. */
  seed: number;
  maxObjects: number;
  /**
   * The most objects the run may create: the sum of the per-type maxima if every data class
   * has one and the sum is lower than `maxObjects`, otherwise `maxObjects`.
   */
  effectiveMaxObjects: number;
  /** Upper bound on the number of firings: `effectiveMaxObjects * 100`. */
  maxEvents: number;
  /** Objects created during the simulation (objects of the initial marking are not counted). */
  createdObjectCount: number;
  /** Created objects and maximum for each data class of the net. */
  objectsPerType: ObjectTypeSummary[];
  /** Transitions that can never fire because of how they are modeled. */
  neverEnabledTransitions: NeverEnabledTransition[];
  warnings: string[];
}
