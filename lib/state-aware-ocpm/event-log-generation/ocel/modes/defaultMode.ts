import type { TransitionFiring } from "../../types/log";
import type { ObjectToken } from "../../types/marking";
import type { OcelLogBuilder, OcelModeContext } from "../mode";
import type {
  OcelEvent,
  OcelLog,
  OcelObject,
  OcelType,
} from "../../../ocel/types";
import {
  getEventTypeNames,
  getObjectTypeNames,
  isLinkPlace,
  ObjectIdAssignment,
  QUALIFIER,
} from "./shared";

/**
 * The default log mode:
 * - object types: one per data class, named by its name, or by its id if another data
 *   class has the same name,
 * - event types: one per distinct label of the non-silent transitions (transitions with the
 *   same label share one; unnamed transitions use their id),
 * - events: one per non-silent firing, in firing order, related to every distinct object of
 *   its binding (including objects the firing creates). Silent firings are not logged, but
 *   they advance the clock,
 * - objects: every object of a logged binding, plus the objects of link-place tokens in the
 *   initial marking,
 * - object-to-object relationships: within a token on a link place (a place with several
 *   data classes), each object is related to every other one. This covers the tokens of the
 *   initial marking and the tokens consumed or produced by non-silent firings.
 */
export function createDefaultMode(context: OcelModeContext): OcelLogBuilder {
  return new DefaultModeBuilder(context);
}

interface ObjectEntry {
  object: OcelObject;
  relatedIds: Set<string>;
}

class DefaultModeBuilder implements OcelLogBuilder {
  /** Data class id → object type name. */
  private readonly objectTypeNames: Map<string, string>;
  /** Transition id → event type name (non-silent transitions only). */
  private readonly eventTypeNames: Map<string, string>;
  private readonly objectIds: ObjectIdAssignment;
  /** OCEL object id → object, in order of creation. */
  private readonly objects = new Map<string, ObjectEntry>();
  private readonly events: OcelEvent[] = [];

  constructor(private readonly context: OcelModeContext) {
    const { net, initialMarking } = context;
    this.objectTypeNames = getObjectTypeNames(net);
    this.eventTypeNames = getEventTypeNames(net);
    this.objectIds = new ObjectIdAssignment(
      initialMarking,
      this.objectTypeNames,
    );

    // Links in the initial marking are derived up front, even if no firing touches them.
    for (const [placeId, tokens] of initialMarking) {
      if (isLinkPlace(net, placeId)) {
        tokens.forEach((token) => this.relateObjectsOfToken(token));
      }
    }
  }

  addFiring(firing: TransitionFiring): void {
    if (firing.transition.isSilent) return;

    const relatedObjectIds: string[] = [];
    for (const variable of firing.binding) {
      for (const value of variable.values) {
        const { id } = this.ensureObject(variable.dataClassId, value).object;
        if (!relatedObjectIds.includes(id)) {
          relatedObjectIds.push(id);
        }
      }
    }

    for (const { placeId, tokens } of [
      ...firing.consumed,
      ...firing.produced,
    ]) {
      if (isLinkPlace(this.context.net, placeId)) {
        tokens.forEach((token) => this.relateObjectsOfToken(token));
      }
    }

    this.events.push({
      id: `e${this.events.length + 1}`,
      type:
        this.eventTypeNames.get(firing.transition.id) ?? firing.transition.id,
      time: this.context.clock.timeOfStep(firing.step),
      attributes: [],
      relationships: relatedObjectIds.map((objectId) => ({
        objectId,
        qualifier: QUALIFIER,
      })),
    });
  }

  build(): OcelLog {
    const toTypes = (names: Iterable<string>): OcelType[] =>
      Array.from(new Set(names), (name) => ({ name, attributes: [] }));

    return {
      objectTypes: toTypes(this.objectTypeNames.values()),
      eventTypes: toTypes(this.eventTypeNames.values()),
      objects: Array.from(this.objects.values(), ({ object, relatedIds }) => ({
        ...object,
        relationships: Array.from(relatedIds, (objectId) => ({
          objectId,
          qualifier: QUALIFIER,
        })),
      })),
      events: [...this.events],
    };
  }

  private ensureObject(dataClassId: string, value: string): ObjectEntry {
    const id = this.objectIds.idOf(dataClassId, value);
    let entry = this.objects.get(id);
    if (!entry) {
      entry = {
        object: {
          id,
          type: this.objectTypeNames.get(dataClassId) ?? dataClassId,
          attributes: [],
          relationships: [],
        },
        relatedIds: new Set(),
      };
      this.objects.set(id, entry);
    }
    return entry;
  }

  private relateObjectsOfToken(token: ObjectToken): void {
    const entries = Object.entries(token).map(([dataClassId, value]) =>
      this.ensureObject(dataClassId, value),
    );
    for (const entry of entries) {
      for (const other of entries) {
        if (other !== entry) {
          entry.relatedIds.add(other.object.id);
        }
      }
    }
  }
}
