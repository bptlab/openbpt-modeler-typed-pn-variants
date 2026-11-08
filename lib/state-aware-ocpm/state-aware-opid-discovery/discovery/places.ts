import { LINKED_TYPES } from "../../ocel/stateAware";
import { DiscoveryInputError } from "../errors";
import type { StateAwareLog } from "../log/readStateAwareLog";
import type { DiscoveredDataClass, DiscoveredPlace } from "../types";
import { compareNames, type NextId } from "./ids";

export interface PlaceLookup {
  /** By object type (declaration order), then by first appearance of the state. */
  places: DiscoveredPlace[];
  /** The place of `state` for objects of `objectType`. */
  get(objectType: string, state: string): DiscoveredPlace;
}

/**
 * One place per object type and state that any object of the type was in: started in
 * (`initialState`), consumed from or produced into. The label is the state. The color is
 * the type's data class, or, for a link type, the data classes named in the `linkedTypes`
 * value of its first object.
 *
 * @throws DiscoveryInputError if a link type with states has no `linkedTypes` value, or
 *   names an object type that is not a data class
 */
export function discoverPlaces(
  log: StateAwareLog,
  dataClasses: DiscoveredDataClass[],
  nextId: NextId,
  warnings: string[],
): PlaceLookup {
  const dataClassesByName = new Map(
    dataClasses.map((dataClass) => [dataClass.name, dataClass]),
  );
  const places: DiscoveredPlace[] = [];
  const placesByKey = new Map<string, DiscoveredPlace>();

  for (const objectType of log.objectTypes) {
    const objectsOfType = log.objects.filter(
      (object) => object.type === objectType,
    );
    const states = new Set<string>();
    for (const object of objectsOfType) {
      // The initial states come first: they are the earliest.
      object.initialStates?.forEach((state) => states.add(state));
      const times = Array.from(object.stateTransitions.keys()).sort(
        (a, b) => a - b,
      );
      for (const time of times) {
        const { from, to } = object.stateTransitions.get(time)!;
        from.forEach((state) => states.add(state));
        to.forEach((state) => states.add(state));
      }
    }
    if (states.size === 0) continue;

    const color = log.linkTypes.has(objectType)
      ? linkColor(objectType, objectsOfType, dataClassesByName, warnings)
      : [dataClassesByName.get(objectType)!];
    const colorIds = color
      .sort((a, b) => compareNames(a.name, b.name))
      .map((dataClass) => dataClass.id);

    for (const state of states) {
      const place: DiscoveredPlace = {
        id: nextId("Place"),
        label: state,
        objectType,
        color: colorIds,
      };
      places.push(place);
      placesByKey.set(placeKey(objectType, state), place);
    }
  }

  return {
    places,
    get(objectType, state) {
      const place = placesByKey.get(placeKey(objectType, state));
      if (!place) {
        throw new Error(`No place for state ${state} of ${objectType}.`);
      }
      return place;
    },
  };
}

function linkColor(
  linkType: string,
  objectsOfType: StateAwareLog["objects"],
  dataClassesByName: Map<string, DiscoveredDataClass>,
  warnings: string[],
): DiscoveredDataClass[] {
  const withValue = objectsOfType.filter(
    (object) => object.linkedTypes !== undefined,
  );
  if (withValue.length === 0) {
    throw new DiscoveryInputError(
      `No object of the link type ${linkType} has a "${LINKED_TYPES}" value, so its places cannot be colored.`,
    );
  }
  const [first, ...rest] = withValue;
  const names = Array.from(new Set(first.linkedTypes));
  const differing = rest.find(
    (object) =>
      object.linkedTypes!.join("\n") !== first.linkedTypes!.join("\n"),
  );
  if (differing) {
    warnings.push(
      `Link objects ${first.id} and ${differing.id} of type ${linkType} have different "${LINKED_TYPES}" values; the places of ${linkType} use the one of ${first.id}.`,
    );
  }
  return names.map((name) => {
    const dataClass = dataClassesByName.get(name);
    if (!dataClass) {
      throw new DiscoveryInputError(
        `The "${LINKED_TYPES}" value of ${first.id} names "${name}", which is not an object type of the log (or a link type).`,
      );
    }
    return dataClass;
  });
}

function placeKey(objectType: string, state: string): string {
  return JSON.stringify([objectType, state]);
}
