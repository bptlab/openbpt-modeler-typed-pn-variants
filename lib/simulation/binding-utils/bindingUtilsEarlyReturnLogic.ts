import { has } from "min-dash";
import { getDataClassKey } from "./bindingUtilsHelper";
import { create } from "domain";
import { error } from "console";

/**
 * Determines whether there are unbound output variables based on the provided incoming and outgoing arcs.
 *
 * This function filters out inhibitor arcs from both incoming and outgoing arcs, then analyzes the data class keys
 * associated with each arc's inscription elements. It checks if there are any output data class keys that are not
 * present in the input data class keys, indicating unbound output variables. It also considers arcs with only generated
 * inscription elements and handles structurally incorrect arcs (e.g., missing inscription elements).
 *
 * @param incomingArcs - The list of incoming arcs to the node, each potentially carrying data class keys.
 * @param outgoingArcs - The list of outgoing arcs from the node, each potentially carrying data class keys.
 * @returns A tuple:
 *   - The first element is a boolean indicating whether the structure is incorrect.
 *   - The second element is an array of string keys representing the unbound output data class keys.
 */
export function isStructurallyIncorrect(
  incomingArcs: Arc[],
  outgoingArcs: Arc[],
): [boolean, string] {
  incomingArcs = incomingArcs.filter((arc) => !arc.businessObject.isInhibitorArc);
  outgoingArcs = outgoingArcs.filter((arc) => !arc.businessObject.isInhibitorArc);

  const sources: string[] = [];
  const targets: string[] = [];
  let hasArcsWithoutDataClass = false;

  function getDataClassKeysFromArcs(arcs: Arc[], isOutgoing: boolean): Set<string> {
    const dataClassKeys = new Set<string>();
    for (const arc of arcs) {
      const arcObject = arc.businessObject;
      isOutgoing ?
        targets.push(arcObject.target.name || arcObject.target.id) :
        sources.push(arcObject.source.name || arcObject.source.id);
      const inscriptionElements =
        arcObject.inscription?.inscriptionElements || [];
      const variableType = arcObject.variableType || { id: "", alias: "" };
      if (inscriptionElements.length === 0) {
        hasArcsWithoutDataClass = true;
        continue;
      }
      for (const el of inscriptionElements) {
        if (el.isGenerated) {
          continue;
        }
        dataClassKeys.add(getDataClassKey(
          el.dataClass.id,
          el.variableName || el.dataClass.alias,
          (el.dataClass.id === variableType.id && el.dataClass.alias === variableType.alias),
        ));
      }
    }
    return dataClassKeys;
  }

  const inputDataClassKeys = getDataClassKeysFromArcs(incomingArcs, false);
  const outputDataClassKeys = getDataClassKeysFromArcs(outgoingArcs, true);

  const duplicateTargets = targets.filter((id, index) => targets.indexOf(id) !== index);
  const duplicateSources = sources.filter((id, index) => sources.indexOf(id) !== index);

  const unboundOutputDataClassKeys = Array.from(outputDataClassKeys).filter(key => !inputDataClassKeys.has(key));
  const hasUnboundByDataClassKey = unboundOutputDataClassKeys.length > 0;

  const isStructurallyIncorrect =
    hasArcsWithoutDataClass ||
    duplicateTargets.length > 0 ||
    duplicateSources.length > 0 ||
    hasUnboundByDataClassKey;

  return [isStructurallyIncorrect, createStructuralIncorrectnessMessage(
    hasArcsWithoutDataClass,
    duplicateSources,
    duplicateTargets,
    unboundOutputDataClassKeys
  )];
}

/**
 * Determines whether all arcs in the provided dictionary have available tokens.
 *
 * For each entry in the `arcPlaceInfoDict`, this function checks if either:
 * - The arc is an inhibitor arc (`isInhibitorArc` is `true`), or
 * - The arc has at least one token (`tokens.length > 0`).
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc identifiers to their corresponding place information.
 * @returns `true` if every arc is either an inhibitor arc or has at least one token; otherwise, `false`.
 */
export function hasAvailableTokensForAllArcs(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): boolean {
  return Object.values(arcPlaceInfoDict).every(
    (arcPlaceInfo) =>
      arcPlaceInfo.isInhibitorArc || arcPlaceInfo.tokens.length > 0,
  );
}

function createStructuralIncorrectnessMessage(
  hasArcsWithoutDataClass: boolean,
  duplicateSources: string[],
  duplicateTargets: string[],
  unboundOutputDataClassKeys: string[]
): string {
  let errorMessage = "This transition can structurally never be fired!";

  if (hasArcsWithoutDataClass) {
    errorMessage += "\n\nPlease add at least one data class to all places.";
  }
  if (duplicateSources.length > 0 || duplicateTargets.length > 0) {
    errorMessage += `\n\nEach place should have maximally one arc towards and from each transition.`;
  } if (duplicateSources.length > 0) {
    errorMessage += `\nThere are multiple incoming arcs from each of: [${duplicateSources.join(", ")}].`;
  } if (duplicateTargets.length > 0) {
    errorMessage += `\nThere are multiple outgoing arcs towards each of: [${duplicateTargets.join(", ")}].`;
  }
  if (unboundOutputDataClassKeys.length > 0) {
    const varString = unboundOutputDataClassKeys
      .map(v => {
        const parts = v.split(":");
        let result = parts[1];
        if (parts[2] === "true") {
          result += "[]";
        }
        return result;
      })
      .join(", ");
    errorMessage += `\n\nThere are unbound output variables: ${varString}.`;
  }

  return errorMessage;
}