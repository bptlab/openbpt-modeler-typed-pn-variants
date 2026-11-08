import type { Occurrence, StateAwareLog } from "../log/readStateAwareLog";
import type { SignatureTriple } from "../types";

/** The occurrences that become one transition. */
export interface OccurrenceGroup {
  /** The event type; undefined for silent time points. */
  eventType?: string;
  signature: SignatureTriple[];
  /** In time order; the first one defines the transition's variables. */
  occurrences: Occurrence[];
}

/**
 * Groups the events by event type and signature, and the silent time points by
 * signature. Each group becomes one transition, in order of its first occurrence.
 */
export function groupOccurrences(log: StateAwareLog): OccurrenceGroup[] {
  const typeRanks = new Map(
    log.objectTypes.map((type, index) => [type, index]),
  );
  const groups = new Map<string, OccurrenceGroup>();
  for (const occurrence of log.occurrences) {
    const signature = signatureOf(occurrence, typeRanks);
    const key = JSON.stringify([
      occurrence.eventType ?? null,
      signature.map(tripleKey),
    ]);
    let group = groups.get(key);
    if (!group) {
      group = { eventType: occurrence.eventType, signature, occurrences: [] };
      groups.set(key, group);
    }
    group.occurrences.push(occurrence);
  }
  return Array.from(groups.values());
}

/**
 * The distinct (object type, source states, target states) of the occurrence's objects,
 * with the states sorted, ordered by object type and then by states.
 */
export function signatureOf(
  occurrence: Occurrence,
  typeRanks: Map<string, number>,
): SignatureTriple[] {
  const triples = new Map<string, SignatureTriple>();
  for (const object of occurrence.objects) {
    const { from, to } = object.stateTransitions.get(occurrence.time)!;
    const triple: SignatureTriple = {
      objectType: object.type,
      from: sortedUnique(from),
      to: sortedUnique(to),
    };
    triples.set(tripleKey(triple), triple);
  }
  return Array.from(triples.values()).sort(
    (a, b) =>
      (typeRanks.get(a.objectType) ?? 0) - (typeRanks.get(b.objectType) ?? 0) ||
      compareStrings(tripleKey(a), tripleKey(b)),
  );
}

function tripleKey({ objectType, from, to }: SignatureTriple): string {
  return JSON.stringify([objectType, from, to]);
}

function sortedUnique(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort(compareStrings);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
