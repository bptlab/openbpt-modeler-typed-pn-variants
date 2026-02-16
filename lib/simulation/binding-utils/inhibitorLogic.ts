import { has } from "min-dash";
import {
  getAllDataClassKeysFromArcs,
  getBaseDataClassKey,
  getDataClassKey,
} from "./helpers";

/**
 * Filters and returns only the non-inhibitor arcs from the provided arc-place information dictionary.
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc-place identifiers to their corresponding information, including tokens and inhibitor status.
 * @returns A new dictionary containing only the entries where `isInhibitorArc` is `false`.
 */
export function getNonInhibitorArcs(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): ArcPlaceInfoDict {
  return Object.fromEntries(
    Object.entries(arcPlaceInfoDict).filter(
      ([_, arcPlaceInfo]) => !arcPlaceInfo.isInhibitorArc,
    ),
  );
}

/**
 * Filters and returns only the inhibitor arcs from the provided arc-place information dictionary.
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc-place identifiers to their corresponding information, including tokens and inhibitor status.
 * @returns A new dictionary containing only the entries where `isInhibitorArc` is `true`.
 */
function getInhibitorArcs(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): ArcPlaceInfoDict {
  return Object.fromEntries(
    Object.entries(arcPlaceInfoDict).filter(
      ([_, arcPlaceInfo]) => arcPlaceInfo.isInhibitorArc,
    ),
  );
}

/**
 * Checks if an inhibitor arc ...
 * 1. has tokens
 * 2. is not linking
 * 3. only has data classes that exist in the incoming arcs
 *
 * @param arcPlaceInfo - The arc-place information to check.
 * @param incomingDataClassKeys - Set of all data class keys from incoming arcs (excluding inhibitor arcs).
 * @returns `true` if all data classes from the arc exist in incoming arcs; otherwise, `false`.
 */
function isRelevant(
  arcPlaceInfo: ArcPlaceInfo,
  incomingDataClassKeys: Set<string>,
): boolean {
  if (Object.keys(arcPlaceInfo.dataClassInfoDict).length === 0) {
    return false;
  }

  const incomingBaseDataClassKeys = new Set(
    Array.from(incomingDataClassKeys).map(getBaseDataClassKey),
  );

  return Object.keys(arcPlaceInfo.dataClassInfoDict).every(
    (dataClassKey) => {
      const baseKey = getBaseDataClassKey(
        dataClassKey,
      );
      return incomingBaseDataClassKeys.has(baseKey);
    },
  );
}

/**
 * Generates an array of `BindingPerDataClass` objects representing inhibitor tokens
 * from the provided inhibitor arcs information.
 *
 * For each token in each arc, creates a binding object where each key is the base data class key
 * (obtained via `getBaseDataClassKey`) suffixed with `:true` and `:false`, both mapped to the token's value in an array.
 * Each binding is then added to the result array.
 *
 * @param relevantInhibitorArcs - A dictionary mapping arc identifiers to their corresponding place information,
 *                                which includes tokens to be processed as inhibitor tokens.
 * @returns An array of `BindingPerDataClass` objects, each representing the inhibitor token bindings
 *          for the given arcs.
 */
function getInhibitorTokens(
  relevantInhibitorArcs: ArcPlaceInfoDict,
): BindingPerDataClass[] {
  const inhibitorTokens: BindingPerDataClass[] = [];

  for (const arcPlaceInfo of Object.values(relevantInhibitorArcs)) {
    for (const token of arcPlaceInfo.tokens) {
      const binding: BindingPerDataClass = {};
      for (const [dataClassKey, value] of Object.entries(token)) {
        binding[getBaseDataClassKey(dataClassKey)] = [value];
      }
      inhibitorTokens.push(binding);
    }
  }

  return inhibitorTokens;
}


/**
 * Filters bindings by removing or modifying them based on inhibitor tokens.
 * 
 * For each inhibitor token, this function:
 * 1. Checks if all inhibitor token values exist in a binding's data
 * 2. If they match, removes the inhibitor token values from that binding
 * 3. Removes the entire binding if any key becomes empty after filtering
 * 4. Keeps bindings that don't match the inhibitor token criteria
 * 
 * @param bindings - The array of bindings to filter
 * @param inhibitorTokens - The array of inhibitor tokens used to filter the bindings
 * @returns A new array of filtered bindings with inhibitor token values removed
 */
function getFilteredBindings(
  bindings: BindingPerDataClass[],
  inhibitorTokens: BindingPerDataClass[],
): BindingPerDataClass[] {
  let filteredBindings: BindingPerDataClass[] = [...bindings];
  let processedInhibitorToken: { [baseDataClass: string]: string[] } = {};

  for (const inhibitorToken of inhibitorTokens) {
    let newBindings: BindingPerDataClass[] = [];
    for (const binding of filteredBindings) {
      let allMatch = true;
      for (const key of Object.keys(inhibitorToken)) {
        const bindingValues = (binding[key + ":false"] || []).concat(binding[key + ":true"] || []);
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
        if (!has(processedInhibitorToken, key)) {
          processedInhibitorToken[key] = [];
        }
        if (processedInhibitorToken[key].includes(inhibitorToken[key][0])) {
          continue;
        }
        let inhibitoredBinding = { ...binding };
        let hasEmpty = false;
        for (const isVariable of [true, false]) {
          if (inhibitoredBinding[key + `:${isVariable}`]) {
            inhibitoredBinding[key + `:${isVariable}`] = inhibitoredBinding[key + `:${isVariable}`].filter(
              (v) => !inhibitorToken[key].includes(v)
            );
          }
          if (inhibitoredBinding[key + `:${isVariable}`] && inhibitoredBinding[key + `:${isVariable}`].length === 0) {
            hasEmpty = true;
            break;
          }
        }
        if (!hasEmpty) {
          newBindings.push(inhibitoredBinding);
        }
        processedInhibitorToken[key].push(...inhibitorToken[key]);
      }
    }
    filteredBindings = newBindings;
  }

  return filteredBindings;
}

/**
 * Filters bindings by removing those that contain inhibitor arc tokens.
 * 
 * @param bindings - The bindings to filter, organized by data class
 * @param arcPlaceInfoDict - Dictionary containing information about all arcs and places
 * @returns A new array of bindings with entries removed if they contain any inhibitor arc tokens
 * 
 * @description
 * This function performs the following steps:
 * 1. Identifies all inhibitor arcs from the arc place info dictionary
 * 2. Collects all incoming data class keys from non-inhibitor arcs
 * 3. Filters inhibitor arcs to only those that are relevant (have tokens and matching data classes)
 * 4. Returns the original bindings early if no relevant inhibitor arcs exist
 * 5. Extracts inhibitor tokens from the relevant inhibitor arcs
 * 6. Removes bindings that contain any of the inhibitor tokens
 * 
 * @remarks
 * Inhibitor arcs are special arcs in Petri nets that prevent a transition from firing if tokens
 * are present in the associated places. This function filters out bindings that would violate
 * such inhibition conditions.
 */
export function filterBindingsByInhibitors(
  bindings: BindingPerDataClass[],
  arcPlaceInfoDict: ArcPlaceInfoDict,
): BindingPerDataClass[] {
  const inhibitorArcs = getInhibitorArcs(arcPlaceInfoDict);

  // Get all incoming data classes (excluding inhibitor arcs)
  const incomingDataClassKeys = getAllDataClassKeysFromArcs(
    getNonInhibitorArcs(arcPlaceInfoDict)
  );

  // Filter inhibitor arcs to only those relevant 
  // (having tokens and data classes in incoming arcs)
  const relevantInhibitorArcs = Object.fromEntries(
    Object.entries(inhibitorArcs).filter(([_, arcPlaceInfo]) =>
      isRelevant(arcPlaceInfo, incomingDataClassKeys),
    ),
  );

  // Early return: if no relevant inhibitor arcs exist, return original bindings
  if (Object.keys(relevantInhibitorArcs).length === 0) {
    return bindings;
  }

  // Get inhibitor tokens as bindings
  const inhibitorTokens = getInhibitorTokens(relevantInhibitorArcs);

  // Filter out tokenvalues that are part of inhibitor tokens
  // If any array becomes empty, the binding is removed
  const filteredBindings = getFilteredBindings(bindings, inhibitorTokens);

  return filteredBindings;
}