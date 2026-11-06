/**
 * Event log generation for typed Petri nets: simulates a net, records the sequence of
 * transition firings with their bindings, and turns it into an OCEL 2.0 log.
 *
 * Depends only on `../moddle` for reading the XML.
 */
import { createOcelLogBuilder, type OcelOptions } from "./ocel/buildOcelLog";
import { serializeOcelXml } from "./ocel/serializeXml";
import type { OcelLog } from "./ocel/types";
import {
  formatSimulationResult,
  type FormatOptions,
} from "./output/formatSimulationResult";
import { parseNet } from "./parsing/parseNet";
import { simulate } from "./simulation/simulate";
import type { ObjectTypeLimits } from "./types/limits";
import type { SimulationResult } from "./types/log";

export interface GenerateEventLogOptions extends FormatOptions, OcelOptions {
  /**
   * Maximum number of objects to create per object type, keyed by data class name or id,
   * e.g. `{ Order: 3, Item: 10 }`. Unlisted types are only limited by `maxObjects`.
   */
  maxObjectsPerType?: ObjectTypeLimits;
  /** Seed for the random choices; the result reports the seed that was used. */
  seed?: number;
  /** Build the OCEL 2.0 log (default: true). Set to false to only run the simulation. */
  generateLog?: boolean;
  /** Print the firing sequence to the console (default: true). */
  print?: boolean;
}

export interface EventLogGenerationResult {
  simulation: SimulationResult;
  /** The OCEL 2.0 log; undefined if `generateLog` is false. */
  log?: OcelLog;
  /** The log as OCEL 2.0 XML; undefined if `generateLog` is false. */
  ocelXml?: string;
}

/**
 * Simulates the net in `xml` (as produced by `saveXML`) from its initial marking, prints
 * the recorded firings, and returns them together with the OCEL 2.0 log.
 *
 * @param xml the Petri net XML
 * @param maxObjects the maximum number of objects to create during the simulation, all
 *   object types together. It always applies, also when `maxObjectsPerType` allows more.
 *   The run also stops after `effectiveMaxObjects * 100` firings (see `SimulationResult`).
 * @throws EventLogInputError if the XML cannot be read or an option is invalid; its
 *   message is meant to be shown to the user
 */
export async function generateEventLog(
  xml: string,
  maxObjects: number,
  options: GenerateEventLogOptions = {},
): Promise<EventLogGenerationResult> {
  const parsedNet = await parseNet(xml);

  // Created before simulating: the log mode reads the initial marking first.
  const logBuilder =
    options.generateLog === false
      ? undefined
      : createOcelLogBuilder(parsedNet, options);

  const simulation = simulate(parsedNet, {
    maxObjects,
    maxObjectsPerType: options.maxObjectsPerType,
    seed: options.seed,
  });
  if (options.print !== false) {
    console.log(formatSimulationResult(simulation, options));
  }

  if (!logBuilder) {
    return { simulation };
  }
  simulation.firings.forEach((firing) => logBuilder.addFiring(firing));
  const log = logBuilder.build();
  return { simulation, log, ocelXml: serializeOcelXml(log) };
}

export { EventLogInputError } from "./errors";
export { parseNet, simulate, formatSimulationResult, serializeOcelXml };
export { createOcelLogBuilder, toOcelLog } from "./ocel/buildOcelLog";
export { OCEL_MODE_NAMES } from "./ocel/modes";
export type { OcelOptions } from "./ocel/buildOcelLog";
export type { ClockOptions } from "./ocel/clock";
export type { OcelLogBuilder, OcelMode, OcelModeContext } from "./ocel/mode";
export type { OcelModeName } from "./ocel/modes";
export type {
  OcelAttributeDefinition,
  OcelAttributeType,
  OcelEvent,
  OcelEventAttribute,
  OcelLog,
  OcelObject,
  OcelObjectAttribute,
  OcelRelationship,
  OcelType,
} from "./ocel/types";
export type { ParsedNet } from "./parsing/parseNet";
export type { SimulationOptions } from "./simulation/simulate";
export type { FormatOptions } from "./output/formatSimulationResult";
export type {
  BindingKey,
  BindingPattern,
  ConcreteBinding,
} from "./types/binding";
export type { ObjectTypeLimits } from "./types/limits";
export type {
  BoundVariable,
  CreatedObject,
  NeverEnabledTransition,
  ObjectTypeSummary,
  PlaceTokens,
  SimulationResult,
  TerminationReason,
  TransitionFiring,
} from "./types/log";
export type { Marking, ObjectToken } from "./types/marking";
export type {
  NetArc,
  NetArcKind,
  NetDataClass,
  NetInscriptionElement,
  NetPlace,
  NetTransition,
  ObjectId,
  PetriNet,
} from "./types/net";
