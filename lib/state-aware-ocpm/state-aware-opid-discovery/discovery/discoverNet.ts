import type { OcelLog } from "../../ocel/types";
import { readStateAwareLog } from "../log/readStateAwareLog";
import type { DiscoveredNet } from "../types";
import { discoverTransitionsAndArcs } from "./arcs";
import { discoverDataClasses } from "./dataClasses";
import { createIdGenerator } from "./ids";
import { discoverPlaces } from "./places";
import { groupOccurrences } from "./transitions";

export interface NetDiscovery {
  net: DiscoveredNet;
  /** Oddities of the log that the discovery worked around, meant for the user. */
  warnings: string[];
}

/**
 * Discovers an OPID from a state-aware OCEL 2.0 log: data classes, places, transitions
 * (one per event type and signature, one silent transition per signature of the time
 * points without event), arcs and variables. Layout and XML export are separate steps.
 *
 * @throws DiscoveryInputError if the log cannot be used (see `readStateAwareLog`)
 */
export function discoverNet(log: OcelLog): NetDiscovery {
  const warnings: string[] = [];
  const stateAwareLog = readStateAwareLog(log, warnings);
  const nextId = createIdGenerator();
  const dataClasses = discoverDataClasses(stateAwareLog, nextId);
  const places = discoverPlaces(stateAwareLog, dataClasses, nextId, warnings);
  const { transitions, arcs } = discoverTransitionsAndArcs(
    groupOccurrences(stateAwareLog),
    dataClasses,
    places,
    nextId,
    warnings,
  );
  return {
    net: { dataClasses, places: places.places, transitions, arcs },
    warnings,
  };
}
