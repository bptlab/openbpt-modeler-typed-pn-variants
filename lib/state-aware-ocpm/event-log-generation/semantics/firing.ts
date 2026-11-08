/**
 * Fires a transition with a concrete binding. Port of `executeBinding` in the modeler's
 * `context-pads/FireTransitionHandler.js` and its helpers in `FireTransitionUtils.js`.
 *
 * The modeler finds the data class of an inscription element by its position in the place's
 * color. Both lists are kept sorted by data class name and a place holds each data class at
 * most once, so this port uses the element's data class directly.
 */
import type { ConcreteBinding } from "../types/binding";
import type { Marking, ObjectToken } from "../types/marking";
import type {
  NetArc,
  NetDataClass,
  NetTransition,
  ObjectId,
  PetriNet,
} from "../types/net";
import { bindingKey } from "./keys";

export interface FiringEffect {
  /** Tokens removed, per input place. */
  consumed: Map<string, ObjectToken[]>;
  /** Tokens added, per output place. */
  produced: Map<string, ObjectToken[]>;
  /** The fresh object id per generated variable, keyed like a binding (`...:false`). */
  generatedBinding: ConcreteBinding;
  createdObjects: Array<{ id: ObjectId; dataClassId: string }>;
  warnings: string[];
}

export type CreateObjectId = (dataClass: NetDataClass) => ObjectId;

/**
 * The variables the transition creates fresh objects for: variable name → data class id.
 * If several output arcs generate the same variable name, the first one wins (one object).
 */
export function getGeneratedVariables(
  transition: NetTransition,
): Map<string, string> {
  const generatedVariables = new Map<string, string>();
  for (const arc of transition.outgoing) {
    for (const element of arc.inscription) {
      if (!element.isGenerated || !element.variableName) continue;
      if (generatedVariables.has(element.variableName)) continue;
      generatedVariables.set(element.variableName, element.dataClassId);
    }
  }
  return generatedVariables;
}

/**
 * Fires `transition` with `binding` and updates `marking` in place: matching tokens are
 * removed from the input places, fresh object ids are created for generated variables, and
 * the output tokens are added. The binding must come from the transition's valid bindings.
 */
export function fireTransition(
  net: PetriNet,
  marking: Marking,
  transition: NetTransition,
  binding: ConcreteBinding,
  createObjectId: CreateObjectId,
): FiringEffect {
  const placeUpdates = new Map<string, readonly ObjectToken[]>();
  const consumed = new Map<string, ObjectToken[]>();
  const produced = new Map<string, ObjectToken[]>();
  const warnings: string[] = [];

  // Phase 1: remove tokens from the input places
  for (const arc of transition.incoming) {
    if (arc.kind === "inhibitor") continue;

    const tokens = marking.get(arc.placeId) ?? [];
    const tokensToRemove = findMatchingTokens(tokens, arc, binding);
    if (tokensToRemove.length === 0) continue;

    const removeSet = new Set(tokensToRemove);
    const current = placeUpdates.get(arc.placeId) ?? tokens;
    placeUpdates.set(
      arc.placeId,
      current.filter((token) => !removeSet.has(token)),
    );
    consumed.set(arc.placeId, tokensToRemove);
  }

  // Phase 2: create fresh object ids for generated variables
  const generatedBinding: ConcreteBinding = {};
  const createdObjects: FiringEffect["createdObjects"] = [];
  for (const [variableName, dataClassId] of getGeneratedVariables(transition)) {
    const dataClass = net.dataClasses.get(dataClassId) ?? {
      id: dataClassId,
      name: dataClassId,
      alias: "",
    };
    const id = createObjectId(dataClass);
    generatedBinding[bindingKey(dataClassId, variableName, false)] = [id];
    createdObjects.push({ id, dataClassId });
  }

  // Phase 3: add tokens to the output places
  for (const arc of transition.outgoing) {
    const place = net.places.get(arc.placeId);
    if (!place) continue;

    const valuesPerColor = place.color.map((dataClassId) =>
      unique(
        getOutputValues(
          arc,
          dataClassId,
          binding,
          generatedBinding,
          (message) => warnings.push(`Transition ${transition.id}: ${message}`),
        ),
      ),
    );
    const tokensToAdd = combineIntoTokens(place.color, valuesPerColor);
    if (tokensToAdd.length === 0) continue;

    const current = placeUpdates.get(place.id) ?? marking.get(place.id) ?? [];
    placeUpdates.set(place.id, [...current, ...tokensToAdd]);
    produced.set(place.id, [...(produced.get(place.id) ?? []), ...tokensToAdd]);
  }

  // Phase 4: apply all changes
  for (const [placeId, tokens] of placeUpdates) {
    marking.set(placeId, tokens);
  }

  return { consumed, produced, generatedBinding, createdObjects, warnings };
}

/**
 * The tokens of an input place that the arc consumes under the binding: every value of the
 * token must be among the values bound for its data class (`findMatchingToken`).
 * All matching tokens are consumed.
 */
function findMatchingTokens(
  tokens: readonly ObjectToken[],
  arc: NetArc,
  binding: ConcreteBinding,
): ObjectToken[] {
  if (tokens.length === 0) return [];

  const allowedValuesByDataClass = new Map<string, Set<ObjectId>>();
  for (const element of arc.inscription) {
    if (!element.variableName) continue;
    const key = bindingKey(
      element.dataClassId,
      element.variableName,
      arc.variableTypeId === element.dataClassId,
    );
    for (const value of binding[key] ?? []) {
      let allowed = allowedValuesByDataClass.get(element.dataClassId);
      if (!allowed) {
        allowed = new Set();
        allowedValuesByDataClass.set(element.dataClassId, allowed);
      }
      allowed.add(value);
    }
  }
  if (allowedValuesByDataClass.size === 0) return [];

  return tokens.filter((token) => {
    const values = Object.entries(token);
    return (
      values.length > 0 &&
      values.every(
        ([dataClassId, value]) =>
          allowedValuesByDataClass.get(dataClassId)?.has(value) ?? false,
      )
    );
  });
}

/** The values an output arc writes for one data class of its place (`getTokenValueMapFromBinding`). */
function getOutputValues(
  arc: NetArc,
  dataClassId: string,
  binding: ConcreteBinding,
  generatedBinding: ConcreteBinding,
  warn: (message: string) => void,
): ObjectId[] {
  const values: ObjectId[] = [];
  for (const element of arc.inscription) {
    if (element.dataClassId !== dataClassId || !element.variableName) continue;

    const key = bindingKey(
      dataClassId,
      element.variableName,
      arc.variableTypeId === dataClassId,
    );
    const elementValues =
      (element.isGenerated ? generatedBinding[key] : binding[key]) ?? [];
    if (elementValues.length === 0) {
      warn(`no value for "${key}" on arc ${arc.id}.`);
      continue;
    }
    values.push(...elementValues);
  }
  return values;
}

/**
 * Builds output tokens as the cartesian product of the values per data class: each
 * combination of one value per data class becomes one token.
 */
function combineIntoTokens(
  color: readonly string[],
  valuesPerColor: readonly ObjectId[][],
): ObjectToken[] {
  let tokens: Array<{ [dataClassId: string]: ObjectId }> = [{}];
  color.forEach((dataClassId, index) => {
    const next: typeof tokens = [];
    for (const token of tokens) {
      for (const value of valuesPerColor[index]) {
        next.push({ ...token, [dataClassId]: value });
      }
    }
    tokens = next;
  });
  return tokens;
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}
