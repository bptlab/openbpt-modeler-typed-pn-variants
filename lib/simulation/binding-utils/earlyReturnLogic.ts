import { getDataClassKey } from "./helpers";

/**
 * Checks whether the structure of the provided arcs is incorrect according to several criteria:
 * - Filters out inhibitor arcs from both incoming and outgoing arcs.
 * - Detects arcs without associated data classes.
 * - Identifies duplicate sources and targets among the arcs.
 * - Determines if there are unbound output data class keys (i.e., output keys not present in input keys).
 *
 * @param incomingArcs - The list of incoming arcs to check, excluding inhibitor arcs.
 * @param outgoingArcs - The list of outgoing arcs to check, excluding inhibitor arcs.
 * @returns A tuple where the first element is a boolean indicating structural incorrectness,
 *          and the second element is a message describing the reason(s) for incorrectness.
 */
export function isStructurallyIncorrect(
  incomingArcs: Arc[],
  outgoingArcs: Arc[],
): [boolean, string] {
  incomingArcs = incomingArcs.filter(
    (arc) => !arc.businessObject.isInhibitorArc,
  );
  outgoingArcs = outgoingArcs.filter(
    (arc) => !arc.businessObject.isInhibitorArc,
  );

  const sources: { id: string; name: string }[] = [];
  const targets: { id: string; name: string }[] = [];
  let hasArcsWithoutDataClass = false;

  function getDataClassKeysFromArcs(
    arcs: Arc[],
    isOutgoing: boolean,
  ): Set<string> {
    const dataClassKeys = new Set<string>();
    for (const arc of arcs) {
      const arcObject = arc.businessObject;
      isOutgoing
        ? targets.push({
            id: arcObject.target.id,
            name: arcObject.target.name || "",
          })
        : sources.push({
            id: arcObject.source.id,
            name: arcObject.source.name || "",
          });
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
        dataClassKeys.add(
          getDataClassKey(
            el.dataClass.id,
            el.variableName || el.dataClass.alias,
            el.dataClass.id === variableType.id &&
              el.dataClass.alias === variableType.alias,
          ),
        );
      }
    }
    return dataClassKeys;
  }

  const inputDataClassKeys = getDataClassKeysFromArcs(incomingArcs, false);
  const outputDataClassKeys = getDataClassKeysFromArcs(outgoingArcs, true);

  const duplicateTargets = targets.filter(
    (target, index) => targets.findIndex((t) => t.id === target.id) !== index,
  );
  const duplicateSources = sources.filter(
    (source, index) => sources.findIndex((s) => s.id === source.id) !== index,
  );

  const unboundOutputDataClassKeys = Array.from(outputDataClassKeys).filter(
    (key) => !inputDataClassKeys.has(key),
  );
  const hasUnboundByDataClassKey = unboundOutputDataClassKeys.length > 0;

  const isStructurallyIncorrect =
    hasArcsWithoutDataClass ||
    duplicateTargets.length > 0 ||
    duplicateSources.length > 0 ||
    hasUnboundByDataClassKey;

  const message = isStructurallyIncorrect
    ? createStructuralIncorrectnessMessage(
        hasArcsWithoutDataClass,
        duplicateSources,
        duplicateTargets,
        unboundOutputDataClassKeys,
      )
    : "This transition is structurally correct.";

  return [isStructurallyIncorrect, message];
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
  duplicateSources: { id: string; name: string }[],
  duplicateTargets: { id: string; name: string }[],
  unboundOutputDataClassKeys: string[],
): string {
  let errorMessage = "This transition can structurally never be fired!";

  if (hasArcsWithoutDataClass) {
    errorMessage += "\n\nPlease add at least one data class to all places.";
  }
  if (duplicateSources.length > 0 || duplicateTargets.length > 0) {
    errorMessage += `\n\nEach place should have at most one arc towards and from each transition.`;
  }
  if (duplicateSources.length > 0) {
    errorMessage += `\nThere are multiple incoming arcs from each of: [${Array.from(new Set(duplicateSources.map((s) => (s.name.length > 0 ? s.name : s.id)))).join(", ")}].`;
  }
  if (duplicateTargets.length > 0) {
    errorMessage += `\nThere are multiple outgoing arcs towards each of: [${Array.from(new Set(duplicateTargets.map((t) => (t.name.length > 0 ? t.name : t.id)))).join(", ")}].`;
  }
  if (unboundOutputDataClassKeys.length > 0) {
    const varString = unboundOutputDataClassKeys
      .map((v) => {
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
