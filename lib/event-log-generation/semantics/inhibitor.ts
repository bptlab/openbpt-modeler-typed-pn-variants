/**
 * Inhibitor arcs: a binding is blocked if the inhibitor place holds a token with the bound
 * object ids. Port of the modeler's `binding-utils/inhibitorLogic.ts`.
 */
import type { BindingPattern } from "../types/binding";
import type { ObjectId } from "../types/net";
import { baseKey } from "./keys";
import type { ArcReadInfo, ArcReadInfoDict } from "./types";

export function getNonInhibitorArcs(
  arcReadInfoDict: ArcReadInfoDict,
): ArcReadInfoDict {
  return Object.fromEntries(
    Object.entries(arcReadInfoDict).filter(([, info]) => !info.isInhibitorArc),
  );
}

function getInhibitorArcs(arcReadInfoDict: ArcReadInfoDict): ArcReadInfoDict {
  return Object.fromEntries(
    Object.entries(arcReadInfoDict).filter(([, info]) => info.isInhibitorArc),
  );
}

/**
 * An inhibitor arc is relevant if it has binding keys and all of them (ignoring whether
 * they are variable) are also bound by the non-inhibitor incoming arcs.
 */
function isRelevant(info: ArcReadInfo, incomingKeys: Set<string>): boolean {
  const keys = Object.keys(info.valuesPerKey);
  if (keys.length === 0) {
    return false;
  }
  const incomingBaseKeys = new Set(Array.from(incomingKeys).map(baseKey));
  return keys.every((key) => incomingBaseKeys.has(baseKey(key)));
}

/** Each inhibitor token as a pattern keyed by base key (`dataClassId:variableName`). */
function getInhibitorTokens(
  relevantInhibitorArcs: ArcReadInfoDict,
): BindingPattern[] {
  const inhibitorTokens: BindingPattern[] = [];
  for (const info of Object.values(relevantInhibitorArcs)) {
    for (const token of info.tokens) {
      const pattern: BindingPattern = {};
      for (const [key, value] of Object.entries(token)) {
        pattern[baseKey(key)] = [value];
      }
      inhibitorTokens.push(pattern);
    }
  }
  return inhibitorTokens;
}

/**
 * For each inhibitor token, every binding that contains all of the token's values is
 * replaced by variants in which those values are removed (one variant per key). Variants
 * in which a key runs out of values are dropped.
 */
function getFilteredBindings(
  bindings: readonly BindingPattern[],
  inhibitorTokens: readonly BindingPattern[],
): BindingPattern[] {
  let filteredBindings: BindingPattern[] = [...bindings];
  const processedInhibitorToken: { [baseKey: string]: ObjectId[] } = {};

  for (const inhibitorToken of inhibitorTokens) {
    const newBindings: BindingPattern[] = [];
    for (const binding of filteredBindings) {
      let allMatch = true;
      for (const key of Object.keys(inhibitorToken)) {
        const bindingValues = (binding[key + ":false"] || []).concat(
          binding[key + ":true"] || [],
        );
        if (!inhibitorToken[key].every((v) => bindingValues.includes(v))) {
          allMatch = false;
          break;
        }
      }
      if (!allMatch) {
        newBindings.push(binding);
        continue;
      }

      for (const key of Object.keys(inhibitorToken)) {
        if (
          !Object.prototype.hasOwnProperty.call(processedInhibitorToken, key)
        ) {
          processedInhibitorToken[key] = [];
        }
        if (processedInhibitorToken[key].includes(inhibitorToken[key][0])) {
          continue;
        }
        const inhibitedBinding: BindingPattern = { ...binding };
        let hasEmpty = false;
        for (const isVariable of [true, false]) {
          const variantKey = `${key}:${isVariable}`;
          if (inhibitedBinding[variantKey]) {
            inhibitedBinding[variantKey] = inhibitedBinding[variantKey].filter(
              (v) => !inhibitorToken[key].includes(v),
            );
          }
          if (
            inhibitedBinding[variantKey] &&
            inhibitedBinding[variantKey].length === 0
          ) {
            hasEmpty = true;
            break;
          }
        }
        if (!hasEmpty) {
          newBindings.push(inhibitedBinding);
        }
        processedInhibitorToken[key].push(...inhibitorToken[key]);
      }
    }
    filteredBindings = newBindings;
  }

  return filteredBindings;
}

/** Removes the object ids blocked by relevant inhibitor arcs from the bindings. */
export function filterBindingsByInhibitors(
  bindings: BindingPattern[],
  arcReadInfoDict: ArcReadInfoDict,
): BindingPattern[] {
  const inhibitorArcs = getInhibitorArcs(arcReadInfoDict);

  const incomingKeys = new Set(
    Object.values(getNonInhibitorArcs(arcReadInfoDict)).flatMap((info) =>
      Object.keys(info.valuesPerKey),
    ),
  );

  const relevantInhibitorArcs = Object.fromEntries(
    Object.entries(inhibitorArcs).filter(([, info]) =>
      isRelevant(info, incomingKeys),
    ),
  );

  if (Object.keys(relevantInhibitorArcs).length === 0) {
    return bindings;
  }

  return getFilteredBindings(
    bindings,
    getInhibitorTokens(relevantInhibitorArcs),
  );
}
