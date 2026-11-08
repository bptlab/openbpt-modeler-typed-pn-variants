import type { PlaceTokens, TransitionFiring } from "../../types/log";
import type { ObjectToken } from "../../types/marking";
import type { PetriNet } from "../../types/net";
import type { OcelLogBuilder, OcelModeContext } from "../mode";
import type {
  OcelAttributeDefinition,
  OcelEvent,
  OcelLog,
  OcelObject,
  OcelType,
} from "../../../ocel/types";
import {
  formatInitialState,
  formatLinkedTypes,
  formatStateTransition,
  INITIAL_STATE,
  LINKED_TYPES,
  STATE_TRANSITION,
} from "../../../ocel/stateAware";
import {
  getEventTypeNames,
  getObjectTypeNames,
  ObjectIdAssignment,
  QUALIFIER,
} from "./shared";

/** Link objects are named l1, l2, … */
const LINK_ID_PREFIX = "l";

/**
 * The state-aware log mode. It logs links (tokens on link places) as objects of their own
 * and records how objects move between places:
 * - object types: one per data class (named as in the default mode), then one per distinct
 *   set of data classes of a link place, named `Link<type1>x<type2>…` with the data classes
 *   in declaration order. Every object type has a `state transition` and an `initialState`
 *   attribute, link types also `linkedTypes` (all strings),
 * - event types: as in the default mode,
 * - events: one per non-silent firing, related to every object that gets a state transition
 *   in it (see below), i.e. to the objects it moves between places with one data class and
 *   to the links it consumes or produces. Objects of the binding that it only touches
 *   through link tokens are reached through their link objects,
 * - link objects (`l1`, `l2`, …): a link is identified by its type and the objects it links.
 *   It exists while it has a token on a link place; producing it again after its last token
 *   was consumed creates a new link object. A new link object gets a `linkedTypes` value
 *   (e.g. `Order, Item`) and is related to each object it links, and each of them to it.
 *   Linked objects are not related to each other directly. The links of the initial
 *   marking are logged up front, at the initial time (see below),
 * - initial state: every object and link of the initial marking (also objects that only
 *   occur in link tokens) is logged up front with an `initialState` value `{p1, p2}`, the
 *   places it starts in (`{}` if none), at the initial time: one time step before the first
 *   firing. As for state transitions, objects only count places with one data class and
 *   links only link places,
 * - state transitions: in each logged firing, an object gets a `state transition` value
 *   `({p1, p2}, {p3})`, the places it was consumed from and the places it was produced into
 *   (`{}` if none), unless both are empty. Objects only count places with one data class,
 *   links only link places. Places are named by their name, or by their id if they have
 *   none or share it with another place of the same color,
 * - silent firings: with `logSilentTransitions`, they are logged like other firings but get
 *   no event. Otherwise nothing is logged for them (the links they create or end still
 *   count for which link object a later firing refers to).
 */
export function createStateAwareMode(context: OcelModeContext): OcelLogBuilder {
  return new StateAwareModeBuilder(context);
}

interface LinkType {
  name: string;
  /** In declaration order. */
  dataClassIds: string[];
  /** Object type names of `dataClassIds`. */
  linkedTypeNames: string[];
}

interface ObjectEntry {
  object: OcelObject;
  relatedIds: Set<string>;
}

/** A link that has at least one token on a link place. */
interface LiveLink {
  key: string;
  /** Its tokens on link places. When it drops to 0, the link ends. */
  tokenCount: number;
  /** Undefined while only unlogged silent firings have touched the link. */
  objectId?: string;
}

/** The places an object was consumed from and produced into in one firing. */
interface Move {
  entry: ObjectEntry;
  from: Set<string>;
  to: Set<string>;
}

class StateAwareModeBuilder implements OcelLogBuilder {
  /** Data class id → object type name. */
  private readonly objectTypeNames: Map<string, string>;
  /** Transition id → event type name (non-silent transitions only). */
  private readonly eventTypeNames: Map<string, string>;
  /** Place id → name used in state transitions. */
  private readonly placeLabels: Map<string, string>;
  private readonly linkTypes: LinkType[];
  /** Link place id → its link type. */
  private readonly linkTypeOfPlace: Map<string, LinkType>;
  private readonly objectIds: ObjectIdAssignment;
  /** OCEL object id → object (links included), in order of creation. */
  private readonly objects = new Map<string, ObjectEntry>();
  /** Link key → the link, as long as it has tokens. */
  private readonly liveLinks = new Map<string, LiveLink>();
  private readonly events: OcelEvent[] = [];

  constructor(private readonly context: OcelModeContext) {
    const { net, initialMarking, clock } = context;
    this.objectTypeNames = getObjectTypeNames(net);
    this.eventTypeNames = getEventTypeNames(net);
    this.placeLabels = getPlaceLabels(net);
    const linkTypes = getLinkTypes(net, this.objectTypeNames);
    this.linkTypes = linkTypes.linkTypes;
    this.linkTypeOfPlace = linkTypes.linkTypeOfPlace;
    this.objectIds = new ObjectIdAssignment(
      initialMarking,
      this.objectTypeNames,
    );

    // The initial marking is logged up front, one time step before the first firing, even
    // if no firing touches it: its links get their link objects, and every object and link
    // in it gets its initial places as `initialState`.
    const initialTime = clock.timeOfStep(0);
    /** OCEL object id → its initial places (labels), in order of the initial marking. */
    const initialStates = new Map<string, Set<string>>();
    const addInitialState = (entry: ObjectEntry, label?: string) => {
      let states = initialStates.get(entry.object.id);
      if (!states) {
        states = new Set();
        initialStates.set(entry.object.id, states);
      }
      if (label !== undefined) states.add(label);
    };
    for (const [placeId, tokens] of initialMarking) {
      const label = this.placeLabels.get(placeId) ?? placeId;
      const linkType = this.linkTypeOfPlace.get(placeId);
      for (const token of tokens) {
        if (linkType) {
          const link = this.liveLink(linkType, token);
          link.tokenCount++;
          const linkId = this.ensureLinkObject(
            link,
            linkType,
            token,
            initialTime,
          );
          addInitialState(this.getEntry(linkId), label);
          // Members are in the initial marking too; link places are not their own places.
          for (const [dataClassId, value] of linkedValues(linkType, token)) {
            addInitialState(this.ensureObject(dataClassId, value));
          }
        } else {
          for (const [dataClassId, value] of Object.entries(token)) {
            addInitialState(this.ensureObject(dataClassId, value), label);
          }
        }
      }
    }
    for (const [objectId, states] of initialStates) {
      this.getEntry(objectId).object.attributes.push({
        name: INITIAL_STATE,
        time: initialTime,
        value: formatInitialState(states),
      });
    }
  }

  addFiring(firing: TransitionFiring): void {
    if (!firing.transition.isSilent || this.context.logSilentTransitions) {
      this.logFiring(firing);
    }
    this.updateLinkTokens(firing);
  }

  build(): OcelLog {
    const attribute = (name: string): OcelAttributeDefinition => ({
      name,
      type: "string",
    });

    return {
      objectTypes: [
        ...Array.from(new Set(this.objectTypeNames.values()), (name) => ({
          name,
          attributes: [attribute(STATE_TRANSITION), attribute(INITIAL_STATE)],
        })),
        ...this.linkTypes.map(({ name }) => ({
          name,
          attributes: [
            attribute(STATE_TRANSITION),
            attribute(INITIAL_STATE),
            attribute(LINKED_TYPES),
          ],
        })),
      ],
      eventTypes: Array.from(
        new Set(this.eventTypeNames.values()),
        (name): OcelType => ({ name, attributes: [] }),
      ),
      objects: Array.from(this.objects.values(), ({ object, relatedIds }) => ({
        ...object,
        attributes: [...object.attributes],
        relationships: Array.from(relatedIds, (objectId) => ({
          objectId,
          qualifier: QUALIFIER,
        })),
      })),
      events: [...this.events],
    };
  }

  /**
   * Logs the objects, links and state transitions of a firing, and its event unless it is
   * silent. Runs before `updateLinkTokens`, so the links still have their tokens from before
   * the firing: a produced link is new only if it had no token left.
   */
  private logFiring(firing: TransitionFiring): void {
    const time = this.context.clock.timeOfStep(firing.step);
    /** OCEL object id → move, in order of involvement. */
    const moves = new Map<string, Move>();
    const involve = (entry: ObjectEntry): Move => {
      let move = moves.get(entry.object.id);
      if (!move) {
        move = { entry, from: new Set(), to: new Set() };
        moves.set(entry.object.id, move);
      }
      return move;
    };

    // Logs the objects of the binding and keeps the event's relationships in binding order.
    for (const variable of firing.binding) {
      for (const value of variable.values) {
        involve(this.ensureObject(variable.dataClassId, value));
      }
    }

    const addMoves = (placeTokens: PlaceTokens[], side: "from" | "to") => {
      for (const { placeId, tokens } of placeTokens) {
        const label = this.placeLabels.get(placeId) ?? placeId;
        const linkType = this.linkTypeOfPlace.get(placeId);
        for (const token of tokens) {
          if (linkType) {
            const link = this.liveLink(linkType, token);
            const linkId = this.ensureLinkObject(link, linkType, token, time);
            involve(this.getEntry(linkId))[side].add(label);
          } else {
            for (const [dataClassId, value] of Object.entries(token)) {
              involve(this.ensureObject(dataClassId, value))[side].add(label);
            }
          }
        }
      }
    };
    addMoves(firing.consumed, "from");
    addMoves(firing.produced, "to");

    // Objects that did not move between places are left out of both the state transitions
    // and the event. Links always moved, as they are only involved through their tokens.
    const moved = Array.from(moves.values()).filter(
      ({ from, to }) => from.size > 0 || to.size > 0,
    );
    for (const { entry, from, to } of moved) {
      entry.object.attributes.push({
        name: STATE_TRANSITION,
        time,
        value: formatStateTransition(from, to),
      });
    }

    if (!firing.transition.isSilent) {
      this.events.push({
        id: `e${this.events.length + 1}`,
        type:
          this.eventTypeNames.get(firing.transition.id) ?? firing.transition.id,
        time,
        attributes: [],
        relationships: moved.map(({ entry }) => ({
          objectId: entry.object.id,
          qualifier: QUALIFIER,
        })),
      });
    }
  }

  /** Counts the link tokens a firing consumes and produces; links without tokens end. */
  private updateLinkTokens(firing: TransitionFiring): void {
    const touched = new Set<LiveLink>();
    const count = (placeTokens: PlaceTokens[], delta: number) => {
      for (const { placeId, tokens } of placeTokens) {
        const linkType = this.linkTypeOfPlace.get(placeId);
        if (!linkType) continue;
        for (const token of tokens) {
          const link = this.liveLink(linkType, token);
          link.tokenCount += delta;
          touched.add(link);
        }
      }
    };
    count(firing.consumed, -1);
    count(firing.produced, 1);

    for (const link of touched) {
      if (link.tokenCount <= 0) {
        this.liveLinks.delete(link.key);
      }
    }
  }

  /** The link a token on a place of `linkType` belongs to; a new one if it has no tokens. */
  private liveLink(linkType: LinkType, token: ObjectToken): LiveLink {
    const key = JSON.stringify([
      linkType.name,
      ...linkType.dataClassIds.map((dataClassId) => token[dataClassId] ?? null),
    ]);
    let link = this.liveLinks.get(key);
    if (!link) {
      link = { key, tokenCount: 0 };
      this.liveLinks.set(key, link);
    }
    return link;
  }

  /**
   * The link's object id. Creates the link object if it has none yet, with its
   * `linkedTypes` value at `time` and its relationships to the linked objects.
   */
  private ensureLinkObject(
    link: LiveLink,
    linkType: LinkType,
    token: ObjectToken,
    time: string,
  ): string {
    if (link.objectId !== undefined) return link.objectId;

    const id = this.objectIds.nextFreshId(LINK_ID_PREFIX);
    const entry: ObjectEntry = {
      object: {
        id,
        type: linkType.name,
        attributes: [
          {
            name: LINKED_TYPES,
            time,
            value: formatLinkedTypes(linkType.linkedTypeNames),
          },
        ],
        relationships: [],
      },
      relatedIds: new Set(),
    };
    this.objects.set(id, entry);
    for (const [dataClassId, value] of linkedValues(linkType, token)) {
      const linked = this.ensureObject(dataClassId, value);
      entry.relatedIds.add(linked.object.id);
      linked.relatedIds.add(id);
    }
    link.objectId = id;
    return id;
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

  private getEntry(id: string): ObjectEntry {
    const entry = this.objects.get(id);
    if (!entry) {
      throw new Error(`Object ${id} has not been logged.`);
    }
    return entry;
  }
}

/** The data class ids and object identifiers of a link token, in link type order. */
function linkedValues(
  linkType: LinkType,
  token: ObjectToken,
): Array<[dataClassId: string, value: string]> {
  return linkType.dataClassIds.flatMap((dataClassId) => {
    const value = token[dataClassId];
    return value === undefined ? [] : [[dataClassId, value]];
  });
}

/**
 * Place name, or its id if it has no name or another place of the same color (the same set
 * of data classes) has the same name. Names only need to be unique per color, because an
 * object's states are the places of its data class and a link's states the places of its
 * link type.
 */
function getPlaceLabels(net: PetriNet): Map<string, string> {
  const nameKey = (color: readonly string[], name: string) =>
    JSON.stringify([Array.from(new Set(color)).sort(), name]);
  const nameCounts = new Map<string, number>();
  for (const { name, color } of net.places.values()) {
    if (name && name.trim() !== "") {
      const key = nameKey(color, name);
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
  }
  const labels = new Map<string, string>();
  for (const { id, name, color } of net.places.values()) {
    labels.set(
      id,
      name && nameCounts.get(nameKey(color, name)) === 1 ? name : id,
    );
  }
  return labels;
}

/**
 * One link type per distinct set of data classes of the link places, in the order of their
 * first place. Named `Link<type1>x<type2>…` with the data classes in declaration order; a
 * numeric suffix keeps the name unique if it clashes with another object type.
 */
function getLinkTypes(
  net: PetriNet,
  objectTypeNames: Map<string, string>,
): { linkTypes: LinkType[]; linkTypeOfPlace: Map<string, LinkType> } {
  const declarationOrder = new Map(
    Array.from(net.dataClasses.keys(), (id, index) => [id, index]),
  );
  const rank = (id: string) =>
    declarationOrder.get(id) ?? declarationOrder.size;
  const usedNames = new Set(objectTypeNames.values());
  const typesByDataClasses = new Map<string, LinkType>();
  const linkTypeOfPlace = new Map<string, LinkType>();

  for (const place of net.places.values()) {
    const dataClassIds = Array.from(new Set(place.color)).sort(
      (a, b) => rank(a) - rank(b),
    );
    if (dataClassIds.length < 2) continue;

    const key = dataClassIds.join(" ");
    let linkType = typesByDataClasses.get(key);
    if (!linkType) {
      const linkedTypeNames = dataClassIds.map(
        (id) => objectTypeNames.get(id) ?? id,
      );
      linkType = {
        name: uniqueName(`Link${linkedTypeNames.join("x")}`, usedNames),
        dataClassIds,
        linkedTypeNames,
      };
      typesByDataClasses.set(key, linkType);
    }
    linkTypeOfPlace.set(place.id, linkType);
  }
  return {
    linkTypes: Array.from(typesByDataClasses.values()),
    linkTypeOfPlace,
  };
}

function uniqueName(name: string, usedNames: Set<string>): string {
  let unique = name;
  for (let suffix = 2; usedNames.has(unique); suffix++) {
    unique = `${name}#${suffix}`;
  }
  usedNames.add(unique);
  return unique;
}
