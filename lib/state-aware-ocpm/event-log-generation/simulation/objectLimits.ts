import { EventLogInputError } from "../errors";
import { getGeneratedVariables } from "../semantics/firing";
import type { ObjectTypeLimits } from "../types/limits";
import type { NetDataClass, PetriNet } from "../types/net";

export interface ResolvedObjectLimits {
  /** Limit on all created objects together (`MAX_OBJECTS`). It always applies. */
  maxObjects: number;
  /** Data class id → limit, for the listed object types. */
  maxObjectsPerType: Map<string, number>;
  /**
   * The most objects the simulation may create: the sum of the per-type limits if every
   * data class of the net has one and the sum is lower than `maxObjects`, else `maxObjects`.
   */
  effectiveMaxObjects: number;
  warnings: string[];
}

/**
 * Checks the object limits and maps the per-type limits (keyed by data class name or id)
 * to the net's data classes.
 *
 * @throws EventLogInputError if a limit is not a non-negative integer, or a type is
 *   unknown, ambiguous or listed twice
 */
export function resolveObjectLimits(
  net: PetriNet,
  maxObjects: number,
  limitsPerType: ObjectTypeLimits = {},
): ResolvedObjectLimits {
  if (!isNonNegativeInteger(maxObjects)) {
    throw new EventLogInputError(
      `MAX_OBJECTS must be a non-negative integer, got ${String(maxObjects)}.`,
    );
  }

  const dataClasses = Array.from(net.dataClasses.values());
  const maxObjectsPerType = new Map<string, number>();
  const keyPerDataClass = new Map<string, string>();

  for (const [key, max] of Object.entries(limitsPerType)) {
    const dataClass = findDataClass(dataClasses, key);
    if (!isNonNegativeInteger(max)) {
      throw new EventLogInputError(
        `The maximum for object type "${key}" must be a non-negative integer, got ${String(max)}.`,
      );
    }
    const otherKey = keyPerDataClass.get(dataClass.id);
    if (otherKey !== undefined) {
      throw new EventLogInputError(
        `Object type ${describe(dataClass)} is listed twice (as "${otherKey}" and "${key}").`,
      );
    }
    keyPerDataClass.set(dataClass.id, key);
    maxObjectsPerType.set(dataClass.id, max);
  }

  const createdTypes = new Set<string>();
  for (const transition of net.transitions.values()) {
    getGeneratedVariables(transition).forEach((dataClassId) =>
      createdTypes.add(dataClassId),
    );
  }
  const warnings: string[] = [];
  for (const dataClassId of maxObjectsPerType.keys()) {
    if (!createdTypes.has(dataClassId)) {
      const dataClass = net.dataClasses.get(dataClassId) as NetDataClass;
      warnings.push(
        `Object type ${describe(dataClass)} has a maximum, but no transition creates objects of it.`,
      );
    }
  }

  const everyTypeLimited =
    dataClasses.length > 0 &&
    dataClasses.every((dataClass) => maxObjectsPerType.has(dataClass.id));
  const sumOfTypeLimits = Array.from(maxObjectsPerType.values()).reduce(
    (sum, max) => sum + max,
    0,
  );

  return {
    maxObjects,
    maxObjectsPerType,
    effectiveMaxObjects: everyTypeLimited
      ? Math.min(maxObjects, sumOfTypeLimits)
      : maxObjects,
    warnings,
  };
}

function findDataClass(
  dataClasses: readonly NetDataClass[],
  key: string,
): NetDataClass {
  const matches = dataClasses.filter(
    (dataClass) => dataClass.id === key || dataClass.name === key,
  );
  if (matches.length === 0) {
    throw new EventLogInputError(
      `Unknown object type "${key}". The net's object types are: ${dataClasses.map(describe).join(", ")}.`,
    );
  }
  if (matches.length > 1) {
    throw new EventLogInputError(
      `Object type "${key}" is ambiguous, it matches ${matches.map(describe).join(" and ")}. Use the data class id to pick one.`,
    );
  }
  return matches[0];
}

function describe(dataClass: NetDataClass): string {
  return dataClass.name === dataClass.id
    ? `"${dataClass.id}"`
    : `"${dataClass.name}" (id ${dataClass.id})`;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
