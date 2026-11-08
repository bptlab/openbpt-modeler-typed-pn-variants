import { EventLogInputError } from "../errors";
import type { ParsedNet } from "../parsing/parseNet";
import { fireTransition, type FiringEffect } from "../semantics/firing";
import { parseBindingKey } from "../semantics/keys";
import { checkStructure } from "../semantics/structure";
import type { ConcreteBinding } from "../types/binding";
import type { ObjectTypeLimits } from "../types/limits";
import type {
  BoundVariable,
  NeverEnabledTransition,
  PlaceTokens,
  SimulationResult,
  TerminationReason,
  TransitionFiring,
} from "../types/log";
import type { Marking, ObjectToken } from "../types/marking";
import type { NetTransition, PetriNet } from "../types/net";
import { chooseConcreteBinding } from "./bindingChoice";
import { EnabledTransitions } from "./enabledTransitions";
import { ObjectBudget } from "./objectBudget";
import { ObjectIdGenerator } from "./objectIds";
import { resolveObjectLimits } from "./objectLimits";
import { createSeededRandom, pickRandom, randomSeed } from "./random";

export interface SimulationOptions {
  /** Maximum number of objects to create, all object types together. Always applies. */
  maxObjects: number;
  /**
   * Optional maximum per object type, keyed by data class name or id. Unlisted types are
   * only limited by `maxObjects`.
   */
  maxObjectsPerType?: ObjectTypeLimits;
  /** Seed for the random choices. A random seed is used (and reported) if omitted. */
  seed?: number;
}

/** Factor applied to the (effective) object limit to get the maximum number of firings. */
export const EVENTS_PER_OBJECT = 100;

/**
 * Plays the token game on the net, starting from its initial marking:
 * 1. pick an enabled transition uniformly (independent of how many bindings it has),
 * 2. pick one of its binding patterns uniformly and a concrete binding from it,
 * 3. fire it and record the firing,
 * 4. update the enabled transitions,
 *
 * until no transition is enabled or `effectiveMaxObjects * 100` firings were recorded.
 * Silent transitions are recorded (with `isSilent`) and count toward that limit.
 *
 * @throws EventLogInputError if the limits or the seed are invalid
 */
export function simulate(
  parsedNet: ParsedNet,
  options: SimulationOptions,
): SimulationResult {
  const { net } = parsedNet;
  const limits = resolveObjectLimits(
    net,
    options.maxObjects,
    options.maxObjectsPerType,
  );
  const seed = options.seed ?? randomSeed();
  if (!Number.isInteger(seed)) {
    throw new EventLogInputError(`The seed must be an integer, got ${seed}.`);
  }

  const warnings = [...parsedNet.warnings, ...limits.warnings];
  const marking = copyMarking(parsedNet.initialMarking);
  const random = createSeededRandom(seed);
  const objectIds = new ObjectIdGenerator(objectIdsIn(marking));
  const budget = new ObjectBudget(limits);
  const maxEvents = limits.effectiveMaxObjects * EVENTS_PER_OBJECT;

  // Transitions that are structurally incorrect can never fire; leave them out entirely.
  const fireableTransitions: NetTransition[] = [];
  const neverEnabledTransitions: NeverEnabledTransition[] = [];
  for (const transition of net.transitions.values()) {
    const check = checkStructure(transition, net);
    if (check.isIncorrect) {
      neverEnabledTransitions.push({
        id: transition.id,
        name: transition.name,
        reason: check.message,
      });
    } else {
      fireableTransitions.push(transition);
    }
  }

  const enabled = new EnabledTransitions(fireableTransitions, marking, budget);
  const firings: TransitionFiring[] = [];
  let terminationReason: TerminationReason;

  for (;;) {
    const enabledTransitions = enabled.list();
    if (enabledTransitions.length === 0) {
      terminationReason = "noEnabledTransitions";
      break;
    }
    if (firings.length >= maxEvents) {
      terminationReason = "maxEventsReached";
      break;
    }

    const transition = pickRandom(random, enabledTransitions);
    const pattern = pickRandom(random, enabled.patternsOf(transition));
    const binding = chooseConcreteBinding(pattern, random);

    const effect = fireTransition(net, marking, transition, binding, (dc) =>
      objectIds.next(dc),
    );
    budget.record(effect.createdObjects);
    warnings.push(...effect.warnings);

    firings.push(
      toFiringRecord(firings.length + 1, net, transition, binding, effect),
    );
    enabled.afterFiring(transition, effect.createdObjects.length);
  }

  return {
    firings,
    terminationReason,
    seed,
    maxObjects: limits.maxObjects,
    effectiveMaxObjects: limits.effectiveMaxObjects,
    maxEvents,
    createdObjectCount: budget.createdCount,
    objectsPerType: Array.from(net.dataClasses.values(), (dataClass) => ({
      dataClassId: dataClass.id,
      dataClassName: dataClass.name,
      created: budget.createdCountOf(dataClass.id),
      max: limits.maxObjectsPerType.get(dataClass.id),
    })),
    neverEnabledTransitions,
    warnings: Array.from(new Set(warnings)),
  };
}

function copyMarking(marking: Marking): Marking {
  // Tokens are never mutated, so copying the arrays is enough.
  return new Map(
    Array.from(marking, ([placeId, tokens]) => [placeId, [...tokens]]),
  );
}

function objectIdsIn(marking: Marking): Set<string> {
  const ids = new Set<string>();
  for (const tokens of marking.values()) {
    for (const token of tokens) {
      Object.values(token).forEach((id) => ids.add(id));
    }
  }
  return ids;
}

function toFiringRecord(
  step: number,
  net: PetriNet,
  transition: NetTransition,
  binding: ConcreteBinding,
  effect: FiringEffect,
): TransitionFiring {
  const dataClassName = (id: string) => net.dataClasses.get(id)?.name ?? id;

  const toBoundVariables = (
    keyedValues: ConcreteBinding,
    origin: BoundVariable["origin"],
  ): BoundVariable[] =>
    Object.entries(keyedValues).map(([key, values]) => {
      const { dataClassId, variableName, isVariable } = parseBindingKey(key);
      return {
        dataClassId,
        dataClassName: dataClassName(dataClassId),
        variableName,
        isVariable,
        values: [...values],
        origin,
      };
    });

  const toPlaceTokens = (
    tokensPerPlace: Map<string, ObjectToken[]>,
  ): PlaceTokens[] =>
    Array.from(tokensPerPlace, ([placeId, tokens]) => ({
      placeId,
      placeName: net.places.get(placeId)?.name,
      tokens,
    }));

  return {
    step,
    transition: {
      id: transition.id,
      name: transition.name,
      isSilent: transition.isSilent,
    },
    binding: [
      ...toBoundVariables(binding, "input"),
      ...toBoundVariables(effect.generatedBinding, "generated"),
    ],
    consumed: toPlaceTokens(effect.consumed),
    produced: toPlaceTokens(effect.produced),
    createdObjects: effect.createdObjects.map(({ id, dataClassId }) => ({
      id,
      dataClassId,
      dataClassName: dataClassName(dataClassId),
    })),
  };
}
