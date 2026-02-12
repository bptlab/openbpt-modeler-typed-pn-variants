import { getDataClassKey } from "./helper";

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
 *   - The first element is a boolean indicating whether there are unbound output variables.
 *   - The second element is an array of string keys representing the unbound output data class keys.
 */
export function hasUnboundOutputVariables(
  incomingArcs: Arc[],
  outgoingArcs: Arc[],
): [boolean, string[]] {
  incomingArcs = incomingArcs.filter((arc) => !arc.businessObject.isInhibitorArc);
  outgoingArcs = outgoingArcs.filter((arc) => !arc.businessObject.isInhibitorArc);

  function getDataClassKeysFromArcs(arcs: Arc[], isOutgoing: boolean): [Set<string>, number] {
    const dataClassKeys = new Set<string>();
    let completelyGeneratedArcs = 0;
    for (const arc of arcs) {
      const inscriptionElements =
        arc.businessObject.inscription?.inscriptionElements || [];
      const variableType = arc.businessObject.variableType || { id: "", alias: "" };
      if (inscriptionElements.length === 0) {
        return [new Set(), 0]; // Return an empty Set and zero count to indicate structural incorrectness
      }
      let countGenerated = 0;
      for (const el of inscriptionElements) {
        if (isOutgoing && el.isGenerated) {
          countGenerated++;
          continue;
        }
        dataClassKeys.add(getDataClassKey(
          el.dataClass.id,
          el.variableName || el.dataClass.alias,
          (el.dataClass.id === variableType.id && el.dataClass.alias === variableType.alias),
        ));
      }
      if (isOutgoing && countGenerated === inscriptionElements.length)
        completelyGeneratedArcs++;
    }
    return [dataClassKeys, completelyGeneratedArcs];
  }

  const inputDataClassKeys = getDataClassKeysFromArcs(incomingArcs, false)[0];
  const [outputDataClassKeys, completelyGeneratedArcs] = getDataClassKeysFromArcs(outgoingArcs, true);

  let outputDataClassKeysArray = Array.from(outputDataClassKeys).filter(key => !inputDataClassKeys.has(key));
  const hasNoOutputDataClassKeys = outputDataClassKeys.size === 0;
  const hasNonGeneratedOutgoingArcs = outgoingArcs.length - completelyGeneratedArcs > 0;
  const hasUnboundByDataClassKey = outputDataClassKeysArray.length > 0;
  const hasIncomingArcsWithoutDataClassKeys = (inputDataClassKeys.size === 0 && incomingArcs.length > 0);
  if (hasIncomingArcsWithoutDataClassKeys)
    outputDataClassKeysArray = [];
  const hasUnboundOutputs =
    (hasNoOutputDataClassKeys && hasNonGeneratedOutgoingArcs) ||
    hasUnboundByDataClassKey ||
    hasIncomingArcsWithoutDataClassKeys;

  return [hasUnboundOutputs, outputDataClassKeysArray];
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
