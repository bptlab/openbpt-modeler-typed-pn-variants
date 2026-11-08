/**
 * State-aware OPID discovery: reads a state-aware OCEL 2.0 log (as written by the event log
 * generation in state-aware mode) and discovers an OPID that the modeler can open.
 *
 * Depends on the shared OCEL code (`../ocel`) and the modeler's moddle schema
 * (`../vendor/moddle`) for writing the XML.
 */
import { OcelFormatError } from "../ocel/errors";
import { parseOcelXml } from "../ocel/parseXml";
import type { OcelLog } from "../ocel/types";
import { discoverNet } from "./discovery/discoverNet";
import { DiscoveryInputError } from "./errors";
import { writeNetXml } from "./export/writeNetXml";
import { simpleLayout } from "./layout/simpleLayout";
import type { LayoutAlgorithm, NetLayout } from "./layout/types";
import type { DiscoveredNet } from "./types";

export interface DiscoverOpidOptions {
  /** Positions the places, transitions, arcs and labels (default: `simpleLayout`). */
  layout?: LayoutAlgorithm;
}

export interface OpidDiscoveryResult {
  net: DiscoveredNet;
  layout: NetLayout;
  /** The OPID as modeler XML, ready to be opened in the modeler. */
  xml: string;
  /** Oddities of the log that the discovery worked around, meant for the user. */
  warnings: string[];
}

/**
 * Discovers an OPID from the state-aware OCEL 2.0 log in `ocelXml`, lays it out and writes
 * it as modeler XML. The library does not touch the file system.
 *
 * @throws DiscoveryInputError if the XML cannot be read or the log cannot be used; its
 *   message is meant to be shown to the user
 */
export async function discoverOpid(
  ocelXml: string,
  options: DiscoverOpidOptions = {},
): Promise<OpidDiscoveryResult> {
  let log: OcelLog;
  try {
    log = parseOcelXml(ocelXml);
  } catch (error) {
    if (error instanceof OcelFormatError) {
      throw new DiscoveryInputError(error.message);
    }
    throw error;
  }
  const { net, warnings } = discoverNet(log);
  const layout = (options.layout ?? simpleLayout)(net);
  const xml = await writeNetXml(net, layout);
  return { net, layout, xml, warnings };
}

export { DiscoveryInputError };
export { discoverNet, simpleLayout, writeNetXml, parseOcelXml };
export { formatDiscoverySummary } from "./output/formatSummary";
export type { NetDiscovery } from "./discovery/discoverNet";
export type { LayoutAlgorithm, NetLayout };
export type { Bounds, Point, Size } from "./layout/geometry";
export type {
  DiscoveredArc,
  DiscoveredDataClass,
  DiscoveredInscriptionElement,
  DiscoveredNet,
  DiscoveredPlace,
  DiscoveredTransition,
  DiscoveredVariable,
  SignatureTriple,
} from "./types";
export type { OcelLog } from "../ocel/types";
