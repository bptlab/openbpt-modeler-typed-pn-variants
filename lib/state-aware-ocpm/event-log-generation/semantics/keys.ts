/**
 * Helpers for binding keys and keyed tokens. Port of the modeler's `binding-utils/helpers.ts`.
 */
import type { BindingKey } from "../types/binding";
import type { KeyedToken } from "./types";

export interface BindingKeyParts {
  dataClassId: string;
  variableName: string;
  isVariable: boolean;
  synchronization?: "exact" | "subset";
}

export function bindingKey(
  dataClassId: string,
  variableName: string,
  isVariable: boolean,
): BindingKey {
  return `${dataClassId}:${variableName}:${isVariable}`;
}

export function parseBindingKey(key: BindingKey): BindingKeyParts {
  const [dataClassId, variableName, isVariable, synchronization] =
    key.split(":");
  return {
    dataClassId,
    variableName,
    isVariable: isVariable === "true",
    synchronization:
      synchronization === "exact" || synchronization === "subset"
        ? synchronization
        : undefined,
  };
}

export function dataClassIdOfKey(key: BindingKey): string {
  return key.split(":")[0];
}

/** Drops the last part of a key, e.g. `DC_1:o:true` → `DC_1:o` (`getBaseDataClassKey`). */
export function baseKey(key: BindingKey): string {
  const parts = key.split(":");
  return parts.length >= 2 ? parts.slice(0, -1).join(":") : key;
}

/** Drops an `:exact` / `:subset` suffix added by the exact-synchronization step. */
export function withoutSynchronization(key: BindingKey): BindingKey {
  return key.split(":").slice(0, 3).join(":");
}

/**
 * Order-independent key for a set of binding keys. The modeler builds it in two ways that
 * agree for the ids it generates (sorting whole keys, or sorting by data class id); a single
 * function is used for both lookups here.
 */
export function combinationKey(keys: Iterable<BindingKey>): string {
  return Array.from(keys).sort().join("::");
}

/** Same keys with the same values. */
export function tokensEqual(tokenA: KeyedToken, tokenB: KeyedToken): boolean {
  const keysA = Object.keys(tokenA);
  const keysB = Object.keys(tokenB);
  return (
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(tokenB, key) &&
        tokenA[key] === tokenB[key],
    )
  );
}

/** Both tokens have all given keys, with equal values. */
export function tokensOverlap(
  tokenA: KeyedToken,
  tokenB: KeyedToken,
  keys: readonly BindingKey[],
): boolean {
  return keys.every(
    (key) => key in tokenA && key in tokenB && tokenA[key] === tokenB[key],
  );
}
