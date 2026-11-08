import type { TransitionFiring } from "../types/log";
import type { Marking } from "../types/marking";
import type { PetriNet } from "../types/net";
import type { FiringClock } from "./clock";
import type { OcelLog } from "../../ocel/types";

/** What a log mode gets to work with. */
export interface OcelModeContext {
  net: PetriNet;
  /** The marking before the simulation starts. */
  initialMarking: Marking;
  clock: FiringClock;
  /** Also log silent firings, if the mode supports it (state-aware mode only). */
  logSilentTransitions: boolean;
}

/**
 * Builds a log step by step. A mode reads the initial marking when it is created (before
 * the simulation starts) and then receives the firings in order.
 */
export interface OcelLogBuilder {
  addFiring(firing: TransitionFiring): void;
  build(): OcelLog;
}

/**
 * A log mode decides what is logged and how. To add one, implement this and register it
 * in `modes/index.ts`.
 */
export type OcelMode = (context: OcelModeContext) => OcelLogBuilder;
