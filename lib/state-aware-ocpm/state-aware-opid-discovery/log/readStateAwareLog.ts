import { OcelFormatError } from "../../ocel/errors";
import {
  LINKED_TYPES,
  parseLinkedTypes,
  parseStateTransition,
  STATE_TRANSITION,
  type StateTransitionValue,
} from "../../ocel/stateAware";
import type { OcelLog } from "../../ocel/types";
import { DiscoveryInputError } from "../errors";

export interface LogObject {
  id: string;
  type: string;
  /** Whether `type` is a link type (has a `linkedTypes` attribute). */
  isLink: boolean;
  /** State transitions by time (milliseconds since the epoch). */
  stateTransitions: Map<number, StateTransitionValue>;
  /** Link objects only: the linked objects of data-class types, in relationship order. */
  members: LogObject[];
  /** Link objects only: the first `linkedTypes` value, if any. */
  linkedTypes?: string[];
}

/** An event, or a time point with state transitions but no event (a silent firing). */
export interface Occurrence {
  /** The event type; undefined for a silent time point. */
  eventType?: string;
  /** The event id, or the time of a silent time point, for messages. */
  description: string;
  time: number;
  /**
   * The objects with a state transition at `time`, in log order: the event's related
   * objects, or all such objects for a silent time point.
   */
  objects: LogObject[];
}

export interface StateAwareLog {
  /** All object types, in declaration order. */
  objectTypes: string[];
  /** The object types with a `linkedTypes` attribute. */
  linkTypes: Set<string>;
  /** In log order. */
  objects: LogObject[];
  /** Events and silent time points, by time. */
  occurrences: Occurrence[];
}

/**
 * Reads the parts of a state-aware log the discovery needs: which object types are link
 * types, the state transitions of every object by time, the members of every link, and
 * the occurrences.
 *
 * @throws DiscoveryInputError if the log is not state-aware, a time or a state transition
 *   cannot be read, two events share a time, or an object has two state transitions at
 *   the same time
 */
export function readStateAwareLog(
  log: OcelLog,
  warnings: string[],
): StateAwareLog {
  const objectTypes: string[] = [];
  const linkTypes = new Set<string>();
  for (const { name, attributes } of log.objectTypes) {
    if (objectTypes.includes(name)) continue;
    objectTypes.push(name);
    if (attributes.some((attribute) => attribute.name === LINKED_TYPES)) {
      linkTypes.add(name);
    }
  }

  const objects = new Map<string, LogObject>();
  /** Time → the time as written in the log (for messages). */
  const timeTexts = new Map<number, string>();
  for (const { id, type, attributes } of log.objects) {
    if (objects.has(id)) {
      throw new DiscoveryInputError(`The log contains object ${id} twice.`);
    }
    if (!objectTypes.includes(type)) {
      throw new DiscoveryInputError(
        `Object ${id} has the undeclared object type "${type}".`,
      );
    }
    const object: LogObject = {
      id,
      type,
      isLink: linkTypes.has(type),
      stateTransitions: new Map(),
      members: [],
    };
    for (const attribute of attributes) {
      if (attribute.name === STATE_TRANSITION) {
        const time = parseTime(
          attribute.time,
          `the ${STATE_TRANSITION} of object ${id}`,
        );
        if (object.stateTransitions.has(time)) {
          throw new DiscoveryInputError(
            `Object ${id} has two ${STATE_TRANSITION} values at ${attribute.time}.`,
          );
        }
        object.stateTransitions.set(
          time,
          readStateTransition(attribute.value, id),
        );
        if (!timeTexts.has(time)) timeTexts.set(time, attribute.time);
      } else if (
        attribute.name === LINKED_TYPES &&
        object.linkedTypes === undefined
      ) {
        object.linkedTypes = parseLinkedTypes(attribute.value);
      }
    }
    objects.set(id, object);
  }

  for (const { id, relationships } of log.objects) {
    const object = objects.get(id);
    if (!object?.isLink) continue;
    for (const { objectId } of relationships) {
      const member = objects.get(objectId);
      if (member && !member.isLink && !object.members.includes(member)) {
        object.members.push(member);
      }
    }
  }

  if (
    !Array.from(objects.values()).some(
      (object) => object.stateTransitions.size > 0,
    )
  ) {
    throw new DiscoveryInputError(
      `The log contains no "${STATE_TRANSITION}" values. Only state-aware logs can be used (event log generation with --mode=state-aware).`,
    );
  }

  /** Time → the objects with a state transition then, in log order. */
  const objectsByTime = new Map<number, LogObject[]>();
  for (const object of objects.values()) {
    for (const time of object.stateTransitions.keys()) {
      const objectsAtTime = objectsByTime.get(time) ?? [];
      objectsAtTime.push(object);
      objectsByTime.set(time, objectsAtTime);
    }
  }

  const occurrences: Occurrence[] = [];
  /** Time → event id. */
  const eventTimes = new Map<number, string>();
  for (const event of log.events) {
    const time = parseTime(event.time, `the time of event ${event.id}`);
    const otherEvent = eventTimes.get(time);
    if (otherEvent !== undefined) {
      throw new DiscoveryInputError(
        `Events ${otherEvent} and ${event.id} both happen at ${event.time}, so their state transitions cannot be told apart.`,
      );
    }
    eventTimes.set(time, event.id);

    const related: LogObject[] = [];
    for (const { objectId } of event.relationships) {
      const object = objects.get(objectId);
      if (!object) {
        warnings.push(
          `Event ${event.id} is related to the unknown object ${objectId}, ignored.`,
        );
      } else if (!object.stateTransitions.has(time)) {
        warnings.push(
          `Event ${event.id} is related to ${objectId}, which has no ${STATE_TRANSITION} at its time, ignored.`,
        );
      } else if (!related.includes(object)) {
        related.push(object);
      }
    }
    occurrences.push({
      eventType: event.type,
      description: `event ${event.id}`,
      time,
      objects: related,
    });

    for (const object of objectsByTime.get(time) ?? []) {
      if (!related.includes(object)) {
        warnings.push(
          `${object.id} has a ${STATE_TRANSITION} at the time of event ${event.id} but is not related to it, ignored.`,
        );
      }
    }
  }

  for (const [time, objectsAtTime] of objectsByTime) {
    if (eventTimes.has(time)) continue;
    occurrences.push({
      description: `the silent firing at ${timeTexts.get(time)}`,
      time,
      objects: objectsAtTime,
    });
  }
  // Array.prototype.sort is stable, so events keep their log order within a time.
  occurrences.sort((a, b) => a.time - b.time);

  return {
    objectTypes,
    linkTypes,
    objects: Array.from(objects.values()),
    occurrences,
  };
}

function parseTime(text: string, what: string): number {
  const time = Date.parse(text);
  if (Number.isNaN(time)) {
    throw new DiscoveryInputError(
      `Cannot read ${what}: "${text}" is not an ISO 8601 time.`,
    );
  }
  return time;
}

function readStateTransition(
  value: string,
  objectId: string,
): StateTransitionValue {
  try {
    return parseStateTransition(value);
  } catch (error) {
    if (error instanceof OcelFormatError) {
      throw new DiscoveryInputError(`Object ${objectId}: ${error.message}`);
    }
    throw error;
  }
}
