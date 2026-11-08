/**
 * Naming and object ids that the log modes share.
 */
import type { Marking } from "../../types/marking";
import type { PetriNet } from "../../types/net";

/** Relationships carry no qualifier. */
export const QUALIFIER = "";

/** A link place is a place with several data classes. */
export function isLinkPlace(net: PetriNet, placeId: string): boolean {
  return (net.places.get(placeId)?.color.length ?? 0) > 1;
}

/** Data class name, or its id if another data class has the same name. */
export function getObjectTypeNames(net: PetriNet): Map<string, string> {
  const nameCounts = new Map<string, number>();
  for (const { name } of net.dataClasses.values()) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const names = new Map<string, string>();
  for (const { id, name } of net.dataClasses.values()) {
    names.set(id, nameCounts.get(name) === 1 ? name : id);
  }
  return names;
}

/** Transition label, or its id if it has none. Silent transitions get no event type. */
export function getEventTypeNames(net: PetriNet): Map<string, string> {
  const names = new Map<string, string>();
  for (const { id, name, isSilent } of net.transitions.values()) {
    if (!isSilent) {
      names.set(id, name && name.trim() !== "" ? name : id);
    }
  }
  return names;
}

/**
 * OCEL object ids are the simulation's object identifiers. If the initial marking uses the
 * same identifier for objects of different data classes, those objects get
 * `<object type>:<identifier>` instead. (New objects of the simulation never reuse an
 * identifier.) A numeric suffix keeps ids unique in any remaining corner case.
 */
export class ObjectIdAssignment {
  /** Data class id → identifier → OCEL object id. */
  private readonly ids = new Map<string, Map<string, string>>();
  private readonly usedIds = new Set<string>();
  private readonly sharedIdentifiers = new Set<string>();
  /** Every identifier of the initial marking. */
  private readonly initialIdentifiers = new Set<string>();
  /** Prefix → next counter of `nextFreshId`. */
  private readonly nextFreshCounters = new Map<string, number>();

  constructor(
    initialMarking: Marking,
    private readonly objectTypeNames: Map<string, string>,
  ) {
    const dataClassesPerIdentifier = new Map<string, Set<string>>();
    for (const tokens of initialMarking.values()) {
      for (const token of tokens) {
        for (const [dataClassId, identifier] of Object.entries(token)) {
          const dataClasses =
            dataClassesPerIdentifier.get(identifier) ?? new Set();
          dataClasses.add(dataClassId);
          dataClassesPerIdentifier.set(identifier, dataClasses);
        }
      }
    }
    for (const [identifier, dataClasses] of dataClassesPerIdentifier) {
      this.initialIdentifiers.add(identifier);
      if (dataClasses.size > 1) {
        this.sharedIdentifiers.add(identifier);
      }
    }
  }

  idOf(dataClassId: string, identifier: string): string {
    let idsOfClass = this.ids.get(dataClassId);
    if (!idsOfClass) {
      idsOfClass = new Map();
      this.ids.set(dataClassId, idsOfClass);
    }
    const existing = idsOfClass.get(identifier);
    if (existing !== undefined) return existing;

    const typeName = this.objectTypeNames.get(dataClassId) ?? dataClassId;
    let id = this.sharedIdentifiers.has(identifier)
      ? `${typeName}:${identifier}`
      : identifier;
    if (this.usedIds.has(id)) {
      let suffix = 2;
      while (this.usedIds.has(`${id}#${suffix}`)) suffix++;
      id = `${id}#${suffix}`;
    }

    idsOfClass.set(identifier, id);
    this.usedIds.add(id);
    return id;
  }

  /**
   * A new id `<prefix><n>` (n = 1, 2, …) for an object that is not a simulation object,
   * e.g. a link. It skips the ids in use and the identifiers of the initial marking, so it
   * cannot clash with a later object. (The simulation's own ids contain an underscore.)
   */
  nextFreshId(prefix: string): string {
    let counter = this.nextFreshCounters.get(prefix) ?? 1;
    let id: string;
    do {
      id = `${prefix}${counter++}`;
    } while (this.usedIds.has(id) || this.initialIdentifiers.has(id));
    this.nextFreshCounters.set(prefix, counter);
    this.usedIds.add(id);
    return id;
  }
}
