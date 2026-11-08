import type { ParsedNet } from "../parsing/parseNet";
import type { SimulationResult } from "../types/log";
import { createFiringClock, type ClockOptions } from "./clock";
import type { OcelLogBuilder } from "./mode";
import { getOcelMode, type OcelModeName } from "./modes";
import type { OcelLog } from "../../ocel/types";

export interface OcelOptions extends ClockOptions {
  /** What is logged and how: "default" (the default) or "state-aware". */
  mode?: OcelModeName;
  /**
   * State-aware mode only: also log silent firings, as state transitions of their objects
   * (no events). Default: false. The default mode never logs silent firings.
   */
  logSilentTransitions?: boolean;
}

/**
 * Starts the log of a simulation of `parsedNet`. The mode reads the initial marking right
 * away, so create the builder before simulating; then pass the firings in order.
 *
 * @throws EventLogInputError for an unknown mode or invalid time settings
 */
export function createOcelLogBuilder(
  parsedNet: ParsedNet,
  options: OcelOptions = {},
): OcelLogBuilder {
  const mode = getOcelMode(options.mode);
  return mode({
    net: parsedNet.net,
    // The simulation works on a copy, so this is still the marking before the first firing.
    initialMarking: parsedNet.initialMarking,
    clock: createFiringClock(options),
    logSilentTransitions: options.logSilentTransitions ?? false,
  });
}

/** Builds the log of a finished simulation of `parsedNet`. */
export function toOcelLog(
  parsedNet: ParsedNet,
  simulation: SimulationResult,
  options: OcelOptions = {},
): OcelLog {
  const builder = createOcelLogBuilder(parsedNet, options);
  simulation.firings.forEach((firing) => builder.addFiring(firing));
  return builder.build();
}
