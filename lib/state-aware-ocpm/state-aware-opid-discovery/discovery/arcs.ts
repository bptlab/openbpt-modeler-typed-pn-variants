import type { LogObject, Occurrence } from "../log/readStateAwareLog";
import type {
  DiscoveredArc,
  DiscoveredDataClass,
  DiscoveredInscriptionElement,
  DiscoveredPlace,
  DiscoveredTransition,
  DiscoveredVariable,
} from "../types";
import { compareNames, type NextId } from "./ids";
import type { PlaceLookup } from "./places";
import type { OccurrenceGroup } from "./transitions";

/** How one object of a data-class type moved in an occurrence (place ids). */
interface ObjectMove {
  object: LogObject;
  from: Set<string>;
  to: Set<string>;
}

/** A variable before it is named. */
interface VariableDraft {
  key: string;
  dataClass: DiscoveredDataClass;
  from: string[];
  to: string[];
  isMultiple: boolean;
}

/**
 * Turns each occurrence group into a transition with its variables, and creates its arcs:
 * an input arc from every place in the source states of its signature and an output arc
 * to every place in the target states, one per place and direction.
 *
 * Variables come from the group's first occurrence: one per distinct (data class, source
 * places, target places) of its objects, where an object's places include those of the
 * link objects it is a member of.
 */
export function discoverTransitionsAndArcs(
  groups: OccurrenceGroup[],
  dataClasses: DiscoveredDataClass[],
  places: PlaceLookup,
  nextId: NextId,
  warnings: string[],
): { transitions: DiscoveredTransition[]; arcs: DiscoveredArc[] } {
  const dataClassesByName = new Map(
    dataClasses.map((dataClass) => [dataClass.name, dataClass]),
  );
  const transitions: DiscoveredTransition[] = [];
  const arcs: DiscoveredArc[] = [];

  for (const group of groups) {
    const transitionId = nextId("Transition");
    const describe =
      group.eventType === undefined
        ? `Silent transition ${transitionId}`
        : `Transition "${group.eventType}" (${transitionId})`;

    const variables = nameVariables(
      findVariables(group, places, dataClassesByName, describe, warnings),
    );
    transitions.push({
      id: transitionId,
      name: group.eventType,
      isSilent: group.eventType === undefined,
      signature: group.signature,
      occurrenceCount: group.occurrences.length,
      variables,
    });

    const placesOf = (side: "from" | "to") =>
      unique(
        group.signature.flatMap((triple) =>
          triple[side].map((state) => places.get(triple.objectType, state)),
        ),
      );
    for (const direction of ["input", "output"] as const) {
      const side = direction === "input" ? "from" : "to";
      for (const place of placesOf(side)) {
        arcs.push(
          createArc(
            nextId("Arc"),
            direction,
            place,
            transitionId,
            variables.filter((variable) => variable[side].includes(place.id)),
            dataClasses,
            describe,
            warnings,
          ),
        );
      }
    }
  }
  return { transitions, arcs };
}

function findVariables(
  group: OccurrenceGroup,
  places: PlaceLookup,
  dataClassesByName: Map<string, DiscoveredDataClass>,
  describe: string,
  warnings: string[],
): VariableDraft[] {
  const drafts = new Map<string, VariableDraft>();
  const [first] = group.occurrences;
  for (const move of objectMoves(first, places)) {
    const key = moveKey(move);
    if (drafts.has(key)) continue;
    drafts.set(key, {
      key,
      dataClass: dataClassesByName.get(move.object.type)!,
      from: sorted(move.from),
      to: sorted(move.to),
      isMultiple: false,
    });
  }

  let warned = false;
  for (const occurrence of group.occurrences) {
    const counts = new Map<string, number>();
    for (const move of objectMoves(occurrence, places)) {
      const key = moveKey(move);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of counts) {
      const draft = drafts.get(key);
      if (draft) {
        if (count > 1) draft.isMultiple = true;
      } else if (!warned) {
        warnings.push(
          `${describe}: ${occurrence.description} moves objects differently than ${first.description}; the variables follow ${first.description}.`,
        );
        warned = true;
      }
    }
  }
  return Array.from(drafts.values());
}

/**
 * Names the variables per data class: the first one gets the data class alias, the next
 * ones `<alias>1`, `<alias>2`, …, skipping names already used in the transition.
 */
function nameVariables(drafts: VariableDraft[]): DiscoveredVariable[] {
  const usedNames = new Set<string>();
  const nextIndex = new Map<string, number>();
  return drafts.map((draft) => {
    const { alias, id } = draft.dataClass;
    let index = nextIndex.get(id) ?? 0;
    let name: string;
    do {
      name = index === 0 ? alias : `${alias}${index}`;
      index++;
    } while (usedNames.has(name));
    nextIndex.set(id, index);
    usedNames.add(name);
    return {
      name,
      dataClassId: id,
      from: draft.from,
      to: draft.to,
      isGenerated: draft.from.length === 0,
      isMultiple: draft.isMultiple,
    };
  });
}

function createArc(
  id: string,
  direction: DiscoveredArc["direction"],
  place: DiscoveredPlace,
  transitionId: string,
  variables: DiscoveredVariable[],
  dataClasses: DiscoveredDataClass[],
  describe: string,
  warnings: string[],
): DiscoveredArc {
  const nameOf = (dataClassId: string) =>
    dataClasses.find((dataClass) => dataClass.id === dataClassId)?.name ?? "";
  const inscription: DiscoveredInscriptionElement[] = variables
    .map((variable) => ({
      dataClassId: variable.dataClassId,
      variableName: variable.name,
      isGenerated: variable.isGenerated,
    }))
    .sort(
      (a, b) =>
        compareNames(nameOf(a.dataClassId), nameOf(b.dataClassId)) ||
        compareNames(a.variableName, b.variableName),
    );
  const arcName = `the arc ${direction === "input" ? "from" : "to"} place ${place.label} (${id})`;

  if (inscription.length === 0) {
    warnings.push(`${describe}: ${arcName} has no variable.`);
  }
  const dataClassIds = inscription.map((element) => element.dataClassId);
  const repeated = dataClassIds.find(
    (dataClassId, index) => dataClassIds.indexOf(dataClassId) !== index,
  );
  if (repeated !== undefined) {
    warnings.push(
      `${describe}: ${arcName} carries several variables of data class ${nameOf(repeated)} (${inscription
        .filter((element) => element.dataClassId === repeated)
        .map((element) => element.variableName)
        .join(", ")}).`,
    );
  }

  const variableTypes = unique(
    variables
      .filter((variable) => variable.isMultiple)
      .map((variable) => variable.dataClassId),
  ).sort((a, b) => compareNames(nameOf(a), nameOf(b)));
  if (variableTypes.length > 1) {
    warnings.push(
      `${describe}: ${arcName} carries set variables of several data classes (${variableTypes
        .map(nameOf)
        .join(
          ", ",
        )}), but an arc has only one variable type; it gets ${nameOf(variableTypes[0])}.`,
    );
  }

  return {
    id,
    direction,
    placeId: place.id,
    transitionId,
    inscription,
    variableTypeId: variableTypes[0],
  };
}

/**
 * How the occurrence moves each object of a data-class type, in order of first
 * involvement: its own source and target places, and those of the link objects it is a
 * member of.
 */
function objectMoves(
  occurrence: Occurrence,
  places: PlaceLookup,
): ObjectMove[] {
  const moves = new Map<LogObject, ObjectMove>();
  for (const object of occurrence.objects) {
    const { from, to } = object.stateTransitions.get(occurrence.time)!;
    for (const moved of object.isLink ? object.members : [object]) {
      let move = moves.get(moved);
      if (!move) {
        move = { object: moved, from: new Set(), to: new Set() };
        moves.set(moved, move);
      }
      for (const state of from) {
        move.from.add(places.get(object.type, state).id);
      }
      for (const state of to) {
        move.to.add(places.get(object.type, state).id);
      }
    }
  }
  return Array.from(moves.values());
}

function moveKey({ object, from, to }: ObjectMove): string {
  return JSON.stringify([object.type, sorted(from), sorted(to)]);
}

function sorted(values: Iterable<string>): string[] {
  return Array.from(values).sort();
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
